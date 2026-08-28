import { afterEach, describe, expect, it, vi } from "vitest";
import {
  priorityQrCropForImage,
  QR_IMAGE_RECOVERY_MAX_MS,
  recoverQrFromImage,
} from "../../components/qr/image-recovery";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("QR image recovery priority crop", () => {
  it("targets the QR square on the generated 4:5 private recovery card", () => {
    expect(priorityQrCropForImage(1024, 1280)).toEqual({
      x: 128,
      y: 256,
      size: 768,
    });
  });

  it("does not assume unrelated image shapes are recovery cards", () => {
    expect(priorityQrCropForImage(1280, 1024)).toBeNull();
    expect(priorityQrCropForImage(1200, 1600)).toBeNull();
  });

  it(
    "bounds a createImageBitmap call that never settles",
    async () => {
      vi.stubGlobal(
        "createImageBitmap",
        () => new Promise<ImageBitmap>(() => undefined),
      );
      const recovery = recoverQrFromImage(
        new File([new Uint8Array([1])], "recovery.png", { type: "image/png" }),
        () => Promise.reject(new Error("decode must not run")),
      );

      await expect(recovery).rejects.toThrow(
        "QR image recovery bounds reached",
      );
    },
    QR_IMAGE_RECOVERY_MAX_MS + 3_000,
  );

  it(
    "bounds QR decoder preparation that never settles",
    async () => {
      const close = vi.fn();
      vi.stubGlobal("createImageBitmap", () =>
        Promise.resolve({ width: 1024, height: 1280, close } as ImageBitmap),
      );

      const recovery = recoverQrFromImage(
        new File([new Uint8Array([1])], "recovery.png", { type: "image/png" }),
        new Promise<() => Promise<string>>(() => undefined),
      );

      await expect(recovery).rejects.toThrow(
        "QR image recovery bounds reached",
      );
      expect(close).toHaveBeenCalledOnce();
    },
    QR_IMAGE_RECOVERY_MAX_MS + 3_000,
  );

  it(
    "bounds a QR decoder call that never settles",
    async () => {
      const close = vi.fn();
      vi.stubGlobal("createImageBitmap", () =>
        Promise.resolve({ width: 1024, height: 1280, close } as ImageBitmap),
      );
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        imageSmoothingEnabled: false,
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D);

      const recovery = recoverQrFromImage(
        new File([new Uint8Array([1])], "recovery.png", { type: "image/png" }),
        () => new Promise<string>(() => undefined),
      );

      await expect(recovery).rejects.toThrow(
        "QR image recovery bounds reached",
      );
      expect(close).toHaveBeenCalledOnce();
    },
    QR_IMAGE_RECOVERY_MAX_MS + 3_000,
  );
});
