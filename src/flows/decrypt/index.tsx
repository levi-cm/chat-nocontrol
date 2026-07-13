import { useEffect, useRef, useState } from "preact/hooks";
import type { ManagedContact } from "../../components/cards/contact-management-card";
import { AuthenticatedSenderCard } from "../../components/cards/authenticated-sender-card";
import type { Locale, MessageKey } from "../../i18n";
import { decodeTextArmor } from "../../protocol/ppxt-armor";
import { PPXT_ARMOR_MAXIMUM_CHARS } from "../../protocol/ppxt-armor";
import { PPXF_ENCODED_MAX_BYTES } from "../../protocol/ppxf";
import { PPXError } from "../../protocol/types";
import type {
  DecryptedTextOutput,
  DerivedIdentity,
} from "../../protocol/types";
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
}: {
  t: (key: MessageKey) => string;
  identity: DerivedIdentity | null;
  contacts: ManagedContact[];
  onContactsChange: (contacts: ManagedContact[]) => Promise<boolean>;
  locale: Locale;
}) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<DecryptedTextOutput | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileStartToken, setFileStartToken] = useState(0);
  const [smartError, setSmartError] = useState("");
  const [collision, setCollision] = useState("");
  const [status, setStatus] = useState("");
  const [savingSender, setSavingSender] = useState(false);
  const [routingBusy, setRoutingBusy] = useState(false);
  const routingGeneration = useRef(0);
  const textJob = useRef<CryptoWorkerJob<DecryptedTextOutput> | null>(null);

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
    setCollision("");
    setCollision("");
    setBusy(false);
    setFileBusy(false);
  }, [identity]);

  if (!identity) {
    return (
      <section class="flow-panel">
        <h1>{t("decryptTitle")}</h1>
        <p>{t("identityRequired")}</p>
      </section>
    );
  }

  const decrypt = async () => {
    let operation: CryptoWorkerJob<DecryptedTextOutput> | null = null;
    setBusy(true);
    setResult(null);
    setError("");
    setStatus("");
    try {
      operation = startDecryptTextJob({
        object: decodeTextArmor(input.trim()),
        activeIdentity: identity,
      });
      textJob.current = operation;
      const output = await operation.promise;
      if (textJob.current !== operation) return;
      setResult(output);
    } catch (caught) {
      if (!operation || textJob.current === operation) {
        const detail =
          caught instanceof PPXError && caught.code === "invalid-signature"
            ? t("badSignature")
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
    setBusy(false);
    setStatus(t("operationCancelled"));
  };

  const choosePpxfFile = (next: File | null) => {
    setResult(null);
    setError("");
    setSmartError("");
    setCollision("");
    if (next && next.size > PPXF_ENCODED_MAX_BYTES) {
      setFile(null);
      setSmartError(t("fileTooLarge"));
      return;
    }
    setInput("");
    setFile(next);
  };

  const chooseSmartFile = async (next: File | null) => {
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
        if (next.size > PPXT_ARMOR_MAXIMUM_CHARS) {
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
        setCollision("");
        return;
      }
      if (isPpxf) {
        choosePpxfFile(next);
        return;
      }
      if (next.name.toLowerCase().endsWith(".ppxmessage")) {
        if (next.size > PPXT_ARMOR_MAXIMUM_CHARS) {
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
        setCollision("");
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
    routingGeneration.current += 1;
    setFile(null);
    setResult(null);
    setError("");
    setCollision("");
    if (value.length > PPXT_ARMOR_MAXIMUM_CHARS) {
      setInput("");
      setSmartError(t("encryptedInputTooLarge"));
      return;
    }
    setInput(value);
    setSmartError("");
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

  const saveTextSender = async () => {
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
    <section class="flow-panel">
      <h1>{t("decryptTitle")}</h1>
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
          <label for="encrypted-item">{t("encryptedItem")}</label>
          <textarea
            class="field-control mono-output"
            id="encrypted-item"
            rows={10}
            maxLength={PPXT_ARMOR_MAXIMUM_CHARS}
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
          busy || fileBusy || routingBusy || (!file && input.trim() === "")
        }
        onClick={decryptSmartInput}
      >
        {t("decryptLocally")}
      </button>
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
          <pre>{result.plaintext}</pre>
          {!senderSaved && (
            <div class="warning-panel" role="status">
              <h3>{t("unknownSender")}</h3>
              <p>{t("unknownSenderText")}</p>
              <button
                class="button secondary"
                type="button"
                disabled={savingSender}
                onClick={() => void saveTextSender()}
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
      <div class="flow-divider" />
      <DecryptFileFlow
        t={t}
        identity={identity}
        contacts={contacts}
        onContactsChange={onContactsChange}
        file={file}
        startToken={fileStartToken}
        onBusyChange={setFileBusy}
        locale={locale}
      />
    </section>
  );
}
