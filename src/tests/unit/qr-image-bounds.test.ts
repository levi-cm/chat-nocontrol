import { describe, expect, it } from "vitest";
import {
  QR_IMAGE_MAX_BYTES,
  readQrImageDimensions,
  validateQrImageFile,
} from "../../components/qr/scan";

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function lossyWebpHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBP"), 8);
  bytes.set(new TextEncoder().encode("VP8 "), 12);
  bytes.set([0x9d, 0x01, 0x2a], 23);
  const view = new DataView(bytes.buffer);
  view.setUint16(26, width, true);
  view.setUint16(28, height, true);
  return bytes;
}

describe("QR image bounds", () => {
  it("reads PNG dimensions without decoding pixels", () => {
    expect(readQrImageDimensions(pngHeader(640, 480))).toEqual([640, 480]);
  });

  it("reads standard lossy WebP VP8 frame dimensions", () => {
    expect(readQrImageDimensions(lossyWebpHeader(640, 480))).toEqual([
      640, 480,
    ]);
  });

  it("rejects excessive dimensions before scanner decode", async () => {
    await expect(
      validateQrImageFile(
        new File(
          [Uint8Array.from(pngHeader(50_000, 50_000)).buffer],
          "bomb.png",
          {
            type: "image/png",
          },
        ),
      ),
    ).rejects.toThrow("dimensions");
  });

  it("rejects excessive encoded byte size", async () => {
    const fake = {
      size: QR_IMAGE_MAX_BYTES + 1,
      slice: () => new Blob(),
    } as File;
    await expect(validateQrImageFile(fake)).rejects.toThrow("byte size");
  });
});
