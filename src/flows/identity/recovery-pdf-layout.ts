export interface PdfRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RecoveryPdfLayout {
  page: PdfRectangle;
  margin: number;
  bodyFontSize: number;
  codeFontSize: number;
  header: PdfRectangle;
  metadata: PdfRectangle;
  recoveryCode: PdfRectangle;
  qr: PdfRectangle;
  password: PdfRectangle;
  words: PdfRectangle;
  warning: PdfRectangle;
}

export interface RecoveryPdfLayoutInput {
  recoveryLineCount: number;
  passwordLineCount: number;
  warningLineCount: number;
  bodyFontSize: number;
  codeFontSize: number;
}

export const A4_PAGE = { x: 0, y: 0, width: 595.28, height: 841.89 } as const;

export function calculateRecoveryPdfLayout(
  input: RecoveryPdfLayoutInput,
): RecoveryPdfLayout {
  const margin = 34;
  const contentWidth = A4_PAGE.width - margin * 2;
  const header = {
    x: margin,
    y: A4_PAGE.height - margin - 64,
    width: contentWidth,
    height: 64,
  };
  const metadata = {
    x: margin,
    y: header.y - 58,
    width: contentWidth,
    height: 46,
  };
  const columnTop = metadata.y - 12;
  const qrSize = 190;
  const columnGap = 16;
  const recoveryWidth = contentWidth - qrSize - columnGap;
  const recoveryHeight = Math.max(
    qrSize,
    30 + input.recoveryLineCount * (input.codeFontSize + 2),
  );
  const recoveryCode = {
    x: margin,
    y: columnTop - recoveryHeight,
    width: recoveryWidth,
    height: recoveryHeight,
  };
  const qr = {
    x: margin + recoveryWidth + columnGap,
    y: columnTop - qrSize,
    width: qrSize,
    height: qrSize,
  };
  const columnsBottom = Math.min(recoveryCode.y, qr.y);
  const passwordHeight =
    34 + input.passwordLineCount * (input.codeFontSize + 3);
  const password = {
    x: margin,
    y: columnsBottom - 14 - passwordHeight,
    width: contentWidth,
    height: passwordHeight,
  };
  const words = {
    x: margin,
    y: password.y - 144,
    width: contentWidth,
    height: 130,
  };
  const warningHeight =
    18 + input.warningLineCount * (input.bodyFontSize + 3);
  const warning = {
    x: margin,
    y: margin,
    width: contentWidth,
    height: warningHeight,
  };

  if (words.y < warning.y + warning.height + 14) {
    throw new Error("Recovery PDF content does not fit on one A4 page");
  }

  return {
    page: { ...A4_PAGE },
    margin,
    bodyFontSize: input.bodyFontSize,
    codeFontSize: input.codeFontSize,
    header,
    metadata,
    recoveryCode,
    qr,
    password,
    words,
    warning,
  };
}

export function rectanglesIntersect(
  left: PdfRectangle,
  right: PdfRectangle,
): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

export function rectangleInsideMargins(
  rectangle: PdfRectangle,
  page: PdfRectangle,
  margin: number,
): boolean {
  return (
    rectangle.x >= margin &&
    rectangle.y >= margin &&
    rectangle.x + rectangle.width <= page.width - margin &&
    rectangle.y + rectangle.height <= page.height - margin
  );
}
