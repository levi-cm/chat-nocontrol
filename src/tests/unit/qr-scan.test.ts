import { describe, expect, it, vi } from "vitest";
import {
  createQrCanvasDecoder,
  ZXING_DECODE_HINT_PURE_BARCODE,
  ZXING_DECODE_HINT_TRY_HARDER,
} from "../../components/qr/scan";

describe("QR canvas decoder", () => {
  it("tries the exact pure QR path before the detector fallback", async () => {
    const seenHints: Map<number, unknown>[] = [];
    const decodeFromCanvas = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("not pure");
      })
      .mockReturnValueOnce({ getText: () => "decoded" });
    class Reader {
      constructor(hints = new Map<number, unknown>()) {
        seenHints.push(hints);
      }

      decodeFromCanvas = decodeFromCanvas;
    }

    const decode = createQrCanvasDecoder(Reader);

    await expect(decode(document.createElement("canvas"))).resolves.toBe(
      "decoded",
    );
    expect(seenHints[0]?.get(ZXING_DECODE_HINT_PURE_BARCODE)).toBe(true);
    expect(seenHints[1]?.get(ZXING_DECODE_HINT_TRY_HARDER)).toBe(true);
    expect(decodeFromCanvas).toHaveBeenCalledTimes(2);
  });

  it("does not invoke the detector when the exact QR path succeeds", async () => {
    const decodeFromCanvas = vi.fn().mockReturnValue({
      getText: () => "decoded",
    });
    class Reader {
      decodeFromCanvas = decodeFromCanvas;
    }

    const decode = createQrCanvasDecoder(Reader);

    await expect(decode(document.createElement("canvas"))).resolves.toBe(
      "decoded",
    );
    expect(decodeFromCanvas).toHaveBeenCalledOnce();
  });
});
