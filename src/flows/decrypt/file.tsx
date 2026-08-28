import { useEffect, useRef, useState } from "preact/hooks";
import type { ManagedContact } from "../../components/cards/contact-management-card";
import { AuthenticatedSenderCard } from "../../components/cards/authenticated-sender-card";
import { createDecapsulationCapabilityV2 } from "../../crypto/identity-v2";
import {
  createRevocableObjectUrl,
  downloadBlob,
} from "../../components/media/blob-url";
import type { Locale, MessageKey } from "../../i18n";
import { formatLocalNumber } from "../../i18n/format";
import type { ContactSaveMutation } from "../../app/contact-save-queue";
import { PPXError, type DecryptedFileOutput } from "../../protocol/types";
import type {
  DecryptedFileOutputV2,
  DerivedIdentityV2,
} from "../../protocol/types-v2";
import {
  FileWorkerCancelled,
  type FileWorkerJob,
  startDecryptFileJob,
} from "../../workers/file-client";
import {
  LegacyV1WorkerCancelled,
  type LegacyV1WorkerJob,
  startLegacyFileDecryptJob,
} from "../../workers/legacy-v1-client";
import { classifyEncryptedFile } from "./compat-routing";
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

function downloadDecryptedFile(
  result: DecryptedFileOutputV2 | DecryptedFileOutput,
): void {
  downloadBlob(result.blob, result.filename);
}

type FileDecryptResult =
  | { suite: "cat5-v2"; output: DecryptedFileOutputV2 }
  | { suite: "legacy-v1"; output: DecryptedFileOutput };

type DecryptFileJob =
  FileWorkerJob<DecryptedFileOutputV2> | LegacyV1WorkerJob<DecryptedFileOutput>;

export function DecryptFileFlow({
  t,
  identity,
  contacts,
  onContactsChange,
  file,
  startToken,
  onBusyChange,
  cancellationHandle,
  locale,
}: {
  t: (key: MessageKey) => string;
  identity: DerivedIdentityV2;
  contacts: ManagedContact[];
  onContactsChange: (mutation: ContactSaveMutation) => Promise<boolean>;
  file: File | null;
  startToken: number;
  onBusyChange: (busy: boolean) => void;
  cancellationHandle: { current: (() => void) | null };
  locale: Locale;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<FileProgress | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<FileDecryptResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [collision, setCollision] = useState("");
  const [savingSender, setSavingSender] = useState(false);
  const job = useRef<DecryptFileJob | null>(null);

  const cancelActiveFile = () => {
    job.current?.cancel();
    job.current = null;
    setBusy(false);
    onBusyChange(false);
    setProgress(null);
  };

  useEffect(() => {
    cancellationHandle.current = cancelActiveFile;
    return () => {
      if (cancellationHandle.current === cancelActiveFile)
        cancellationHandle.current = null;
    };
  });

  useEffect(
    () => () => {
      job.current?.cancel();
      job.current = null;
      onBusyChange(false);
    },
    [],
  );

  useEffect(() => {
    if (result?.suite !== "cat5-v2" || !previewKind(result.output.mimeHint)) {
      setPreviewUrl("");
      return;
    }
    const objectUrl = createRevocableObjectUrl(result.output.blob);
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
    let operation: DecryptFileJob | null = null;
    let suite: FileDecryptResult["suite"] = "cat5-v2";
    setBusy(true);
    onBusyChange(true);
    setProgress({ completed: 0, total: file.size });
    setResult(null);
    setStatus("");
    setError("");
    try {
      suite = await classifyEncryptedFile(file);
      const onProgress = (event: {
        completedBytes: bigint;
        totalBytes: bigint;
      }) =>
        setProgress({
          completed: Number(event.completedBytes),
          total: Number(event.totalBytes),
        });
      operation =
        suite === "legacy-v1"
          ? startLegacyFileDecryptJob(
              { object: file, masterEntropy: identity.masterEntropy },
              onProgress,
            )
          : startDecryptFileJob(
              {
                object: file,
                activeIdentity: createDecapsulationCapabilityV2(identity),
              },
              onProgress,
            );
      job.current = operation;
      const decrypted = await operation.promise;
      if (job.current !== operation) return;
      setResult(
        suite === "legacy-v1"
          ? { suite, output: decrypted as DecryptedFileOutput }
          : { suite, output: decrypted as DecryptedFileOutputV2 },
      );
    } catch (caught) {
      if (operation && job.current !== operation) return;
      if (
        caught instanceof FileWorkerCancelled ||
        caught instanceof LegacyV1WorkerCancelled
      ) {
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

  const senderSaved =
    result?.suite === "cat5-v2"
      ? isKnownSender(result.output.senderContact.fingerprint, contacts)
      : false;
  const kind =
    result?.suite === "cat5-v2" ? previewKind(result.output.mimeHint) : null;

  const saveFileSender = async () => {
    if (result?.suite !== "cat5-v2" || senderSaved || savingSender) return;
    const output = result.output;
    setSavingSender(true);
    const hasCollision = contacts.some(
      (item) =>
        item.contact.pseudonym === output.senderContact.pseudonym &&
        !isKnownSender(output.senderContact.fingerprint, [item]),
    );
    try {
      const saved = await onContactsChange({
        kind: "add",
        item: {
          contact: output.senderContact,
          nickname: "",
          includeSenderContactInLinks: true,
        },
      });
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
          {result.suite === "legacy-v1" ? (
            <div class="warning-panel" role="status">
              <p>{t("legacyContentNotice")}</p>
              <p class="input-meta">{t("previewUnavailable")}</p>
              <p class="input-meta">
                {t("authenticatedLegacySenderLabel")}:{" "}
                {result.output.senderContact.pseudonym}
              </p>
            </div>
          ) : (
            <AuthenticatedSenderCard
              sender={result.output.senderContact}
              contacts={contacts}
              t={t}
            />
          )}
          <dl class="file-metadata">
            <div>
              <dt>{t("filename")}</dt>
              <dd>{result.output.filename}</dd>
            </div>
            {result.output.caption && (
              <div>
                <dt>{t("caption")}</dt>
                <dd>{result.output.caption}</dd>
              </div>
            )}
          </dl>
          {result.suite === "cat5-v2" && (
            <p class="input-meta">{t("previewAfterAuthentication")}</p>
          )}
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
          {result.suite === "cat5-v2" && !kind && (
            <p class="input-meta">{t("previewUnavailable")}</p>
          )}
          <button
            class="button secondary"
            type="button"
            onClick={() => downloadDecryptedFile(result.output)}
          >
            {t("downloadDecryptedFile")}
          </button>
          {result.suite === "cat5-v2" && !senderSaved && (
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
