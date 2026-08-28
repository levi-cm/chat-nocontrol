export const QR_IMAGE_RECOVERY_MAX_ATTEMPTS = 32;
export const QR_IMAGE_RECOVERY_MAX_MS = 2_000;

const cropRatios = [0.75, 0.9, 0.6, 0.45, 0.33, 0.25] as const;
const variants = [
  "color",
  "grayscale",
  "autocontrast",
  "threshold-low",
  "threshold-high",
] as const;

interface QrCrop {
  x: number;
  y: number;
  size: number;
}

function createBoundedImageBitmap(
  file: File,
  started: number,
): Promise<ImageBitmap> {
  const remaining = Math.max(
    1,
    QR_IMAGE_RECOVERY_MAX_MS - (performance.now() - started),
  );
  return new Promise<ImageBitmap>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      settled = true;
      reject(new Error("QR image recovery bounds reached"));
    }, remaining);
    void createImageBitmap(file).then(
      (bitmap) => {
        if (settled) {
          bitmap.close();
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        resolve(bitmap);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(
          error instanceof Error
            ? error
            : new Error("QR image recovery unavailable"),
        );
      },
    );
  });
}

function decodeWithinRecoveryDeadline(
  decode: (canvas: HTMLCanvasElement) => Promise<string>,
  canvas: HTMLCanvasElement,
  started: number,
): Promise<string> {
  const remaining = Math.max(
    1,
    QR_IMAGE_RECOVERY_MAX_MS - (performance.now() - started),
  );
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      settled = true;
      reject(new Error("QR image recovery bounds reached"));
    }, remaining);
    let decoding: Promise<string>;
    try {
      decoding = decode(canvas);
    } catch (error) {
      window.clearTimeout(timeout);
      reject(
        error instanceof Error ? error : new Error("QR decoder unavailable"),
      );
      return;
    }
    void decoding.then(
      (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(
          error instanceof Error ? error : new Error("QR decoder unavailable"),
        );
      },
    );
  });
}

function prepareDecoderWithinRecoveryDeadline(
  decode:
    | ((canvas: HTMLCanvasElement) => Promise<string>)
    | Promise<(canvas: HTMLCanvasElement) => Promise<string>>,
  started: number,
): Promise<(canvas: HTMLCanvasElement) => Promise<string>> {
  const remaining = Math.max(
    1,
    QR_IMAGE_RECOVERY_MAX_MS - (performance.now() - started),
  );
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      settled = true;
      reject(new Error("QR image recovery bounds reached"));
    }, remaining);
    void Promise.resolve(decode).then(
      (prepared) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(prepared);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(
          error instanceof Error ? error : new Error("QR decoder unavailable"),
        );
      },
    );
  });
}

export function priorityQrCropForImage(
  width: number,
  height: number,
): QrCrop | null {
  if (width < 1 || height < 1 || height * 4 !== width * 5) return null;
  return {
    x: width / 8,
    y: height / 5,
    size: (width * 3) / 4,
  };
}

function transformPixels(
  image: ImageData,
  variant: (typeof variants)[number],
): void {
  if (variant === "color") return;
  let minimum = 255;
  let maximum = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    const value = Math.round(
      (image.data[index] as number) * 0.299 +
        (image.data[index + 1] as number) * 0.587 +
        (image.data[index + 2] as number) * 0.114,
    );
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  for (let index = 0; index < image.data.length; index += 4) {
    const value = image.data[index] as number;
    const transformed =
      variant === "autocontrast"
        ? maximum === minimum
          ? value
          : Math.round(((value - minimum) * 255) / (maximum - minimum))
        : variant === "threshold-low"
          ? value >= 112
            ? 255
            : 0
          : variant === "threshold-high"
            ? value >= 144
              ? 255
              : 0
            : value;
    image.data[index] = transformed;
    image.data[index + 1] = transformed;
    image.data[index + 2] = transformed;
  }
}

export async function recoverQrFromImage(
  file: File,
  decode:
    | ((canvas: HTMLCanvasElement) => Promise<string>)
    | Promise<(canvas: HTMLCanvasElement) => Promise<string>>,
): Promise<string> {
  if (typeof createImageBitmap !== "function")
    throw new Error("image recovery unavailable");
  const started = performance.now();
  const bitmapPromise = createBoundedImageBitmap(file, started);
  let bitmap: ImageBitmap;
  let preparedDecode: (canvas: HTMLCanvasElement) => Promise<string>;
  try {
    [bitmap, preparedDecode] = await Promise.all([
      bitmapPromise,
      prepareDecoderWithinRecoveryDeadline(decode, started),
    ]);
  } catch (error) {
    try {
      (await bitmapPromise).close();
    } catch {
      // The bounded bitmap operation already failed and owns no bitmap.
    }
    throw error;
  }
  let attempts = 0;
  try {
    const shortEdge = Math.min(bitmap.width, bitmap.height);
    const priority = priorityQrCropForImage(bitmap.width, bitmap.height);
    const crops: QrCrop[] = [
      ...(priority ? [priority] : []),
      ...cropRatios.map((ratio) => {
        const size = Math.max(1, Math.floor(shortEdge * ratio));
        return {
          x: Math.floor((bitmap.width - size) / 2),
          y: Math.floor((bitmap.height - size) / 2),
          size,
        };
      }),
    ].filter(
      (crop, index, all) =>
        all.findIndex(
          (other) =>
            other.x === crop.x &&
            other.y === crop.y &&
            other.size === crop.size,
        ) === index,
    );
    for (const crop of crops) {
      const scale = Math.max(1, Math.min(4, Math.floor(800 / crop.size)));
      const targetSize = Math.min(800, crop.size * scale);
      for (const variant of variants) {
        attempts += 1;
        if (
          attempts >= QR_IMAGE_RECOVERY_MAX_ATTEMPTS ||
          performance.now() - started > QR_IMAGE_RECOVERY_MAX_MS
        ) {
          throw new Error("QR image recovery bounds reached");
        }
        const canvas = document.createElement("canvas");
        canvas.width = targetSize;
        canvas.height = targetSize;
        try {
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) throw new Error("canvas unavailable");
          context.imageSmoothingEnabled = false;
          context.drawImage(
            bitmap,
            crop.x,
            crop.y,
            crop.size,
            crop.size,
            0,
            0,
            targetSize,
            targetSize,
          );
          if (variant !== "color") {
            const pixels = context.getImageData(0, 0, targetSize, targetSize);
            try {
              transformPixels(pixels, variant);
              context.putImageData(pixels, 0, 0);
            } finally {
              pixels.data.fill(0);
            }
          }
          try {
            return await decodeWithinRecoveryDeadline(
              preparedDecode,
              canvas,
              started,
            );
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "QR image recovery bounds reached"
            ) {
              throw error;
            }
            // Continue through the fixed bounded recovery matrix.
          }
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error("QR image recovery failed");
}
