import { loadZxingBrowser } from "./zxing";

export const QR_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const QR_IMAGE_MAX_DIMENSION = 4096;
export const QR_IMAGE_MAX_PIXELS = 16_777_216;

function uint16Le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function uint16Be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function uint24Le(bytes: Uint8Array, offset: number): number {
  return uint16Le(bytes, offset) | ((bytes[offset + 2] ?? 0) << 16);
}

function uint32Be(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) * 0x1000000 +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  );
}

function jpegDimensions(bytes: Uint8Array): [number, number] | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] ?? 0;
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const segmentLength = uint16Be(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) {
      return null;
    }
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return [uint16Be(bytes, offset + 5), uint16Be(bytes, offset + 3)];
    }
    offset += segmentLength;
  }
  return null;
}

export function readQrImageDimensions(
  bytes: Uint8Array,
): [number, number] | null {
  if (
    bytes.byteLength >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return [uint32Be(bytes, 16), uint32Be(bytes, 20)];
  }
  if (
    bytes.byteLength >= 10 &&
    (new TextDecoder().decode(bytes.slice(0, 6)) === "GIF87a" ||
      new TextDecoder().decode(bytes.slice(0, 6)) === "GIF89a")
  ) {
    return [uint16Le(bytes, 6), uint16Le(bytes, 8)];
  }
  const jpeg = jpegDimensions(bytes);
  if (jpeg) return jpeg;
  if (
    bytes.byteLength >= 30 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  ) {
    const kind = new TextDecoder().decode(bytes.slice(12, 16));
    if (kind === "VP8X") {
      return [uint24Le(bytes, 24) + 1, uint24Le(bytes, 27) + 1];
    }
    if (kind === "VP8L" && bytes[20] === 0x2f) {
      const bits =
        (bytes[21] ?? 0) |
        ((bytes[22] ?? 0) << 8) |
        ((bytes[23] ?? 0) << 16) |
        ((bytes[24] ?? 0) << 24);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    if (
      kind === "VP8 " &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    ) {
      return [uint16Le(bytes, 26) & 0x3fff, uint16Le(bytes, 28) & 0x3fff];
    }
  }
  return null;
}

export async function validateQrImageFile(file: File): Promise<void> {
  if (file.size < 10 || file.size > QR_IMAGE_MAX_BYTES) {
    throw new Error("QR image byte size is outside the supported bounds");
  }
  const header = new Uint8Array(
    await file.slice(0, Math.min(file.size, 64 * 1024)).arrayBuffer(),
  );
  const dimensions = readQrImageDimensions(header);
  if (!dimensions) throw new Error("Unsupported or malformed QR image");
  const [width, height] = dimensions;
  if (
    width < 1 ||
    height < 1 ||
    width > QR_IMAGE_MAX_DIMENSION ||
    height > QR_IMAGE_MAX_DIMENSION ||
    width * height > QR_IMAGE_MAX_PIXELS
  ) {
    throw new Error("QR image dimensions are outside the supported bounds");
  }
}

export async function scanQrImage(
  source: string | HTMLImageElement,
): Promise<string> {
  const { BrowserQRCodeReader } = await loadZxingBrowser();
  const reader = new BrowserQRCodeReader();
  const result: unknown =
    typeof source === "string"
      ? await reader.decodeFromImageUrl(source)
      : await reader.decodeFromImageElement(source);
  if (typeof result !== "object" || result === null || !("getText" in result)) {
    throw new Error("QR scanner returned an invalid result");
  }
  const getText: unknown = result.getText;
  if (typeof getText !== "function") {
    throw new Error("QR scanner returned an invalid result");
  }
  const decoded: unknown = getText.call(result);
  if (typeof decoded !== "string") {
    throw new Error("QR scanner returned an invalid result");
  }
  return decoded;
}

export async function scanQrFile(file: File): Promise<string> {
  await validateQrImageFile(file);
  const url = URL.createObjectURL(file);
  try {
    return await scanQrImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
