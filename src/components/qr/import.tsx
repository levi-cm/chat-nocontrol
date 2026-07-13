import { useEffect, useRef, useState } from "preact/hooks";
import type { MessageKey } from "../../i18n";
import { scanQrFile } from "./scan";
import { loadZxingBrowser, type ScannerControls } from "./zxing";
import { classifyScannedQrInWorker } from "../../workers/scan-client";

interface QrScanner {
  decodeFromVideoDevice(
    deviceId: string | undefined,
    video: HTMLVideoElement | undefined,
    callback: (
      result: unknown,
      error: unknown,
      controls: ScannerControls,
    ) => void,
  ): Promise<ScannerControls>;
}

function readQrText(result: unknown): string | null {
  if (typeof result !== "object" || result === null || !("getText" in result)) {
    return null;
  }
  const getText: unknown = result.getText;
  if (typeof getText !== "function") return null;
  const value: unknown = getText.call(result);
  return typeof value === "string" ? value : null;
}

export function QrImport({
  idPrefix,
  t,
  onDecoded,
  createScanner,
  scanFilePayload = scanQrFile,
  classifyPayload = classifyScannedQrInWorker,
}: {
  idPrefix: string;
  t: (key: MessageKey) => string;
  onDecoded: (value: string) => void;
  createScanner?: () => Promise<QrScanner>;
  scanFilePayload?: (file: File) => Promise<string>;
  classifyPayload?: (raw: string) => Promise<unknown>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<ScannerControls | null>(null);
  const mounted = useRef(true);
  const cameraGeneration = useRef(0);
  const fileGeneration = useRef(0);
  const [scanning, setScanning] = useState(false);
  const [scanningFile, setScanningFile] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = () => {
    cameraGeneration.current += 1;
    controls.current?.stop();
    controls.current = null;
    setScanning(false);
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cameraGeneration.current += 1;
      fileGeneration.current += 1;
      controls.current?.stop();
      controls.current = null;
    };
  }, []);

  const scanFile = async (file: File | undefined) => {
    if (!file) return;
    const generation = fileGeneration.current + 1;
    fileGeneration.current = generation;
    setError("");
    setScanningFile(true);
    try {
      const value = await scanFilePayload(file);
      await classifyPayload(value);
      if (mounted.current && fileGeneration.current === generation) {
        onDecoded(value);
      }
    } catch {
      if (mounted.current && fileGeneration.current === generation) {
        setError(t("qrScanError"));
      }
    } finally {
      if (mounted.current && fileGeneration.current === generation) {
        setScanningFile(false);
      }
    }
  };

  const startCamera = async () => {
    const generation = cameraGeneration.current + 1;
    cameraGeneration.current = generation;
    setError("");
    setScanning(true);
    try {
      const reader = createScanner
        ? await createScanner()
        : await loadZxingBrowser().then(
            ({ BrowserQRCodeReader }) => new BrowserQRCodeReader(),
          );
      if (!mounted.current || cameraGeneration.current !== generation) return;
      const scanner = await reader.decodeFromVideoDevice(
        undefined,
        video.current ?? undefined,
        (
          result: unknown,
          _error: unknown,
          scannerControls: ScannerControls,
        ) => {
          if (!mounted.current || cameraGeneration.current !== generation) {
            scannerControls.stop();
            return;
          }
          const value = readQrText(result);
          if (value === null) return;
          scannerControls.stop();
          controls.current = null;
          if (mounted.current) setScanning(false);
          void classifyPayload(value)
            .then(() => {
              if (mounted.current && cameraGeneration.current === generation) {
                onDecoded(value);
              }
            })
            .catch(() => {
              if (mounted.current && cameraGeneration.current === generation) {
                setError(t("qrScanError"));
              }
            });
        },
      );
      if (!mounted.current || cameraGeneration.current !== generation)
        scanner.stop();
      else controls.current = scanner;
    } catch {
      if (mounted.current && cameraGeneration.current === generation) {
        setScanning(false);
        setError(t("cameraUnavailable"));
      }
    }
  };

  return (
    <section class="qr-import" aria-labelledby={`${idPrefix}-qr-title`}>
      <h2 id={`${idPrefix}-qr-title`}>{t("scanQrTitle")}</h2>
      <div class="field">
        <label for={`${idPrefix}-qr-file`}>{t("qrImage")}</label>
        <input
          id={`${idPrefix}-qr-file`}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={scanning}
          onChange={(event) => void scanFile(event.currentTarget.files?.[0])}
        />
      </div>
      <video
        ref={video}
        class="qr-video"
        hidden={!scanning}
        muted
        playsInline
        aria-label={t("cameraPreview")}
      />
      <div class="action-row">
        {!scanning ? (
          <button
            class="button secondary"
            type="button"
            disabled={scanningFile}
            onClick={() => void startCamera()}
          >
            {t("scanWithCamera")}
          </button>
        ) : (
          <button class="button secondary" type="button" onClick={stopCamera}>
            {t("stopCamera")}
          </button>
        )}
      </div>
      {error && (
        <p class="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
