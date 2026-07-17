import { useEffect, useRef, useState } from "preact/hooks";
import type { ManagedContact } from "../../components/cards/contact-management-card";
import { AuthenticatedSenderCard } from "../../components/cards/authenticated-sender-card";
import { PasteButton } from "../../components/forms/paste-button";
import { createDecapsulationCapabilityV2 } from "../../crypto/identity-v2";
import { copyWithBestEffortClear } from "../identity/clipboard";
import type { Locale, MessageKey } from "../../i18n";
import {
  decodeTextArmorV2,
  PPXT_V2_ARMOR_MAXIMUM_CHARS,
} from "../../protocol/ppxt-armor-v2";
import { PPXF_V2_ENCODED_MAX_BYTES } from "../../protocol/ppxf-v2";
import { PPXError } from "../../protocol/types";
import type {
  DecryptedTextOutputV2,
  DerivedIdentityV2,
  EncryptedTextObjectV2,
} from "../../protocol/types-v2";
import type { IncomingMessageIntentV2 } from "../../protocol/message-link-v2";
import { parseIncomingMessageText } from "../../app/incoming-link-input";
import type { ContactSaveMutation } from "../../app/contact-save-queue";
import {
  type CryptoWorkerJob,
  startDecryptTextJob,
} from "../../workers/crypto-client";
import { DecryptFileFlow } from "./file";
import { isKnownSender } from "./sender";

export { isKnownSender } from "./sender";

