import QRCode from "qrcode";
import type { Locale } from "../../i18n";
import { privateRecoveryCardLayout } from "./recovery-artifacts";

export function privateRecoveryCardCopy(locale: Locale, username: string) {
  return {
    username,
    title: locale === "de" ? "PRIVATER SCHLÜSSEL" : "PRIVATE KEY",
    warning: locale === "de" ? "NIEMALS TEILEN" : "NEVER SHARE",
  };
}

export function generateRecoveryQrDataUrl(
  recoveryCode: string,
): Promise<string> {
  return QRCode.toDataURL(recoveryCode, {
    errorCorrectionLevel: "H",
    margin: 4,
    width: privateRecoveryCardLayout.qrSize,
    color: {
      dark: privateRecoveryCardLayout.dark,
      light: privateRecoveryCardLayout.light,
    },
  });
}

export function generateRecoveryUsernameDataUrl(username: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 120;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#172033";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.font = '700 72px system-ui, -apple-system, "Segoe UI", sans-serif';
  context.fillText(username, 0, canvas.height / 2, canvas.width);
  return canvas.toDataURL("image/png");
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not render recovery QR"));
    image.src = source;
  });
}

export async function generatePrivateRecoveryCardDataUrl(
  locale: Locale,
  username: string,
  recoveryCode: string,
): Promise<string> {
  const qrSource = await generateRecoveryQrDataUrl(recoveryCode);
  const qrImage = await loadImage(qrSource);
  const canvas = document.createElement("canvas");
  canvas.width = privateRecoveryCardLayout.width;
  canvas.height = privateRecoveryCardLayout.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  const copy = privateRecoveryCardCopy(locale, username);
  context.fillStyle = privateRecoveryCardLayout.light;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = privateRecoveryCardLayout.dark;
  context.lineWidth = privateRecoveryCardLayout.border.lineWidth;
  context.strokeRect(
    privateRecoveryCardLayout.border.x,
    privateRecoveryCardLayout.border.y,
    privateRecoveryCardLayout.border.width,
    privateRecoveryCardLayout.border.height,
  );
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#172033";
  context.font = '700 52px system-ui, -apple-system, "Segoe UI", sans-serif';
  context.fillText(
    copy.username,
    canvas.width / 2,
    privateRecoveryCardLayout.headerText.username.baseline,
    privateRecoveryCardLayout.headerText.username.width,
  );
  context.fillStyle = privateRecoveryCardLayout.dark;
  context.font = '800 58px system-ui, -apple-system, "Segoe UI", sans-serif';
  context.fillText(
    copy.title,
    canvas.width / 2,
    privateRecoveryCardLayout.headerText.title.baseline,
    privateRecoveryCardLayout.headerText.title.width,
  );
  context.font = '800 42px system-ui, -apple-system, "Segoe UI", sans-serif';
  context.fillText(
    copy.warning,
    canvas.width / 2,
    privateRecoveryCardLayout.headerText.warning.baseline,
    privateRecoveryCardLayout.headerText.warning.width,
  );
  const qrLeft = (canvas.width - privateRecoveryCardLayout.qrSize) / 2;
  context.drawImage(
    qrImage,
    qrLeft,
    privateRecoveryCardLayout.qrTop,
    privateRecoveryCardLayout.qrSize,
    privateRecoveryCardLayout.qrSize,
  );
  context.fillStyle = privateRecoveryCardLayout.dark;
  context.font = '700 28px system-ui, -apple-system, "Segoe UI", sans-serif';
  context.fillText(
    locale === "de"
      ? "Wer diesen Code besitzt, kann deine Identität wiederherstellen."
      : "Anyone with this code can restore your identity.",
    canvas.width / 2,
    privateRecoveryCardLayout.footerBaseline,
    900,
  );
  return canvas.toDataURL("image/png");
}
