import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ManagedContact } from "../../components/cards/contact-management-card";
import { displayIdentityId } from "../../components/cards/contact-management-card";
import { downloadBlob } from "../../components/media/blob-url";
import {
  generateMessageQrPng,
  prepareMessageQr,
  type MessageQrCapacity,
  type MessageQrTransport,
} from "../../components/qr/message";
import { QrActionIcon } from "../../components/navigation/qr-icon";
import { PasteButton } from "../../components/forms/paste-button";
import { copyWithBestEffortClear } from "../identity/clipboard";
import { createSenderSigningCapability } from "../../crypto/identity";
import type { Locale, MessageKey } from "../../i18n";
import { formatLocalNumber } from "../../i18n/format";
import { encodeTextArmor } from "../../protocol/ppxt-armor";
import { encodeEncryptedQrText } from "../../protocol/ppxq-outer";
import type {
  DerivedIdentity,
  EncryptedQrTextObject,
  PublicContact,
} from "../../protocol/types";
import {
  type CryptoWorkerJob,
  startEncryptTextJob,
  startEncryptQrTextJob,
} from "../../workers/crypto-client";
import type { EncryptedTextObject } from "../../protocol/types";
import type { QrExportMode } from "../../storage/settings";
import { EncryptFileFlow } from "./file";

