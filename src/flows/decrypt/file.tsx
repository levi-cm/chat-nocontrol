import { useEffect, useRef, useState } from "preact/hooks";
import type { ManagedContact } from "../../components/cards/contact-management-card";
import { AuthenticatedSenderCard } from "../../components/cards/authenticated-sender-card";
import {
  createRevocableObjectUrl,
  downloadBlob,
} from "../../components/media/blob-url";
import type { Locale, MessageKey } from "../../i18n";
import { formatLocalNumber } from "../../i18n/format";
import type {
  DecryptedFileOutput,
  DerivedIdentity,
} from "../../protocol/types";
import { PPXError } from "../../protocol/types";
import {
  FileWorkerCancelled,
  type FileWorkerJob,
  startDecryptFileJob,
} from "../../workers/file-client";
import { isKnownSender } from "./sender";

interface FileProgress {
  completed: number;
  total: number;
}

type PreviewKind = "image" | "audio" | "video" | null;

export function previewKind(mimeHint: string): PreviewKind {
  if (
    [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/avif",
    ].includes(mimeHint)
  ) {
    return "image";
  }
  if (
    [
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/wav",
      "audio/webm",
      "audio/flac",
    ].includes(mimeHint)
  )
    return "audio";
  if (["video/mp4", "video/webm"].includes(mimeHint)) return "video";
  return null;
}

function downloadDecryptedFile(result: DecryptedFileOutput): void {
  downloadBlob(result.blob, result.filename);
}

export function DecryptFileFlow({
  t,
  identity,
  contacts,
  onContactsChange,
  file,
  startToken,
  onBusyChange,
  locale,
}: {
  t: (key: MessageKey) => string;
  identity: DerivedIdentity;
  contacts: ManagedContact[];
  onContactsChange: (contacts: ManagedContact[]) => Promise<boolean>;
  file: File | null;
  startToken: number;
  onBusyChange: (busy: boolean) => void;
  locale: Locale;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<FileProgress | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<DecryptedFileOutput | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [collision, setCollision] = useState("");
  const [savingSender, setSavingSender] = useState(false);
  const job = useRef<FileWorkerJob<DecryptedFileOutput> | null>(null);

  useEffect(
    () => () => {
      job.current?.cancel();
      job.current = null;
      onBusyChange(false);
    },
    [],
  );

  useEffect(() => {
    if (!result || !previewKind(result.mimeHint)) {
      setPreviewUrl("");
      return;
    }
    const objectUrl = createRevocableObjectUrl(result.blob);
    setPreviewUrl(objectUrl.url);
    return () => objectUrl.revoke();
  }, [result]);

  useEffect(() => {
    job.current?.cancel();
    job.current = null;
    setBusy(false);
    onBusyChange(false);
    setProgress(null);
    setResult(null);
    setStatus("");
    setError("");
    setCollision("");
  }, [file]);

  const decrypt = async () => {
    if (!file) return;
    let operation: FileWorkerJob<DecryptedFileOutput> | null = null;
    setBusy(true);
    onBusyChange(true);
    setProgress({ completed: 0, total: file.size });
    setResult(null);
    setStatus("");
    setError("");
    try {
      operation = startDecryptFileJob(
        { object: file, activeIdentity: identity },
        (event) =>
          setProgress({
            completed: Number(event.completedBytes),
            total: Number(event.totalBytes),
          }),
      );
      job.current = operation;
      const decrypted = await operation.promise;
      if (job.current !== operation) return;
      setResult(decrypted);
    } catch (caught) {
      if (operation && job.current !== operation) return;
      if (caught instanceof FileWorkerCancelled) {
        setStatus(t("fileCancelled"));
      } else {
        const detail =
          caught instanceof PPXError && caught.code === "invalid-signature"
            ? t("badSignature")
            : t("wrongIdentityOrDamaged");
        setError(`${t("couldNotDecrypt")}. ${detail}`);
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

  useEffect(() => {
    if (startToken > 0 && file) void decrypt();
    // startToken is the explicit one-shot request boundary.
  }, [startToken]);

  const senderSaved = result
    ? isKnownSender(result.senderContact.fingerprint, contacts)
    : false;
  const kind = result ? previewKind(result.mimeHint) : null;

  const saveFileSender = async () => {
    if (!result || senderSaved || savingSender) return;
    setSavingSender(true);
    const hasCollision = contacts.some(
      (item) =>
        item.contact.pseudonym === result.senderContact.pseudonym &&
        !isKnownSender(result.senderContact.fingerprint, [item]),
    );
    try {
      const saved = await onContactsChange([
        ...contacts,
        { contact: result.senderContact, nickname: "" },
      ]);
      if (saved) {
        setCollision(
          hasCollision ? `${t("collisionWarning")}. ${t("collisionNote")}` : "",
        );
      }
    } finally {
      setSavingSender(false);
    }
  };

  return (
    <section class="file-flow" aria-label={t("decryptFileTitle")}>
      {progress && (
        <div class="progress-group" role="status">
          <label for="decrypt-file-progress">{t("fileProgress")}</label>
          <progress
            id="decrypt-file-progress"
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
      {result && (
        <section class="decrypted-result file-result">
          <h3>{t("decryptedFile")}</h3>
          <AuthenticatedSenderCard
            sender={result.senderContact}
            contacts={contacts}
            t={t}
          />
          <dl class="file-metadata">
            <div>
              <dt>{t("filename")}</dt>
              <dd>{result.filename}</dd>
            </div>
            {result.caption && (
              <div>
                <dt>{t("caption")}</dt>
                <dd>{result.caption}</dd>
              </div>
            )}
          </dl>
          <p class="input-meta">{t("previewAfterAuthentication")}</p>
          {previewUrl && kind === "image" && (
            <img class="file-preview" src={previewUrl} alt={t("filePreview")} />
          )}
          {previewUrl && kind === "audio" && (
            <audio controls src={previewUrl} aria-label={t("filePreview")} />
          )}
          {previewUrl && kind === "video" && (
            <video
              class="file-preview"
              controls
              src={previewUrl}
              aria-label={t("filePreview")}
            />
          )}
          {!kind && <p class="input-meta">{t("previewUnavailable")}</p>}
          <button
            class="button secondary"
            type="button"
            onClick={() => downloadDecryptedFile(result)}
          >
            {t("downloadDecryptedFile")}
          </button>
          {!senderSaved && (
            <div class="warning-panel" role="status">
              <h3>{t("unknownSender")}</h3>
              <p>{t("unknownSenderFileText")}</p>
              <button
                class="button secondary"
                type="button"
                disabled={savingSender}
                onClick={() => void saveFileSender()}
              >
                {t("saveSender")}
              </button>
            </div>
          )}
          {collision && (
            <p class="field-error" role="alert">
              {collision}
            </p>
          )}
        </section>
      )}
    </section>
  );
}
