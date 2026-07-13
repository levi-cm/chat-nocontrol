import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { downloadBlob } from "../../components/media/blob-url";
import { createSenderSigningCapability } from "../../crypto/identity";
import type { Locale, MessageKey } from "../../i18n";
import { formatLocalNumber } from "../../i18n/format";
import { PPXF_FILE_MAX_BYTES } from "../../protocol/ppxf-header";
import type {
  DerivedIdentity,
  EncryptedFileBlobOutput,
  PublicContact,
} from "../../protocol/types";
import {
  FileWorkerCancelled,
  type FileWorkerJob,
  startEncryptFileJob,
} from "../../workers/file-client";

interface FileProgress {
  completed: number;
  total: number;
}

interface CompletedFile {
  blob: Blob;
  filename: string;
}

function downloadEncryptedFile(filename: string, blob: Blob): void {
  downloadBlob(blob, `${filename}.ppxfile`);
}

export function EncryptFileFlow({
  t,
  identity,
  sender,
  recipient,
  locale,
  onBusyChange,
}: {
  t: (key: MessageKey) => string;
  identity: DerivedIdentity;
  sender: PublicContact;
  recipient: PublicContact | null;
  locale: Locale;
  onBusyChange: (busy: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<FileProgress | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [completed, setCompleted] = useState<CompletedFile | null>(null);
  const job = useRef<FileWorkerJob<EncryptedFileBlobOutput> | null>(null);
  const captionBytes = useMemo(
    () => new TextEncoder().encode(caption).byteLength,
    [caption],
  );
  const shareFile = useMemo(
    () =>
      completed
        ? new File([completed.blob], `${completed.filename}.ppxfile`, {
            type: "application/x-ppx-file",
          })
        : null,
    [completed],
  );
  const canShareFile = Boolean(
    shareFile &&
    typeof navigator.share === "function" &&
    navigator.canShare?.({ files: [shareFile] }),
  );

  useEffect(
    () => () => {
      job.current?.cancel();
      job.current = null;
      onBusyChange(false);
    },
    [],
  );

  const chooseFile = (next: File | null) => {
    setStatus("");
    setError("");
    setCompleted(null);
    if (next && BigInt(next.size) > PPXF_FILE_MAX_BYTES) {
      setFile(null);
      setError(t("fileTooLarge"));
      return;
    }
    setFile(next);
  };

  useEffect(() => {
    setCompleted(null);
    setStatus("");
  }, [recipient]);

  const encrypt = async () => {
    if (!file || !recipient) return;
    let operation: FileWorkerJob<EncryptedFileBlobOutput> | null = null;
    setBusy(true);
    onBusyChange(true);
    setProgress({ completed: 0, total: file.size });
    setError("");
    setStatus("");
    setCompleted(null);
    try {
      operation = startEncryptFileJob(
        {
          sender,
          senderSigningCapability: createSenderSigningCapability(identity),
          recipient,
          file,
          filename: file.name,
          mimeHint: file.type || "application/octet-stream",
          caption,
          fileLength: BigInt(file.size),
        },
        (event) =>
          setProgress({
            completed: Number(event.completedBytes),
            total: Number(event.totalBytes),
          }),
      );
      job.current = operation;
      const output = await operation.promise;
      if (job.current !== operation) return;
      setCompleted({ blob: output.blob, filename: file.name });
      setStatus(t("fileEncryptedReady"));
    } catch (caught) {
      if (operation && job.current !== operation) return;
      if (caught instanceof FileWorkerCancelled) {
        setStatus(t("fileCancelled"));
      } else {
        setError(t("fileEncryptError"));
      }
    } finally {
      if (!operation || job.current === operation) {
        job.current = null;
        setBusy(false);
        onBusyChange(false);
        setProgress(null);
      }
    }
  };

  return (
    <section class="file-flow" aria-labelledby="encrypt-file-title">
      <h2 id="encrypt-file-title">{t("encryptFileTitle")}</h2>
      <p class="input-meta">{t("maximumFile")}</p>
      <p class="input-meta">{t("fileRestartNote")}</p>
      <div class="field">
        <label for="file-to-encrypt">{t("fileToEncrypt")}</label>
        <input
          id="file-to-encrypt"
          type="file"
          disabled={busy}
          onChange={(event) =>
            chooseFile(event.currentTarget.files?.item(0) ?? null)
          }
        />
      </div>
      {file && (
        <dl class="file-metadata">
          <dt>{t("fileName")}</dt>
          <dd>{file.name}</dd>
        </dl>
      )}
      <div class="field">
        <label for="file-caption">{t("fileCaption")}</label>
        <textarea
          id="file-caption"
          rows={3}
          disabled={busy}
          value={caption}
          onInput={(event) => {
            setCaption(event.currentTarget.value);
            setCompleted(null);
            setStatus("");
          }}
        />
        <p class="input-meta">
          {t("captionBytes")}: {formatLocalNumber(captionBytes, locale)}.{" "}
          {t("maximumCaption")}
        </p>
        {captionBytes > 16_384 && (
          <p class="field-error" role="alert">
            {t("captionTooLarge")}
          </p>
        )}
      </div>
      {completed && (
        <div class="action-row file-output-actions">
          <button
            class="button secondary"
            type="button"
            onClick={() => {
              downloadEncryptedFile(completed.filename, completed.blob);
              setStatus(t("fileEncryptedDownloaded"));
            }}
          >
            {t("downloadEncryptedFile")}
          </button>
          {canShareFile && shareFile && (
            <button
              class="button secondary"
              type="button"
              onClick={() => {
                void navigator.share({ files: [shareFile] }).catch(() => {
                  // Cancellation or platform refusal is not success.
                });
              }}
            >
              {t("shareEncryptedFile")}
            </button>
          )}
        </div>
      )}
      {progress && (
        <div class="progress-group" role="status">
          <label for="encrypt-file-progress">{t("fileProgress")}</label>
          <progress
            id="encrypt-file-progress"
            max={Math.max(progress.total, 1)}
            value={progress.completed}
          />
          <span class="input-meta">
            {formatLocalNumber(progress.completed, locale)} /{" "}
            {formatLocalNumber(progress.total, locale)} {t("bytes")}
          </span>
          <span class="input-meta">{t("cancelNote")}</span>
        </div>
      )}
      <div class="action-row file-actions">
        <button
          class="button primary"
          type="button"
          disabled={busy || !file || !recipient || captionBytes > 16_384}
          onClick={() => void encrypt()}
        >
          {t("encryptFileLocally")}
        </button>
        {busy && (
          <button
            class="button secondary"
            type="button"
            onClick={() => job.current?.cancel()}
          >
            {t("cancelFileOperation")}
          </button>
        )}
      </div>
      {error && (
        <>
          <p class="field-error" role="alert">
            {error}
          </p>
          <details>
            <summary>{t("technicalDetails")}</summary>
            <p class="input-meta">{t("technicalFailureCode")}</p>
          </details>
        </>
      )}
      {status && (
        <p class="status-note" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
