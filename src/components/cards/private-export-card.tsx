import { QrView } from "../qr/qr-view";
import { downloadBlob } from "../media/blob-url";

interface PrivateExportCardProps {
  title: string;
  warning: string;
  qrText: string;
  authorityLabel: string;
  qrLabel: string;
  formatHint?: string;
  fileBytes?: Uint8Array;
  downloadLabel?: string;
}

export function PrivateExportCard({
  title,
  warning,
  qrText,
  authorityLabel,
  qrLabel,
  formatHint,
  fileBytes,
  downloadLabel,
}: PrivateExportCardProps) {
  const download = () => {
    if (!fileBytes) return;
    downloadBlob(
      new Blob([Uint8Array.from(fileBytes).buffer], {
        type: "application/x-ppx-vault",
      }),
      "chat-nocontrol-private.ppxvault",
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
      <QrView text={qrText} label={qrLabel} />
      <code class="qr-fallback">{qrText}</code>
      {fileBytes && downloadLabel && (
        <button class="button secondary" type="button" onClick={download}>
          {downloadLabel}
        </button>
      )}
    </article>
  );
}
