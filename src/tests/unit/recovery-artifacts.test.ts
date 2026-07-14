import { describe, expect, it } from "vitest";
import {
  createRecoveryDocumentModel,
  privateRecoveryCardLayout,
  recoveryArtifactFilename,
  splitPrintablePassword,
} from "../../flows/identity/recovery-artifacts";
import { generateRecoveryPdfBytes } from "../../flows/identity/recovery-pdf";
import { privateRecoveryCardCopy } from "../../flows/identity/recovery-card";
import { PDFDocument } from "pdf-lib";

describe("recovery artifact model", () => {
  it("builds one localized model shared by print and PDF", () => {
    const model = createRecoveryDocumentModel({
      locale: "en",
      username: "Alice Example",
      creationTime: 1_782_864_000n,
      recoveryCode: "PPX1:RECOVERY:ABC",
      words: Array.from({ length: 24 }, (_, index) => `word${index + 1}`),
      password: "Vault password 123!",
      qrDataUrl: "data:image/png;base64,AA==",
    });

    expect(model.username).toBe("Alice Example");
    expect(model.isoDate).toMatch(/^2026-/u);
    expect(model.recoveryCode).toBe("PPX1:RECOVERY:ABC");
    expect(model.words).toHaveLength(24);
    expect(model.password).toBe("Vault password 123!");
    expect(model.passwordLength).toBe(19);
  });

  it("keeps long printable passwords unambiguous", () => {
    const password = "A".repeat(256);
    const lines = splitPrintablePassword(password, 64);
    expect(lines).toHaveLength(4);
    expect(lines.join("")).toBe(password);
  });

  it("creates filesystem-safe recovery filenames", () => {
    expect(
      recoveryArtifactFilename("Alice / Example", "2026-07-13", "pdf"),
    ).toBe("chat-nocontrol-alice-example-recovery-2026-07-13.pdf");
  });

  it("uses the approved taller private QR card geometry", () => {
    expect(privateRecoveryCardLayout).toMatchObject({
      width: 1024,
      height: 1280,
      qrTop: 256,
      qrSize: 768,
      dark: "#7f1d1d",
      light: "#ffffff",
    });
    const { border, header, headerText } = privateRecoveryCardLayout;
    expect(header.x).toBeGreaterThanOrEqual(border.x + border.lineWidth / 2);
    expect(header.y).toBeGreaterThanOrEqual(border.y + border.lineWidth / 2);
    expect(header.x + header.width).toBeLessThanOrEqual(
      border.x + border.width - border.lineWidth / 2,
    );
    for (const box of Object.values(headerText)) {
      expect(box.x).toBeGreaterThanOrEqual(header.x);
      expect(box.y).toBeGreaterThanOrEqual(header.y);
      expect(box.x + box.width).toBeLessThanOrEqual(header.x + header.width);
      expect(box.y + box.height).toBeLessThanOrEqual(
        privateRecoveryCardLayout.qrTop,
      );
    }
  });

  it("keeps the username and never-share warning above the QR", () => {
    expect(privateRecoveryCardCopy("en", "Alice")).toEqual({
      username: "Alice",
      title: "PRIVATE KEY",
      warning: "NEVER SHARE",
    });
    expect(privateRecoveryCardCopy("de", "Alice").warning).toBe(
      "NIEMALS TEILEN",
    );
  });

  it("generates a one-page A4 PDF from the shared model", async () => {
    const model = createRecoveryDocumentModel({
      locale: "en",
      username: "Alice",
      creationTime: 1_782_864_000n,
      recoveryCode: "PPX1:RECOVERY:ABC",
      words: Array.from({ length: 24 }, (_, index) => `word${index + 1}`),
      password: "Vault password 123!",
      qrDataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
    });
    const bytes = await generateRecoveryPdfBytes(model);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(document.getPage(0).getSize()).toMatchObject({
      width: 595.28,
      height: 841.89,
    });
  });

  it("renders a Unicode username through an embedded image", async () => {
    const pixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=";
    const model = createRecoveryDocumentModel({
      locale: "en",
      username: "李伟",
      creationTime: 1_782_864_000n,
      recoveryCode: "PPX1:RECOVERY:ABC",
      words: Array.from({ length: 24 }, (_, index) => `word${index + 1}`),
      password: "Vault password 123!",
      qrDataUrl: pixel,
      usernameImageDataUrl: pixel,
    });
    await expect(generateRecoveryPdfBytes(model)).resolves.toBeInstanceOf(
      Uint8Array,
    );
  });

  it("keeps maximum German recovery content inside non-overlapping A4 bounds", async () => {
    const pixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=";
    const model = createRecoveryDocumentModel({
      locale: "de",
      username: "u".repeat(48),
      creationTime: 1_782_864_000n,
      recoveryCode: `PPX1:RECOVERY:${"ABCDE12345".repeat(180)}`,
      words: Array.from(
        { length: 24 },
        (_, index) => `wiederherstellungswort${index + 1}`,
      ),
      password: "P".repeat(256),
      qrDataUrl: pixel,
    });
    const pdfModule = (await import(
      "../../flows/identity/recovery-pdf"
    )) as unknown as {
      inspectRecoveryPdfLayout?: (
        input: typeof model,
      ) => Promise<{
        pageCount: number;
        outOfBounds: readonly string[];
        intersections: readonly string[];
        warningLines: readonly string[];
      }>;
    };

    expect(pdfModule.inspectRecoveryPdfLayout).toBeTypeOf("function");
    if (!pdfModule.inspectRecoveryPdfLayout) return;
    const inspection = await pdfModule.inspectRecoveryPdfLayout(model);
    expect(inspection.pageCount).toBe(1);
    expect(inspection.outOfBounds).toEqual([]);
    expect(inspection.intersections).toEqual([]);
    expect(inspection.warningLines.join(" ")).toContain(
      "Passwort niemals wiederverwenden.",
    );
  });
});
