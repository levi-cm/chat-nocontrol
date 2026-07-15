import { QrView } from "../qr/qr-view";
import { downloadBlob, downloadDataUrl } from "../media/blob-url";
import { generateQrDataUrl } from "../qr/generate";

interface PublicContactCardProps {
  pseudonym: string;
  qrText: string;
  authorityLabel: string;
  title: string;
  qrLabel: string;
  qrDownloadLabel: string;
  enlargeQrLabel?: string;
  closeQrLabel?: string;
  helper?: string;
  formatHint?: string;
  fileBytes?: Uint8Array;
  downloadLabel?: string;
  identityId: Uint8Array;
  fingerprint: Uint8Array;
  identityIdLabel: string;
  fingerprintLabel: string;
  fingerprintGuidance: string;
}

export function formatFingerprintBytes(
  value: Uint8Array,
  expectedLength: number,
): string {
  if (value.byteLength !== expectedLength)
    throw new Error("invalid fingerprint");
  return (
    [...value]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .match(/.{1,4}/gu)
      ?.join(" ") ?? ""
  );
}

export function formatIdentityId(identityId: Uint8Array): string {
  return formatFingerprintBytes(identityId, 20);
}

export function PublicContactCard({
  pseudonym,
  qrText,
  authorityLabel,
  title,
  qrLabel,
  qrDownloadLabel,
  enlargeQrLabel,
  closeQrLabel,
  helper,
  formatHint,
  fileBytes,
  downloadLabel,
  identityId,
  fingerprint,
  identityIdLabel,
  fingerprintLabel,
  fingerprintGuidance,
}: PublicContactCardProps) {
  const download = () => {
    if (!fileBytes) return;
    const safeName = pseudonym.replace(/[^\p{L}\p{N}._-]+/gu, "-");
    downloadBlob(
      new Blob([Uint8Array.from(fileBytes).buffer], {
        type: "application/x-ppx-contact",
      }),
      `chat-nocontrol-${safeName}.ppxcontact`,
    );
  };
  const downloadQr = async () => {
    const safeName = pseudonym.replace(/[^\p{L}\p{N}._-]+/gu, "-");
    downloadDataUrl(
      await generateQrDataUrl(qrText),
      `chat-nocontrol-${safeName}-contact-qr.png`,
    );
  };

  return (
    <article
      class="export-card public-card"
      aria-labelledby="public-card-title"
    >
      <p class="card-authority">{authorityLabel}</p>
      <h2 id="public-card-title">{title}</h2>
      <p class="card-pseudonym">{pseudonym}</p>
      {helper && <p>{helper}</p>}
      <p>{fingerprintGuidance}</p>
      <p class="input-meta">{identityIdLabel}</p>
      <code class="identity-id">{formatIdentityId(identityId)}</code>
      <details>
        <summary>{fingerprintLabel}</summary>
        <code class="identity-id">
          {formatFingerprintBytes(fingerprint, 32)}
        </code>
      </details>
      {formatHint && <p class="card-format">{formatHint}</p>}
      <QrView
        text={qrText}
        label={qrLabel}
        enlargeLabel={enlargeQrLabel}
        closeLabel={closeQrLabel}
      />
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
    </article>
  );
}
