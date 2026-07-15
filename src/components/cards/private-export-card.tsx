import { useEffect, useRef, useState } from "preact/hooks";
import { TextField } from "../forms/text-field";
import { QrView } from "../qr/qr-view";
import { downloadBlob, downloadDataUrl } from "../media/blob-url";
import { generateQrDataUrl } from "../qr/generate";

interface PrivateExportCardProps {
  title: string;
  warning: string;
  qrText: string;
  authorityLabel: string;
  qrLabel: string;
  qrDownloadLabel: string;
  formatHint?: string;
  fileBytes?: Uint8Array;
  downloadLabel?: string;
  verification: {
    lockedLabel: string;
    passphraseLabel: string;
    revealLabel: string;
    busyLabel: string;
    errorLabel: string;
    onVerify: (passphrase: string, signal: AbortSignal) => Promise<boolean>;
  };
}

export function PrivateExportCard({
  title,
  warning,
  qrText,
  authorityLabel,
  qrLabel,
  qrDownloadLabel,
  formatHint,
  fileBytes,
  downloadLabel,
  verification,
}: PrivateExportCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const verificationGeneration = useRef(0);
  const verificationController = useRef<AbortController | null>(null);
  const passphraseBytes = new TextEncoder().encode(passphrase).byteLength;

  const reset = () => {
    verificationGeneration.current += 1;
    verificationController.current?.abort();
    verificationController.current = null;
    setRevealed(false);
    setPassphrase("");
    setError("");
    setBusy(false);
  };

  useEffect(() => {
    const hidePrivateExports = () => {
      if (document.visibilityState === "hidden") reset();
    };
    document.addEventListener("visibilitychange", hidePrivateExports);
    return () => {
      document.removeEventListener("visibilitychange", hidePrivateExports);
      verificationGeneration.current += 1;
      verificationController.current?.abort();
      verificationController.current = null;
    };
  }, []);

  const reveal = async () => {
    if (passphraseBytes < 1 || passphraseBytes > 256) return;
    const generation = verificationGeneration.current + 1;
    verificationGeneration.current = generation;
    verificationController.current?.abort();
    const controller = new AbortController();
    verificationController.current = controller;
    setBusy(true);
    setError("");
    try {
      const verified = await verification.onVerify(
        passphrase,
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        verificationGeneration.current !== generation
      ) {
        return;
      }
      if (!verified) {
        setError(verification.errorLabel);
        return;
      }
      setRevealed(true);
      setPassphrase("");
    } catch {
      if (
        !controller.signal.aborted &&
        verificationGeneration.current === generation
      ) {
        setError(verification.errorLabel);
      }
    } finally {
      if (verificationGeneration.current === generation) {
        verificationController.current = null;
        setBusy(false);
      }
    }
  };

  const download = () => {
    if (!fileBytes) return;
    downloadBlob(
      new Blob([Uint8Array.from(fileBytes).buffer], {
        type: "application/x-ppx-vault",
      }),
      "chat-nocontrol-private.ppxvault",
    );
  };
  const downloadQr = async () => {
    downloadDataUrl(
      await generateQrDataUrl(qrText),
      qrText.startsWith("PPX1:RECOVERY:")
        ? "chat-nocontrol-private-recovery-qr.png"
        : "chat-nocontrol-private-vault-qr.png",
    );
  };

  return (
    <article
      class="export-card private-card"
      aria-labelledby="private-card-title"
    >
      <p class="card-authority">{authorityLabel}</p>
      <h2 id="private-card-title">{title}</h2>
      <p class="card-warning" role="alert">
        <span aria-hidden="true">!</span> {warning}
      </p>
      {formatHint && <p class="card-format">{formatHint}</p>}
      {revealed ? (
        <>
          <QrView text={qrText} label={qrLabel} />
          <button
            class="button secondary qr-download"
            type="button"
            onClick={() => void downloadQr()}
          >
            {qrDownloadLabel}
          </button>
          <code class="qr-fallback">{qrText}</code>
          {fileBytes && downloadLabel && (
            <button class="button secondary" type="button" onClick={download}>
              {downloadLabel}
            </button>
          )}
        </>
      ) : (
        <form
          class="private-export-gate"
          onSubmit={(event) => {
            event.preventDefault();
            void reveal();
          }}
        >
          <div class="private-export-placeholder">
            <span class="private-export-blur" aria-hidden="true" />
            <strong>{verification.lockedLabel}</strong>
          </div>
          <TextField
            id="private-export-passphrase"
            label={verification.passphraseLabel}
            type="password"
            value={passphrase}
            disabled={busy}
            error={error}
            onInput={setPassphrase}
          />
          <button
            class="button secondary"
            type="submit"
            disabled={busy || passphraseBytes < 1 || passphraseBytes > 256}
          >
            {busy ? verification.busyLabel : verification.revealLabel}
          </button>
        </form>
      )}
    </article>
  );
}
