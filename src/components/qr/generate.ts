import QRCode from "qrcode";

export function qrRenderOptions(text: string) {
  if (text.startsWith("PPX1:CONTACT:")) {
    return {
      errorCorrectionLevel: "M" as const,
      margin: 4,
      width: 2_048,
      color: { dark: "#000000", light: "#ffffff" },
    };
  }
  if (text.startsWith("PPX1:PRIVATE:")) {
    return {
      errorCorrectionLevel: "L" as const,
      margin: 2,
      width: 1_024,
      color: { dark: "#172033", light: "#ffffff" },
    };
  }
  return {
    errorCorrectionLevel: "H" as const,
    margin: 2,
    width: 512,
    color: { dark: "#172033", light: "#ffffff" },
  };
}

export function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, qrRenderOptions(text));
}
