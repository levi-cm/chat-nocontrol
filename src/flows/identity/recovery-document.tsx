import { useEffect, useState } from "preact/hooks";
import {
  createRevocableObjectUrl,
  downloadBlob,
} from "../../components/media/blob-url";
import type { Locale } from "../../i18n";

export function RecoveryPdfPreview({
  bytes,
  filename,
  locale,
  onPrint,
  onDownload,
}: {
  bytes: Uint8Array;
  filename: string;
  locale: Locale;
  onPrint: () => void;
  onDownload: () => void;
}) {
  const [url, setUrl] = useState("");
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 640px)").matches,
  );

  useEffect(() => {
    const ownedUrl = createRevocableObjectUrl(
      new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }),
    );
    setUrl(ownedUrl.url);
    return () => ownedUrl.revoke();
  }, [bytes]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const de = locale === "de";
  return (
    <section
      class="recovery-pdf-preview"
      aria-label={de ? "Wiederherstellungs-PDF" : "Recovery PDF"}
    >
      {mobile ? (
        <p class="recovery-preview-mobile-note">
          {de
            ? "Die A4-Vorschau ist auf kleinen Bildschirmen ausgeblendet. Du kannst dieselbe PDF weiterhin drucken oder herunterladen."
            : "The A4 preview is hidden on small screens. You can still print or download the same PDF."}
        </p>
      ) : (
        url && (
          <iframe
            class="recovery-pdf-frame"
            src={url}
            title="Private recovery PDF preview"
          />
        )
      )}
      <div class="action-row recovery-pdf-actions">
        <a
          class="button secondary"
          href={url || undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={url === ""}
          onClick={(event) => {
            if (!url) {
              event.preventDefault();
              return;
            }
            onPrint();
          }}
        >
          {de ? "Drucken / Als PDF speichern" : "Print / Save as PDF"}
        </a>
        <button
          class="button secondary"
          type="button"
          disabled={!url}
          onClick={() => {
            downloadBlob(
              new Blob([Uint8Array.from(bytes).buffer], {
                type: "application/pdf",
              }),
              filename,
            );
            onDownload();
          }}
        >
          {de
            ? "Wiederherstellungs-PDF herunterladen"
            : "Download recovery PDF"}
        </button>
      </div>
    </section>
  );
}
