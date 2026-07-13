import QRCode from "qrcode";

export function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: text.startsWith("PPX1:PRIVATE:") ? "L" : "H",
    margin: 2,
    width: text.startsWith("PPX1:PRIVATE:") ? 1024 : 512,
    color: { dark: "#172033", light: "#ffffff" },
  });
}
