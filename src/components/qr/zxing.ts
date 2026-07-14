import zxingBrowserUrl from "@zxing/browser/umd/zxing-browser.min.js?url";

export interface ScannerControls {
  stop(): void;
}

interface QrResult {
  getText(): string;
}

export interface QrReader {
  decodeFromImageUrl(source: string): Promise<QrResult>;
  decodeFromImageElement(source: HTMLImageElement): Promise<QrResult>;
  decodeFromCanvas(source: HTMLCanvasElement): QrResult;
  decodeFromVideoDevice(
    deviceId: string | undefined,
    preview: HTMLVideoElement | undefined,
    callback: (
      result: QrResult | undefined,
      error: unknown,
      controls: ScannerControls,
    ) => void,
  ): Promise<ScannerControls>;
}

interface ZxingBrowserGlobal {
  BrowserQRCodeReader: new () => QrReader;
}

declare global {
  interface Window {
    ZXingBrowser?: ZxingBrowserGlobal;
  }
}

let loadPromise: Promise<ZxingBrowserGlobal> | null = null;

export function loadZxingBrowser(): Promise<ZxingBrowserGlobal> {
  if (window.ZXingBrowser) return Promise.resolve(window.ZXingBrowser);
  loadPromise ??= new Promise<ZxingBrowserGlobal>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = zxingBrowserUrl;
    script.async = true;
    script.addEventListener("load", () => {
      if (window.ZXingBrowser) resolve(window.ZXingBrowser);
      else reject(new Error("ZXing browser bundle did not initialize"));
    });
    script.addEventListener("error", () =>
      reject(new Error("ZXing browser bundle could not load")),
    );
    document.head.append(script);
  });
  return loadPromise;
}