function fingerprintId(value: Uint8Array): string {
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function EncryptTextFlow({
  t,
  identity,
  sender,
  contacts,
  locale,
  messageQrCreationEnabled,
  qrExportMode,
}: {
  t: (key: MessageKey) => string;
  identity: DerivedIdentity | null;
  sender: PublicContact | null;
  contacts: ManagedContact[];
  locale: Locale;
  messageQrCreationEnabled: boolean;
  qrExportMode: QrExportMode;
}) {
  const [recipientId, setRecipientId] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [plaintext, setPlaintext] = useState("");
  const [output, setOutput] = useState("");
  const [qrOutput, setQrOutput] = useState<EncryptedQrTextObject | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<"text" | "file">("text");
  const [fileBusy, setFileBusy] = useState(false);
  const job = useRef<CryptoWorkerJob<EncryptedTextObject> | null>(null);
  const qrJob = useRef<CryptoWorkerJob<EncryptedQrTextObject> | null>(null);
  const outputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(
    () => () => {
      job.current?.cancel();
      job.current = null;
      qrJob.current?.cancel();
      qrJob.current = null;
    },
    [],
  );
  const usedBytes = useMemo(
    () => new TextEncoder().encode(plaintext).byteLength,
    [plaintext],
  );
  const visibleContacts = useMemo(() => {
    const query = recipientSearch.normalize("NFKC").trim().toLowerCase();
    if (query === "") return contacts;
    return contacts.filter((item) =>
      `${item.contact.pseudonym} ${item.nickname} ${fingerprintId(item.contact.fingerprint)}`
        .toLowerCase()
        .includes(query),
    );
  }, [contacts, recipientSearch]);
  const recipient = contacts.find(
    (item) => fingerprintId(item.contact.fingerprint) === recipientId,
  )?.contact;
  const qrCapacities = useMemo(() => {
    if (!qrOutput) return null;
    const bytes = encodeEncryptedQrText(qrOutput);
    const appBase =
      window.location.protocol === "https:"
        ? `${window.location.origin}${import.meta.env.BASE_URL}`
        : "https://levi-cm.github.io/chat-nocontrol/";
    return {
      app: prepareMessageQr(bytes, "app", appBase),
      link: prepareMessageQr(bytes, "link", appBase),
    };
  }, [qrOutput]);

  if (!identity || !sender) {
    return (
      <section class="flow-panel">
        <h1>{t("encryptTitle")}</h1>
        <p>{t("identityRequired")}</p>
      </section>
    );
  }
  if (contacts.length === 0) {
    return (
      <section class="flow-panel">
        <h1>{t("encryptTitle")}</h1>
        <p>{t("noContactsYet")}</p>
      </section>
    );
  }

  const encrypt = async () => {
    if (!recipient) return;
    let operation: CryptoWorkerJob<EncryptedTextObject> | null = null;
    let compactOperation: CryptoWorkerJob<EncryptedQrTextObject> | null = null;
    setBusy(true);
    setError("");
    setStatus("");
    setOutput("");
    setQrOutput(null);
    try {
      const now = BigInt(Math.floor(Date.now() / 1000));
      const messageId = crypto.getRandomValues(new Uint8Array(16));
      operation = startEncryptTextJob({
        sender,
        senderSigningCapability: createSenderSigningCapability(identity),
        recipient,
        plaintext,
        messageId,
        sentAt: now,
        createdAt: now,
      });
      job.current = operation;
      const object = await operation.promise;
      if (job.current !== operation) return;
      setOutput(encodeTextArmor(object));
      if (messageQrCreationEnabled)
        try {
          compactOperation = startEncryptQrTextJob({
            sender,
            senderSigningCapability: createSenderSigningCapability(identity),
            recipient,
            plaintext,
            messageId: Uint8Array.from(messageId),
            sentAt: now,
            createdAt: now,
          });
          qrJob.current = compactOperation;
          void compactOperation.promise
            .then((compact) => {
              if (qrJob.current === compactOperation) setQrOutput(compact);
            })
            .catch(() => undefined)
            .finally(() => {
              if (qrJob.current === compactOperation) qrJob.current = null;
            });
        } catch {
          // PPXT remains successful when optional compact QR generation is unavailable.
        }
    } catch {
      if (!operation || job.current === operation)
        setError(t("couldNotEncrypt"));
    } finally {
      if (!operation || job.current === operation) {
        job.current = null;
        setBusy(false);
      }
    }
  };

  const cancel = () => {
    const operation = job.current;
    job.current = null;
    operation?.cancel();
    qrJob.current?.cancel();
    qrJob.current = null;
    setBusy(false);
    setStatus(t("operationCancelled"));
  };

  const downloadQr = async (
    transport: MessageQrTransport,
    capacity: Extract<MessageQrCapacity, { fits: true }>,
  ) => {
    const blob = await generateMessageQrPng(capacity);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
    downloadBlob(blob, `encrypted-message-${transport}-${stamp}.png`);
  };

  const save = () => {
    downloadBlob(
      new Blob([output], { type: "application/x-ppx-message" }),
      "encrypted.ppxmessage",
    );
  };

  const copy = async () => {
    if (!outputRef.current) return;
    const result = await copyWithBestEffortClear(output, outputRef.current);
    setCopyStatus(
      t(
        result === "copied"
          ? "copySucceeded"
          : result === "selected"
            ? "copySelected"
            : "copyFailed",
      ),
    );
  };

  const share = async () => {
    if (typeof navigator.share !== "function") return;
    try {
      await navigator.share({ title: t("brand"), text: output });
    } catch {
      // User cancellation and platform refusal do not invalidate the output.
    }
  };

  return (
    <section class="flow-panel">
      <h1>{t("encryptTitle")}</h1>
      <div class="field">
        <label for="recipient-search">{t("searchContacts")}</label>
        <input
          id="recipient-search"
          type="search"
          placeholder={t("searchContacts")}
          value={recipientSearch}
          disabled={busy || fileBusy}
          onInput={(event) => {
            setRecipientSearch(event.currentTarget.value);
            setRecipientId("");
            setOutput("");
            setQrOutput(null);
            setCopyStatus("");
            setError("");
          }}
        />
      </div>
      <div class="mode-switch" role="group" aria-label={t("chooseEncryptMode")}>
        <button
          class={
            mode === "text" ? "button secondary active" : "button secondary"
          }
          type="button"
          disabled={busy || fileBusy}
          aria-pressed={mode === "text"}
          onClick={() => setMode("text")}
        >
          {t("textMode")}
        </button>
        <button
          class={
            mode === "file" ? "button secondary active" : "button secondary"
          }
          type="button"
          disabled={busy || fileBusy}
          aria-pressed={mode === "file"}
          onClick={() => setMode("file")}
        >
          {t("fileMode")}
        </button>
      </div>
      <div class="field">
        <label for="recipient">{t("recipient")}</label>
        <select
          id="recipient"
          value={recipientId}
          disabled={busy || fileBusy}
          onChange={(event) => {
            setRecipientId(event.currentTarget.value);
            setOutput("");
            setQrOutput(null);
            setCopyStatus("");
            setError("");
          }}
        >
          <option value="">{t("recipient")}</option>
          {visibleContacts.map((item) => {
            const id = fingerprintId(item.contact.fingerprint);
            const name = item.nickname
              ? `${item.nickname} (${item.contact.pseudonym})`
              : item.contact.pseudonym;
            const collision = contacts.some(
              (candidate) =>
                candidate !== item &&
                candidate.contact.pseudonym === item.contact.pseudonym,
            );
            return (
              <option value={id} key={id}>
                {name} — {t("shortIdentityId")}:{" "}
                {displayIdentityId(item.contact.identityId)}
                {collision ? ` — ${t("collisionWarning")}` : ""}
              </option>
            );
          })}
        </select>
      </div>
      {recipientId === "" && <p class="empty-state">{t("chooseRecipient")}</p>}
      {mode === "text" && (
        <>
          <div class="field">
            <div class="field-heading">
              <label for="encrypt-text">{t("encryptedTextLabel")}</label>
              <PasteButton
                label={t("paste")}
                unavailableLabel={t("pasteUnavailable")}
                failureLabel={t("pasteFailed")}
                disabled={busy}
                onPaste={(value) => {
                  setPlaintext(value);
                  setOutput("");
                  setQrOutput(null);
                  setCopyStatus("");
                  setError("");
                }}
                onError={setError}
              />
            </div>
            <textarea
              class="field-control"
              id="encrypt-text"
              rows={8}
              value={plaintext}
              disabled={busy}
              onInput={(event) => {
                setPlaintext(event.currentTarget.value);
                setOutput("");
                setQrOutput(null);
                setCopyStatus("");
                setError("");
              }}
            />
            <p class="input-meta">
              {t("bytesUsed")}: {formatLocalNumber(usedBytes, locale)}.{" "}
              {t("maximumText")}
            </p>
            <p class="input-meta">{t("textCapabilityNote")}</p>
          </div>
          <button
            class="button primary"
            type="button"
            disabled={
              busy ||
              recipientId === "" ||
              usedBytes === 0 ||
              usedBytes > 262_144
            }
            onClick={() => void encrypt()}
          >
            {t("encryptLocally")}
          </button>
          {busy && (
            <div class="progress-group" role="status">
              <label for="text-encrypt-progress">
                {t("operationProgress")}
              </label>
              <progress id="text-encrypt-progress" />
              <p class="input-meta">{t("cancelNote")}</p>
              <button class="button secondary" type="button" onClick={cancel}>
                {t("cancelOperation")}
              </button>
            </div>
          )}
          {status && (
            <p class="status-note" role="status">
              {status}
            </p>
          )}
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
          {output && (
            <div class="output-panel">
              <label for="encrypted-output">{t("encryptedOutput")}</label>
              <textarea
                ref={outputRef}
                class="field-control mono-output"
                id="encrypted-output"
                rows={10}
                readOnly
                value={output}
              />
              <div class="action-row">
                <button
                  class="button secondary"
                  type="button"
                  onClick={() => void copy()}
                >
                  {t("copyOutput")}
                </button>
                <button class="button secondary" type="button" onClick={save}>
                  {t("saveOutput")}
                </button>
                {typeof navigator.share === "function" && (
                  <button
                    class="button secondary"
                    type="button"
                    onClick={() => void share()}
                  >
                    {t("shareOutput")}
                  </button>
                )}
              </div>
              {copyStatus && (
                <p class="input-meta" role="status">
                  {copyStatus}
                </p>
              )}
              {qrCapacities && (
                <div class="qr-message-actions">
                  <p class="input-meta">{t("qrKnownSenderGuidance")}</p>
                  <div class="action-row">
                    {(["app", "link"] as const).map((transport) => {
                      if (qrExportMode !== "both" && qrExportMode !== transport)
                        return null;
                      const capacity = qrCapacities[transport];
                      return capacity.fits ? (
                        <button
                          class="button secondary"
                          type="button"
                          onClick={() => void downloadQr(transport, capacity)}
                        >
                          <QrActionIcon />
                          {t(
                            transport === "app"
                              ? "downloadAppMessageQr"
                              : "downloadLinkMessageQr",
                          )}
                        </button>
                      ) : (
                        <p class="field-error" role="status">
                          {t("messageQrTooLarge")} {capacity.encodedBytesOver}{" "}
                          {t("messageQrTooLargeSuffix")}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {mode === "file" && (
        <EncryptFileFlow
          t={t}
          identity={identity}
          sender={sender}
          recipient={recipient ?? null}
          locale={locale}
          onBusyChange={setFileBusy}
        />
      )}
    </section>
  );
}
