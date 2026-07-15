import { useEffect, useRef, useState } from "preact/hooks";
import type { MessageKey } from "../../i18n";
import { scanQrFile } from "./scan";
import { loadZxingBrowser, type ScannerControls } from "./zxing";
import { classifyScannedQrInWorker } from "../../workers/scan-client";
import type { QrImportControls } from "../../storage/settings";

interface QrScanner {
  decodeFromConstraints?(
    constraints: MediaStreamConstraints,
    video: HTMLVideoElement | undefined,
    callback: (
      result: unknown,
      error: unknown,
      controls: ScannerControls,
    ) => void,
  ): Promise<ScannerControls>;
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

export type CameraCapability = "available" | "insecure-context" | "unsupported";

export function cameraCapability(): CameraCapability {
  if (!window.isSecureContext) return "insecure-context";
  if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
    return "unsupported";
  }
  return "available";
}

function cameraFailureMessage(error: unknown): MessageKey {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String(error.name)
      : "";
  if (name === "NotAllowedError") return "cameraPermissionDenied";
  if (name === "NotFoundError") return "cameraNotFound";
  if (name === "NotReadableError") return "cameraBusy";
  return "cameraUnavailable";
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
  controlsMode = "both",
}: {
  idPrefix: string;
  t: (key: MessageKey) => string;
  onDecoded: (value: string) => void;
  createScanner?: () => Promise<QrScanner>;
  scanFilePayload?: (file: File) => Promise<string>;
  classifyPayload?: (raw: string) => Promise<unknown>;
  controlsMode?: QrImportControls;
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
    const capability = cameraCapability();
    if (capability !== "available") {
      setError(
        t(
          capability === "insecure-context"
            ? "cameraInsecureContext"
            : "cameraUnavailable",
        ),
      );
      return;
    }
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
      const preview = video.current ?? undefined;
      const onResult = (
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
      };
      let scanner: ScannerControls;
      try {
        if (!reader.decodeFromConstraints)
          throw new Error("constraints unavailable");
        scanner = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          },
          preview,
          onResult,
        );
      } catch {
        if (!mounted.current || cameraGeneration.current !== generation) return;
        scanner = await reader.decodeFromVideoDevice(
          undefined,
          preview,
          onResult,
        );
      }
      if (!mounted.current || cameraGeneration.current !== generation)
        scanner.stop();
      else controls.current = scanner;
    } catch (caught) {
      if (mounted.current && cameraGeneration.current === generation) {
        setScanning(false);
        setError(t(cameraFailureMessage(caught)));
      }
    }
  };

  return (
    <section class="qr-import" aria-labelledby={`${idPrefix}-qr-title`}>
      <h2 id={`${idPrefix}-qr-title`}>{t("scanQrTitle")}</h2>
      {controlsMode !== "camera" && (
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
      )}
      {scanning && (
        <video
          ref={video}
          class="qr-video"
          muted
          playsInline
          aria-label={t("cameraPreview")}
        />
      )}
      {controlsMode !== "image" && (
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
      )}
      {error && (
        <p class="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
