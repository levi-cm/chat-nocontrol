import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { RecoveryDocumentModel } from "./recovery-artifacts";
import {
  calculateRecoveryPdfLayout,
  rectangleInsideMargins,
  rectanglesIntersect,
  type PdfRectangle,
  type RecoveryPdfLayout,
} from "./recovery-pdf-layout";

function dataUrlBytes(dataUrl: string): Uint8Array {
  const separator = dataUrl.indexOf(",");
  if (separator < 0 || !dataUrl.slice(0, separator).includes("base64")) {
    throw new Error("Expected a base64 image data URL");
  }
  const encoded = dataUrl.slice(separator + 1);
  if (typeof atob === "function") {
    const decoded = atob(encoded);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(encoded, "base64"));
}

export function wrapTextByFontWidth(
  value: string,
  font: PDFFont,
  size: number,
  maximumWidth: number,
): string[] {
  if (maximumWidth <= 0) throw new Error("Invalid PDF text width");
  const lines: string[] = [];
  let line = "";

  const pushTokenPieces = (token: string) => {
    let piece = "";
    for (const character of token) {
      const candidate = piece + character;
      if (piece && font.widthOfTextAtSize(candidate, size) > maximumWidth) {
        lines.push(piece);
        piece = character;
      } else {
        piece = candidate;
      }
    }
    line = piece;
  };

  for (const token of value.trim().split(/\s+/u)) {
    const candidate = line ? `${line} ${token}` : token;
    if (font.widthOfTextAtSize(candidate, size) <= maximumWidth) {
      line = candidate;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    if (font.widthOfTextAtSize(token, size) <= maximumWidth) {
      line = token;
    } else {
      pushTokenPieces(token);
    }
  }
  if (line || lines.length === 0) lines.push(line);
  return lines;
}

interface PreparedRecoveryPdf {
  document: PDFDocument;
  layout: RecoveryPdfLayout;
  warningLines: string[];
  baselines: Array<{ name: string; x: number; y: number }>;
}

const sectionNames = [
  "header",
  "metadata",
  "recoveryCode",
  "qr",
  "password",
  "words",
  "warning",
] as const;

async function prepareRecoveryPdf(
  model: RecoveryDocumentModel,
): Promise<PreparedRecoveryPdf> {
  const document = await PDFDocument.create();
  document.setTitle("Chat NoControl private recovery document");
  document.setSubject("Private identity recovery material - never share");
  document.setCreator("Chat NoControl");
  const page = document.addPage([595.28, 841.89]);
  const sans = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const mono = await document.embedFont(StandardFonts.Courier);
  const qr = await document.embedPng(dataUrlBytes(model.qrDataUrl));
  const usernameImage = model.usernameImageDataUrl
    ? await document.embedPng(dataUrlBytes(model.usernameImageDataUrl))
    : null;
  const warning =
    model.locale === "de"
      ? "Wer dieses Dokument besitzt, kann deine Identitaet wiederherstellen. Offline und sicher aufbewahren. Passwort niemals wiederverwenden."
      : "Anyone with this document can restore your identity. Store it safely offline. Never reuse this password elsewhere.";

  let layout: RecoveryPdfLayout | undefined;
  let recoveryLines: string[] = [];
  let passwordLines: string[] = [];
  let warningLines: string[] = [];
  const bodySizes = [8.4, 8, 7.5, 7];
  const codeSizes = [6.8, 6.4, 6];
  for (const bodyFontSize of bodySizes) {
    for (const codeFontSize of codeSizes) {
      const draft = calculateRecoveryPdfLayout({
        recoveryLineCount: 1,
        passwordLineCount: 1,
        warningLineCount: 1,
        bodyFontSize,
        codeFontSize,
      });
      recoveryLines = wrapTextByFontWidth(
        model.recoveryCode,
        mono,
        codeFontSize,
        draft.recoveryCode.width - 16,
      );
      passwordLines = wrapTextByFontWidth(
        model.password,
        mono,
        codeFontSize,
        draft.password.width - 16,
      );
      warningLines = wrapTextByFontWidth(
        warning,
        bold,
        bodyFontSize,
        draft.warning.width - 20,
      );
      try {
        layout = calculateRecoveryPdfLayout({
          recoveryLineCount: recoveryLines.length,
          passwordLineCount: passwordLines.length,
          warningLineCount: warningLines.length,
          bodyFontSize,
          codeFontSize,
        });
        break;
      } catch {
        // Try the next explicitly bounded font-size pair.
      }
    }
    if (layout) break;
  }
  if (!layout) {
    throw new Error("Recovery PDF content does not fit without clipping");
  }

  const danger = rgb(0.498, 0.114, 0.114);
  const ink = rgb(0.09, 0.12, 0.19);
  const muted = rgb(0.32, 0.36, 0.43);
  const paperTint = rgb(0.99, 0.97, 0.97);
  const baselines: Array<{ name: string; x: number; y: number }> = [];
  const drawText = (
    name: string,
    value: string,
    x: number,
    y: number,
    options: Parameters<typeof page.drawText>[1],
  ) => {
    page.drawText(value, { ...options, x, y });
    baselines.push({ name, x, y });
  };

  page.drawRectangle({ ...layout.header, color: danger });
  drawText(
    "header-brand",
    "CHAT NOCONTROL",
    layout.header.x + 14,
    layout.header.y + 37,
    {
      font: bold,
      size: 16,
      color: rgb(1, 1, 1),
    },
  );
  drawText(
    "header-warning",
    model.locale === "de"
      ? "PRIVATES WIEDERHERSTELLUNGSDOKUMENT - NIEMALS TEILEN"
      : "PRIVATE RECOVERY DOCUMENT - NEVER SHARE",
    layout.header.x + 14,
    layout.header.y + 14,
    { font: bold, size: 10, color: rgb(1, 1, 1) },
  );

  drawText(
    "username-label",
    model.locale === "de" ? "Benutzername" : "Username",
    layout.metadata.x,
    layout.metadata.y + 34,
    { font: bold, size: 9, color: muted },
  );
  if (usernameImage) {
    const dimensions = usernameImage.scale(1);
    const displayWidth = Math.min(
      layout.metadata.width * 0.62,
      dimensions.width / 3,
    );
    const displayHeight = Math.min(
      18,
      dimensions.height * (displayWidth / dimensions.width),
    );
    page.drawImage(usernameImage, {
      x: layout.metadata.x,
      y: layout.metadata.y + 13,
      width: displayWidth,
      height: displayHeight,
    });
  } else {
    drawText(
      "username",
      model.username,
      layout.metadata.x,
      layout.metadata.y + 14,
      {
        font: bold,
        size: 15,
        color: ink,
        maxWidth: layout.metadata.width * 0.62,
      },
    );
  }
  drawText(
    "created",
    `${model.locale === "de" ? "Erstellt" : "Created"}: ${model.localizedDate} (${model.isoDate})`,
    layout.metadata.x + layout.metadata.width * 0.64,
    layout.metadata.y + 16,
    { font: sans, size: 8.5, color: muted },
  );

  drawText(
    "recovery-title",
    model.locale === "de"
      ? "Privater Wiederherstellungscode"
      : "Private recovery code",
    layout.recoveryCode.x,
    layout.recoveryCode.y + layout.recoveryCode.height - 12,
    { font: bold, size: 10, color: danger },
  );
  const recoveryLineHeight = layout.codeFontSize + 2;
  recoveryLines.forEach((line, index) => {
    drawText(
      `recovery-${index}`,
      line,
      layout.recoveryCode.x,
      layout.recoveryCode.y +
        layout.recoveryCode.height -
        28 -
        index * recoveryLineHeight,
      { font: mono, size: layout.codeFontSize, color: ink },
    );
  });
  page.drawImage(qr, layout.qr);

  drawText(
    "password-title",
    model.locale === "de"
      ? "Browser-Tresor-Passwort"
      : "Browser-vault password",
    layout.password.x,
    layout.password.y + layout.password.height - 11,
    { font: bold, size: 10, color: danger },
  );
  drawText(
    "password-meta",
    `${model.passwordLength} ${model.locale === "de" ? "Zeichen, Gross-/Kleinschreibung beachten" : "characters, case-sensitive"}`,
    layout.password.x + 154,
    layout.password.y + layout.password.height - 10,
    { font: sans, size: 8, color: muted },
  );
  const passwordBox: PdfRectangle = {
    x: layout.password.x,
    y: layout.password.y,
    width: layout.password.width,
    height: layout.password.height - 22,
  };
  page.drawRectangle({
    ...passwordBox,
    borderColor: danger,
    borderWidth: 1,
    color: paperTint,
  });
  const passwordLineHeight = layout.codeFontSize + 3;
  passwordLines.forEach((line, index) => {
    drawText(
      `password-${index}`,
      line,
      passwordBox.x + 8,
      passwordBox.y + passwordBox.height - 12 - index * passwordLineHeight,
      { font: mono, size: layout.codeFontSize, color: ink },
    );
  });

  drawText(
    "words-title",
    model.locale === "de"
      ? "24 Wiederherstellungswoerter"
      : "24 recovery words",
    layout.words.x,
    layout.words.y + layout.words.height - 12,
    { font: bold, size: 11, color: ink },
  );
  const columnWidth = layout.words.width / 3;
  const wordLineHeight = 13;
  model.words.forEach((word, index) => {
    const column = Math.floor(index / 8);
    const row = index % 8;
    drawText(
      `word-${index + 1}`,
      `${String(index + 1).padStart(2, "0")}. ${word}`,
      layout.words.x + column * columnWidth,
      layout.words.y + layout.words.height - 30 - row * wordLineHeight,
      { font: mono, size: Math.max(7, layout.bodyFontSize), color: ink },
    );
  });

  page.drawRectangle({
    ...layout.warning,
    borderColor: danger,
    borderWidth: 1.4,
  });
  const warningLineHeight = layout.bodyFontSize + 3;
  warningLines.forEach((line, index) => {
    drawText(
      `warning-${index}`,
      line,
      layout.warning.x + 10,
      layout.warning.y + layout.warning.height - 13 - index * warningLineHeight,
      { font: bold, size: layout.bodyFontSize, color: danger },
    );
  });

  return { document, layout, warningLines, baselines };
}

export async function inspectRecoveryPdfLayout(model: RecoveryDocumentModel) {
  const prepared = await prepareRecoveryPdf(model);
  const rectangles = sectionNames.map(
    (name) => [name, prepared.layout[name]] as const,
  );
  const outOfBounds: string[] = rectangles
    .filter(
      ([, rectangle]) =>
        !rectangleInsideMargins(
          rectangle,
          prepared.layout.page,
          prepared.layout.margin,
        ),
    )
    .map(([name]) => name);
  for (const baseline of prepared.baselines) {
    if (
      baseline.x < prepared.layout.margin ||
      baseline.x > prepared.layout.page.width - prepared.layout.margin ||
      baseline.y < prepared.layout.margin ||
      baseline.y > prepared.layout.page.height - prepared.layout.margin
    ) {
      outOfBounds.push(baseline.name);
    }
  }
  const intersections: string[] = [];
  for (let left = 0; left < rectangles.length; left += 1) {
    for (let right = left + 1; right < rectangles.length; right += 1) {
      const leftRectangle = rectangles[left];
      const rightRectangle = rectangles[right];
      if (
        leftRectangle &&
        rightRectangle &&
        rectanglesIntersect(leftRectangle[1], rightRectangle[1])
      ) {
        intersections.push(`${leftRectangle[0]}:${rightRectangle[0]}`);
      }
    }
  }
  return {
    pageCount: prepared.document.getPageCount(),
    outOfBounds,
    intersections,
    warningLines: prepared.warningLines,
  };
}

export async function generateRecoveryPdfBytes(
  model: RecoveryDocumentModel,
): Promise<Uint8Array> {
  const { document } = await prepareRecoveryPdf(model);
  return document.save({ useObjectStreams: false });
}