export function DecryptFlow({
  t,
  identity,
  contacts,
  onContactsChange,
  locale,
  autoDecryptIncomingMessages,
  pendingIncomingIntent,
  onPendingIncomingConsumed,
  cancellationHandle,
  incomingSharedText,
  onIncomingSharedTextConsumed,
}: {
  t: (key: MessageKey) => string;
  identity: DerivedIdentityV2 | null;
  contacts: ManagedContact[];
  onContactsChange: (mutation: ContactSaveMutation) => Promise<boolean>;
  locale: Locale;
  autoDecryptIncomingMessages: boolean;
  pendingIncomingIntent: IncomingMessageIntentV2 | null;
  onPendingIncomingConsumed: (expected?: IncomingMessageIntentV2) => void;
  cancellationHandle: { current: (() => void) | null };
  incomingSharedText?: string | null;
  onIncomingSharedTextConsumed?: () => void;
}) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<DecryptedTextOutputV2 | null>(null);
  const [textInputObject, setTextInputObject] =
    useState<EncryptedTextObjectV2 | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileStartToken, setFileStartToken] = useState(0);
  const [smartError, setSmartError] = useState("");
  const [collisionConfirmation, setCollisionConfirmation] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [status, setStatus] = useState("");
  const [savingSender, setSavingSender] = useState(false);
  const [senderPromptDismissed, setSenderPromptDismissed] = useState(false);
  const [routingBusy, setRoutingBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const routingGeneration = useRef(0);
  const textJob = useRef<CryptoWorkerJob<DecryptedTextOutputV2> | null>(null);
  const fileCancellation = useRef<(() => void) | null>(null);
  const pendingOwnedObject = useRef<EncryptedTextObjectV2 | null>(null);
  const decryptedOutput = useRef<HTMLTextAreaElement | null>(null);

  const cancelActiveDecrypt = () => {
    routingGeneration.current += 1;
    textJob.current?.cancel();
    textJob.current = null;
    pendingOwnedObject.current = null;
    setBusy(false);
    setTextInputObject(null);
    fileCancellation.current?.();
    setFile(null);
    setFileStartToken(0);
    setRoutingBusy(false);
    setStatus("");
  };
  useEffect(() => {
    cancellationHandle.current = cancelActiveDecrypt;
    return () => {
      if (cancellationHandle.current === cancelActiveDecrypt)
        cancellationHandle.current = null;
    };
  });

  useEffect(
    () => () => {
      textJob.current?.cancel();
      textJob.current = null;
      routingGeneration.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (identity) return;
    textJob.current?.cancel();
    textJob.current = null;
    setInput("");
    setFile(null);
    setResult(null);
    setError("");
    setStatus("");
    setCopyStatus("");
    setCollisionConfirmation(false);
    setSaveError("");
    setBusy(false);
    setFileBusy(false);
  }, [identity]);

  useEffect(() => {
    if (!identity || !pendingIncomingIntent) return;
    routingGeneration.current += 1;
    fileCancellation.current?.();
    setFile(null);
    setFileStartToken(0);
    setRoutingBusy(false);
    textJob.current?.cancel();
    textJob.current = null;
    setBusy(false);
    setResult(null);
    setError("");
    setSmartError("");
    if (pendingIncomingIntent.kind === "invalid") {
      setSmartError(t("incomingMessageInvalid"));
      onPendingIncomingConsumed(pendingIncomingIntent);
      return;
    }
    const intent = pendingIncomingIntent;
    pendingOwnedObject.current = intent.object;
    setTextInputObject(intent.object);
    setInput("");
    if (!autoDecryptIncomingMessages) {
      setStatus(t("incomingMessageReady"));
      return () => {
        if (pendingOwnedObject.current !== intent.object) return;
        pendingOwnedObject.current = null;
        setTextInputObject(null);
        setStatus("");
      };
    }
    const operation = startDecryptTextJob({
      object: intent.object,
      activeIdentity: createDecapsulationCapabilityV2(identity),
      knownSenders: contacts.map(({ contact }) => contact),
    });
    textJob.current = operation;
    let completed = false;
    setBusy(true);
    void operation.promise
      .then((output) => {
        if (textJob.current !== operation) return;
        setResult(output);
        setTextInputObject(null);
        pendingOwnedObject.current = null;
        onPendingIncomingConsumed(intent);
        completed = true;
      })
      .catch((caught) => {
        if (textJob.current !== operation) return;
        const detail =
          caught instanceof PPXError && caught.code === "unknown-sender-contact"
            ? t("unknownSender")
            : caught instanceof PPXError &&
                caught.code === "unsupported-compression"
              ? t("unsupportedCompression")
              : t("wrongIdentityOrDamaged");
        setError(`${t("couldNotDecrypt")}. ${detail}`);
      })
      .finally(() => {
        if (textJob.current !== operation) return;
        textJob.current = null;
        setBusy(false);
      });
    return () => {
      if (completed) return;
      if (textJob.current === operation) {
        textJob.current = null;
        operation.cancel();
        setBusy(false);
      }
      if (pendingOwnedObject.current !== intent.object) return;
      pendingOwnedObject.current = null;
      setTextInputObject(null);
      setStatus("");
    };
  }, [autoDecryptIncomingMessages, contacts, identity, pendingIncomingIntent]);

  useEffect(() => {
    if (!identity || !incomingSharedText || pendingIncomingIntent) return;
    onIncomingSharedTextConsumed?.();
    routingGeneration.current += 1;
    fileCancellation.current?.();
    setFile(null);
    setFileStartToken(0);
    setRoutingBusy(false);
    textJob.current?.cancel();
    textJob.current = null;
    setBusy(false);
    setResult(null);
    setCopyStatus("");
    setError("");
    setSmartError("");
    setStatus("");
    let object: EncryptedTextObjectV2;
    try {
      const linked = parseIncomingMessageText(incomingSharedText);
      object = linked?.object ?? decodeTextArmorV2(incomingSharedText.trim());
    } catch {
      setInput(incomingSharedText);
      setTextInputObject(null);
      setSmartError(t("incomingMessageInvalid"));
      return;
    }
    pendingOwnedObject.current = object;
    setInput("");
    setTextInputObject(object);
    setStatus(t("incomingMessageReady"));
    if (!autoDecryptIncomingMessages) {
      return;
    }
    const operation = startDecryptTextJob({
      object,
      activeIdentity: createDecapsulationCapabilityV2(identity),
      knownSenders: contacts.map(({ contact }) => contact),
    });
    textJob.current = operation;
    setBusy(true);
    void operation.promise
      .then((output) => {
        if (textJob.current !== operation) return;
        setResult(output);
        setTextInputObject(null);
        pendingOwnedObject.current = null;
      })
      .catch((caught) => {
        if (textJob.current !== operation) return;
        const detail =
          caught instanceof PPXError && caught.code === "unknown-sender-contact"
            ? t("unknownSender")
            : caught instanceof PPXError &&
                caught.code === "unsupported-compression"
              ? t("unsupportedCompression")
              : t("wrongIdentityOrDamaged");
        setError(`${t("couldNotDecrypt")}. ${detail}`);
      })
      .finally(() => {
        if (textJob.current !== operation) return;
        textJob.current = null;
        setBusy(false);
      });
  }, [
    autoDecryptIncomingMessages,
    contacts,
    identity,
    incomingSharedText,
    onIncomingSharedTextConsumed,
    pendingIncomingIntent,
  ]);

  useEffect(() => {
    setSenderPromptDismissed(false);
    setCollisionConfirmation(false);
    setSaveError("");
  }, [result]);

  if (!identity) {
    return (
      <section class="flow-panel">
        <h1>{t("decryptTitle")}</h1>
        <p>{t("identityRequired")}</p>
      </section>
    );
  }

  const decrypt = async () => {
    let operation: CryptoWorkerJob<DecryptedTextOutputV2> | null = null;
    setBusy(true);
    setResult(null);
    setCopyStatus("");
    setError("");
    setStatus("");
    try {
      operation = startDecryptTextJob({
        object: textInputObject ?? decodeTextArmorV2(input.trim()),
        activeIdentity: createDecapsulationCapabilityV2(identity),
        knownSenders: contacts.map(({ contact }) => contact),
      });
      textJob.current = operation;
      const output = await operation.promise;
      if (textJob.current !== operation) return;
      setResult(output);
      setTextInputObject(null);
      if (
        pendingIncomingIntent?.kind === "ppxt" ||
        pendingIncomingIntent?.kind === "ppxm"
      )
        onPendingIncomingConsumed(pendingIncomingIntent);
    } catch (caught) {
      if (!operation || textJob.current === operation) {
        const detail =
          caught instanceof PPXError && caught.code === "invalid-signature"
            ? t("badSignature")
            : caught instanceof PPXError &&
                caught.code === "unsupported-compression"
              ? t("unsupportedCompression")
              : t("wrongIdentityOrDamaged");
        setError(`${t("couldNotDecrypt")}. ${detail}`);
      }
    } finally {
      if (!operation || textJob.current === operation) {
        textJob.current = null;
        setBusy(false);
      }
    }
  };

  const decryptLinkedText = async (object: EncryptedTextObjectV2) => {
    let operation: CryptoWorkerJob<DecryptedTextOutputV2> | null = null;
    setBusy(true);
    setResult(null);
    setCopyStatus("");
    setError("");
    setStatus("");
    try {
      operation = startDecryptTextJob({
        object,
        activeIdentity: createDecapsulationCapabilityV2(identity),
        knownSenders: contacts.map(({ contact }) => contact),
      });
      textJob.current = operation;
      const output = await operation.promise;
      if (textJob.current !== operation) return;
      setResult(output);
      setTextInputObject(null);
    } catch (caught) {
      if (!operation || textJob.current === operation) {
        const detail =
          caught instanceof PPXError && caught.code === "invalid-signature"
            ? t("badSignature")
            : caught instanceof PPXError &&
                caught.code === "unsupported-compression"
              ? t("unsupportedCompression")
              : t("wrongIdentityOrDamaged");
        setError(`${t("couldNotDecrypt")}. ${detail}`);
      }
    } finally {
      if (!operation || textJob.current === operation) {
        textJob.current = null;
        setBusy(false);
      }
    }
  };

  const cancelText = () => {
    const operation = textJob.current;
    textJob.current = null;
    operation?.cancel();
    pendingOwnedObject.current = null;
    setTextInputObject(null);
    if (pendingIncomingIntent) onPendingIncomingConsumed(pendingIncomingIntent);
    setBusy(false);
    setStatus(t("operationCancelled"));
  };

  const choosePpxfFile = (next: File | null) => {
    pendingOwnedObject.current = null;
    if (pendingIncomingIntent) onPendingIncomingConsumed(pendingIncomingIntent);
    textJob.current?.cancel();
    textJob.current = null;
    setBusy(false);
    setResult(null);
    setError("");
    setSmartError("");
    setCollisionConfirmation(false);
    setSaveError("");
    if (next && next.size > PPXF_V2_ENCODED_MAX_BYTES) {
      setFile(null);
      setSmartError(t("fileTooLarge"));
      return;
    }
    setInput("");
    setFile(next);
  };

  const chooseSmartFile = async (next: File | null) => {
    pendingOwnedObject.current = null;
    if (pendingIncomingIntent) onPendingIncomingConsumed(pendingIncomingIntent);
    textJob.current?.cancel();
    textJob.current = null;
    setBusy(false);
    const generation = routingGeneration.current + 1;
    routingGeneration.current = generation;
    if (!next) {
      choosePpxfFile(null);
      return;
    }
    setRoutingBusy(true);
    setSmartError("");
    try {
      const prefix = new TextDecoder().decode(
        new Uint8Array(await next.slice(0, 40).arrayBuffer()),
      );
      if (routingGeneration.current !== generation) return;
      const isArmor = prefix.startsWith("-----BEGIN PPX ENCRYPTED TEXT-----");
      const isPpxf = prefix.slice(0, 4) === "PPXF";
      if (isArmor) {
        if (next.size > PPXT_V2_ARMOR_MAXIMUM_CHARS) {
          throw new Error("oversize armored text");
        }
        const armor = await next.text();
        if (routingGeneration.current !== generation) return;
        if (!armor.startsWith("-----BEGIN PPX ENCRYPTED TEXT-----")) {
          throw new Error("invalid armored text file");
        }
        setFile(null);
        setInput(armor);
        setResult(null);
        setError("");
        setCollisionConfirmation(false);
        setSaveError("");
        return;
      }
      if (isPpxf) {
        choosePpxfFile(next);
        return;
      }
      if (next.name.toLowerCase().endsWith(".ppxmessage")) {
        if (next.size > PPXT_V2_ARMOR_MAXIMUM_CHARS) {
          throw new Error("oversize armored text");
        }
        const armor = await next.text();
        if (routingGeneration.current !== generation) return;
        if (!armor.startsWith("-----BEGIN PPX ENCRYPTED TEXT-----")) {
          throw new Error("invalid armored text file");
        }
        setFile(null);
        setInput(armor);
        setResult(null);
        setError("");
        setCollisionConfirmation(false);
        setSaveError("");
        return;
      }
      throw new Error("unsupported encrypted input");
    } catch {
      if (routingGeneration.current === generation) {
        setFile(null);
        setInput("");
        setSmartError(t("wrongIdentityOrDamaged"));
      }
    } finally {
      if (routingGeneration.current === generation) setRoutingBusy(false);
    }
  };

  const chooseDroppedText = (value: string) => {
    pendingOwnedObject.current = null;
    if (pendingIncomingIntent) onPendingIncomingConsumed(pendingIncomingIntent);
    routingGeneration.current += 1;
    textJob.current?.cancel();
    textJob.current = null;
    setBusy(false);
    setFile(null);
    setResult(null);
    setError("");
    setCollisionConfirmation(false);
    setSaveError("");
    if (value.length > PPXT_V2_ARMOR_MAXIMUM_CHARS) {
      setInput("");
      setSmartError(t("encryptedInputTooLarge"));
      return;
    }
    try {
      const linked = parseIncomingMessageText(value);
      if (linked) {
        setInput("");
        setTextInputObject(linked.object);
        setSmartError("");
        setStatus(t("incomingMessageReady"));
        if (autoDecryptIncomingMessages) {
          void decryptLinkedText(linked.object);
        }
        return;
      }
      setTextInputObject(null);
      setInput(value);
      setSmartError("");
    } catch {
      setInput("");
      setTextInputObject(null);
      setSmartError(t("incomingMessageInvalid"));
    }
  };

  const decryptSmartInput = () => {
    if (file) {
      setFileStartToken((value) => value + 1);
    } else {
      void decrypt();
    }
  };

  const senderSaved = result
    ? isKnownSender(result.senderContact.fingerprint, contacts)
    : false;

  const copyDecryptedText = async () => {
    if (!result || !decryptedOutput.current) return;
    const copyResult = await copyWithBestEffortClear(
      result.plaintext,
      decryptedOutput.current,
    );
    setCopyStatus(
      t(
        copyResult === "copied"
          ? "copySucceeded"
          : copyResult === "selected"
            ? "copySelected"
            : "copyFailed",
      ),
    );
  };

  const saveTextSender = async (saveSeparate = false) => {
    if (!result || senderSaved || savingSender) return;
    const hasCollision = contacts.some(
      (item) =>
        item.contact.pseudonym === result.senderContact.pseudonym &&
        !isKnownSender(result.senderContact.fingerprint, [item]),
    );
    if (hasCollision && !saveSeparate) {
      setCollisionConfirmation(true);
      setSaveError("");
      return;
    }
    setSavingSender(true);
    try {
      const saved = await onContactsChange({
        kind: "add",
        item: {
          contact: result.senderContact,
          nickname: "",
          includeSenderContactInLinks: true,
        },
      });
      if (saved) {
        setCollisionConfirmation(false);
        setSaveError("");
      }
    } catch {
      setSaveError(t("storageFallback"));
    } finally {
      setSavingSender(false);
    }
  };

  return (
    <section class="flow-panel">
      <h1>{t("decryptTitle")}</h1>
      {pendingIncomingIntent && pendingIncomingIntent.kind !== "invalid" && (
        <div class="action-row incoming-message-actions">
          <button
            class="button secondary"
            type="button"
            onClick={() => {
              pendingOwnedObject.current = null;
              textJob.current?.cancel();
              textJob.current = null;
              setBusy(false);
              setTextInputObject(null);
              setStatus("");
              onPendingIncomingConsumed(pendingIncomingIntent);
            }}
          >
            {t("cancel")}
          </button>
        </div>
      )}
      <div
        class="smart-decrypt-area"
        data-testid="smart-decrypt-input"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (busy || fileBusy || routingBusy) return;
          const droppedFile = event.dataTransfer?.files.item(0) ?? null;
          if (droppedFile) void chooseSmartFile(droppedFile);
          else {
            const droppedText = event.dataTransfer?.getData("text/plain") ?? "";
            if (droppedText.trim() !== "") chooseDroppedText(droppedText);
          }
        }}
      >
        <h2>{t("smartDecryptPrompt")}</h2>
        <p class="input-meta">{t("smartDecryptHelper")}</p>
        <div class="field">
          <div class="field-heading">
            <label for="encrypted-item">{t("encryptedItem")}</label>
            <PasteButton
              label={t("paste")}
              unavailableLabel={t("pasteUnavailable")}
              failureLabel={t("pasteFailed")}
              disabled={busy || fileBusy || routingBusy}
              onPaste={chooseDroppedText}
              onError={setSmartError}
            />
          </div>
          <textarea
            class="field-control mono-output"
            id="encrypted-item"
            rows={10}
            maxLength={PPXT_V2_ARMOR_MAXIMUM_CHARS}
            value={input}
            disabled={busy || fileBusy || routingBusy}
            onInput={(event) => chooseDroppedText(event.currentTarget.value)}
          />
        </div>
        <div class="field">
          <label for="encrypted-file">{t("encryptedFile")}</label>
          <input
            id="encrypted-file"
            type="file"
            accept=".ppxfile,.ppxmessage,application/x-ppx-file,application/x-ppx-message,text/plain"
            disabled={busy || fileBusy || routingBusy}
            onChange={(event) =>
              void chooseSmartFile(event.currentTarget.files?.item(0) ?? null)
            }
          />
        </div>
        {file && (
          <p class="input-meta">
            {t("selectedFile")}: {file.name}
          </p>
        )}
        {file && <p class="input-meta">{t("fileRestartNote")}</p>}
      </div>
      <button
        class="button primary"
        type="button"
        disabled={
          busy ||
          fileBusy ||
          routingBusy ||
          (!textInputObject && !file && input.trim() === "")
        }
        onClick={decryptSmartInput}
      >
        {t("decryptLocally")}
      </button>
      {textInputObject && !autoDecryptIncomingMessages && (
        <p class="status-note" role="status">
          {t("incomingMessageReady")}
        </p>
      )}
      {busy && (
        <div class="progress-group" role="status">
          <label for="text-decrypt-progress">{t("operationProgress")}</label>
          <progress id="text-decrypt-progress" />
          <p class="input-meta">{t("cancelNote")}</p>
          <button class="button secondary" type="button" onClick={cancelText}>
            {t("cancelOperation")}
          </button>
        </div>
      )}
      {status && (
        <p class="status-note" role="status">
          {status}
        </p>
      )}
      {smartError && (
        <p class="field-error" role="alert">
          {smartError}
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
      {result && (
        <section class="decrypted-result">
          <h2>{t("decryptedText")}</h2>
          <AuthenticatedSenderCard
            sender={result.senderContact}
            contacts={contacts}
            t={t}
          />
          <div class="field decrypted-output-field">
            <label for="decrypted-text-output">{t("decryptedText")}</label>
            <textarea
              ref={decryptedOutput}
              class="field-control decrypted-output"
              id="decrypted-text-output"
              rows={10}
              readOnly
              value={result.plaintext}
            />
          </div>
          <button
            class="button secondary"
            type="button"
            onClick={() => void copyDecryptedText()}
          >
            {t("copyDecryptedText")}
          </button>
          {copyStatus && (
            <p class="input-meta" role="status">
              {copyStatus}
            </p>
          )}
          {!senderSaved && !senderPromptDismissed && (
            <div class="warning-panel" role="status">
              <h3>{t("unknownSender")}</h3>
              <p>{t("unknownSenderText")}</p>
              <div class="action-row">
                <button
                  class="button secondary"
                  type="button"
                  disabled={savingSender}
                  onClick={() => void saveTextSender(collisionConfirmation)}
                >
                  {t(
                    collisionConfirmation
                      ? "saveSeparateContact"
                      : "saveSender",
                  )}
                </button>
                <button
                  class="button secondary"
                  type="button"
                  disabled={savingSender}
                  onClick={() => {
                    setSenderPromptDismissed(true);
                    setCollisionConfirmation(false);
                    setSaveError("");
                  }}
                >
                  {t("notNow")}
                </button>
              </div>
              {collisionConfirmation && (
                <p class="field-error" role="alert">
                  {t("collisionWarning")}. {t("collisionNote")}
                </p>
              )}
              {saveError && (
                <p class="field-error" role="alert">
                  {saveError}
                </p>
              )}
            </div>
          )}
        </section>
      )}
      <div class="flow-divider" />
      <DecryptFileFlow
        t={t}
        identity={identity}
        contacts={contacts}
        onContactsChange={onContactsChange}
        file={file}
        startToken={fileStartToken}
        onBusyChange={setFileBusy}
        cancellationHandle={fileCancellation}
        locale={locale}
      />
    </section>
  );
}
