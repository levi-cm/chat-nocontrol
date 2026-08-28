import { useEffect, useRef, useState } from "preact/hooks";
import type { ManagedContact } from "../../components/cards/contact-management-card";
import { AuthenticatedSenderCard } from "../../components/cards/authenticated-sender-card";
import { PasteButton } from "../../components/forms/paste-button";
import { createDecapsulationCapabilityV2 } from "../../crypto/identity-v2";
import { zeroize } from "../../crypto/zeroize";
import { copyWithBestEffortClear } from "../identity/clipboard";
import type { Locale, MessageKey } from "../../i18n";
import { PPXT_V2_ARMOR_MAXIMUM_CHARS } from "../../protocol/ppxt-armor-v2";
import { PPXT_ARMOR_MAXIMUM_CHARS } from "../../protocol/ppxt-armor";
import { PPXF_V2_ENCODED_MAX_BYTES } from "../../protocol/ppxf-v2";
import { PPXF_ENCODED_MAX_BYTES } from "../../protocol/ppxf";
import { PPXError, type DecryptedTextOutput } from "../../protocol/types";
import {
  encodePublicContact,
  parsePublicContact,
  parsePublicContactQr,
  PPXC_MAXIMUM_BASE45_CHARS,
  PPXC_MAXIMUM_SIZE,
} from "../../protocol/ppxc";
import type {
  DecryptedTextOutputV2,
  DerivedIdentityV2,
  EncryptedTextObjectV2,
} from "../../protocol/types-v2";
import type { IncomingEncryptedIntent } from "../../protocol/message-link";
import type { ContactSaveMutation } from "../../app/contact-save-queue";
import {
  type CryptoWorkerJob,
  startDecryptTextJob,
} from "../../workers/crypto-client";
import {
  type LegacyV1WorkerJob,
  startLegacyCompactTextDecryptJob,
  startLegacyTextDecryptJob,
} from "../../workers/legacy-v1-client";
import { DecryptFileFlow } from "./file";
import { classifyEncryptedText } from "./compat-routing";
import { isKnownSender } from "./sender";

export { isKnownSender } from "./sender";

const TEXT_ARMOR_MAXIMUM_CHARS = Math.max(
  PPXT_ARMOR_MAXIMUM_CHARS,
  PPXT_V2_ARMOR_MAXIMUM_CHARS,
);
const FILE_ENCODED_MAX_BYTES = Math.max(
  PPXF_ENCODED_MAX_BYTES,
  PPXF_V2_ENCODED_MAX_BYTES,
);

type TextDecryptResult =
  | { suite: "cat5-v2"; output: DecryptedTextOutputV2 }
  | { suite: "legacy-v1"; output: DecryptedTextOutput };

type TextDecryptJob =
  | CryptoWorkerJob<DecryptedTextOutputV2>
  | LegacyV1WorkerJob<DecryptedTextOutput>;

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
  legacySenderContactHandle,
}: {
  t: (key: MessageKey) => string;
  identity: DerivedIdentityV2 | null;
  contacts: ManagedContact[];
  onContactsChange: (mutation: ContactSaveMutation) => Promise<boolean>;
  locale: Locale;
  autoDecryptIncomingMessages: boolean;
  pendingIncomingIntent: IncomingEncryptedIntent | null;
  onPendingIncomingConsumed: (expected?: IncomingEncryptedIntent) => void;
  cancellationHandle: { current: (() => void) | null };
  incomingSharedText?: string | null;
  onIncomingSharedTextConsumed?: () => void;
  legacySenderContactHandle?: { current: Uint8Array | null };
}) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<TextDecryptResult | null>(null);
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
  const [temporaryContactText, updateTemporaryContactText] = useState("");
  const [legacyContactStatus, setLegacyContactStatus] = useState("");
  const [legacyContactError, setLegacyContactError] = useState("");
  const [legacyContactRequested, setLegacyContactRequested] = useState(false);
  const routingGeneration = useRef(0);
  const textJob = useRef<TextDecryptJob | null>(null);
  const fileCancellation = useRef<(() => void) | null>(null);
  const pendingOwnedObject = useRef<EncryptedTextObjectV2 | null>(null);
  const decryptedOutput = useRef<HTMLTextAreaElement | null>(null);
  const internalLegacySenderContactBytes = useRef<Uint8Array | null>(null);
  const legacySenderContactBytes =
    legacySenderContactHandle ?? internalLegacySenderContactBytes;
  const legacyContactDetails = useRef<HTMLDetailsElement | null>(null);
  const legacyContactControl = useRef<HTMLTextAreaElement | null>(null);
  const identityReference = useRef(identity);
  const clipboardCleanup = useRef(new AbortController());

  const clearLegacySenderContact = () => {
    if (legacySenderContactBytes.current) {
      zeroize(legacySenderContactBytes.current);
      legacySenderContactBytes.current = null;
    }
    updateTemporaryContactText("");
    setLegacyContactStatus("");
    setLegacyContactError("");
    setLegacyContactRequested(false);
  };

  const requestLegacySenderContact = () => {
    setResult(null);
    setStatus("");
    setSmartError("");
    setError("");
    setLegacyContactRequested(true);
    if (legacyContactDetails.current) legacyContactDetails.current.open = true;
    legacyContactControl.current?.focus();
  };

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
      clipboardCleanup.current.abort();
      if (!legacySenderContactHandle && legacySenderContactBytes.current)
        zeroize(legacySenderContactBytes.current);
      if (!legacySenderContactHandle) legacySenderContactBytes.current = null;
    },
    [],
  );

  useEffect(() => {
    if (identityReference.current !== identity) {
      identityReference.current = identity;
      clipboardCleanup.current.abort();
      clipboardCleanup.current = new AbortController();
      clearLegacySenderContact();
    }
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
    setStatus("");
    if (pendingIncomingIntent.kind === "invalid") {
      setSmartError(t("incomingMessageInvalid"));
      onPendingIncomingConsumed(pendingIncomingIntent);
      return;
    }
    const intent = pendingIncomingIntent;
    if (intent.kind === "ppxt" || intent.kind === "ppxm") {
      pendingOwnedObject.current = intent.object;
      setTextInputObject(intent.object);
    } else {
      pendingOwnedObject.current = null;
      setTextInputObject(null);
    }
    setInput("");
    if (!autoDecryptIncomingMessages) {
      setStatus(t("incomingMessageReady"));
      return () => {
        pendingOwnedObject.current = null;
        setTextInputObject(null);
        setStatus("");
      };
    }
    if (
      intent.kind === "legacy-v1-compact" &&
      !legacySenderContactBytes.current
    ) {
      requestLegacySenderContact();
      return;
    }
    const suite =
      intent.kind === "ppxt" || intent.kind === "ppxm"
        ? "cat5-v2"
        : "legacy-v1";
    const operation: TextDecryptJob =
      intent.kind === "legacy-v1-full"
        ? startLegacyTextDecryptJob({
            object: intent.object,
            masterEntropy: identity.masterEntropy,
          })
        : intent.kind === "legacy-v1-compact"
          ? startLegacyCompactTextDecryptJob({
              ppxqBytes: intent.ppxqBytes,
              senderContactBytes:
                legacySenderContactBytes.current as Uint8Array,
              masterEntropy: identity.masterEntropy,
            })
          : startDecryptTextJob({
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
        setResult(
          suite === "legacy-v1"
            ? { suite, output: output as DecryptedTextOutput }
            : { suite, output: output as DecryptedTextOutputV2 },
        );
        setTextInputObject(null);
        pendingOwnedObject.current = null;
        setStatus("");
        onPendingIncomingConsumed(intent);
        completed = true;
      })
      .catch((caught) => {
        if (textJob.current !== operation) return;
        const detail =
          caught instanceof PPXError && caught.code === "unknown-sender-contact"
            ? t(
                intent.kind === "ppxm"
                  ? "compactV2UnknownSender"
                  : "unknownSender",
              )
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
    let classified: ReturnType<typeof classifyEncryptedText>;
    try {
      classified = classifyEncryptedText(incomingSharedText);
    } catch {
      setInput(incomingSharedText);
      setTextInputObject(null);
      setSmartError(t("incomingMessageInvalid"));
      return;
    }
    if (
      classified.kind === "legacy-v1-compact" &&
      !legacySenderContactBytes.current
    ) {
      setInput(incomingSharedText);
      setTextInputObject(null);
      requestLegacySenderContact();
      return;
    }
    if (classified.kind === "cat5-v2") {
      pendingOwnedObject.current = classified.object;
      setInput("");
      setTextInputObject(classified.object);
    } else {
      pendingOwnedObject.current = null;
      setInput(incomingSharedText);
      setTextInputObject(null);
    }
    setStatus(t("incomingMessageReady"));
    if (!autoDecryptIncomingMessages) {
      return;
    }
    const suite = classified.kind === "cat5-v2" ? "cat5-v2" : "legacy-v1";
    const operation: TextDecryptJob =
      classified.kind === "legacy-v1-full"
        ? startLegacyTextDecryptJob({
            object: classified.object,
            masterEntropy: identity.masterEntropy,
          })
        : classified.kind === "legacy-v1-compact"
          ? startLegacyCompactTextDecryptJob({
              ppxqBytes: classified.ppxqBytes,
              senderContactBytes:
                legacySenderContactBytes.current as Uint8Array,
              masterEntropy: identity.masterEntropy,
            })
          : startDecryptTextJob({
              object: classified.object,
              activeIdentity: createDecapsulationCapabilityV2(identity),
              knownSenders: contacts.map(({ contact }) => contact),
            });
    textJob.current = operation;
    setBusy(true);
    void operation.promise
      .then((output) => {
        if (textJob.current !== operation) return;
        setResult(
          suite === "legacy-v1"
            ? { suite, output: output as DecryptedTextOutput }
            : { suite, output: output as DecryptedTextOutputV2 },
        );
        setTextInputObject(null);
        pendingOwnedObject.current = null;
        setStatus("");
      })
      .catch((caught) => {
        if (textJob.current !== operation) return;
        const detail =
          caught instanceof PPXError && caught.code === "unknown-sender-contact"
            ? t(
                classified.kind === "cat5-v2" &&
                  classified.object.magic === "PPXM"
                  ? "compactV2UnknownSender"
                  : "unknownSender",
              )
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
    let operation: TextDecryptJob | null = null;
    let suite: TextDecryptResult["suite"] = "cat5-v2";
    let compactV2 = false;
    setBusy(true);
    setResult(null);
    setCopyStatus("");
    setError("");
    setStatus("");
    try {
      const classified =
        pendingIncomingIntent?.kind === "legacy-v1-full"
          ? ({
              kind: "legacy-v1-full",
              object: pendingIncomingIntent.object,
            } as const)
          : pendingIncomingIntent?.kind === "legacy-v1-compact"
            ? ({
                kind: "legacy-v1-compact",
                ppxqBytes: pendingIncomingIntent.ppxqBytes,
              } as const)
            : textInputObject
              ? ({ kind: "cat5-v2", object: textInputObject } as const)
              : classifyEncryptedText(input);
      if (
        classified.kind === "legacy-v1-compact" &&
        !legacySenderContactBytes.current
      ) {
        requestLegacySenderContact();
        return;
      }
      suite = classified.kind === "cat5-v2" ? "cat5-v2" : "legacy-v1";
      compactV2 =
        classified.kind === "cat5-v2" && classified.object.magic === "PPXM";
      operation =
        classified.kind === "legacy-v1-full"
          ? startLegacyTextDecryptJob({
              object: classified.object,
              masterEntropy: identity.masterEntropy,
            })
          : classified.kind === "legacy-v1-compact"
            ? startLegacyCompactTextDecryptJob({
                ppxqBytes: classified.ppxqBytes,
                senderContactBytes:
                  legacySenderContactBytes.current as Uint8Array,
                masterEntropy: identity.masterEntropy,
              })
            : startDecryptTextJob({
                object: classified.object,
                activeIdentity: createDecapsulationCapabilityV2(identity),
                knownSenders: contacts.map(({ contact }) => contact),
              });
      textJob.current = operation;
      const output = await operation.promise;
      if (textJob.current !== operation) return;
      setResult(
        suite === "legacy-v1"
          ? { suite, output: output as DecryptedTextOutput }
          : { suite, output: output as DecryptedTextOutputV2 },
      );
      setTextInputObject(null);
      if (pendingIncomingIntent)
        onPendingIncomingConsumed(pendingIncomingIntent);
    } catch (caught) {
      if (!operation || textJob.current === operation) {
        const detail =
          caught instanceof PPXError && caught.code === "invalid-signature"
            ? t("badSignature")
            : caught instanceof PPXError &&
                caught.code === "unknown-sender-contact"
              ? t(compactV2 ? "compactV2UnknownSender" : "unknownSender")
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
      setResult({ suite: "cat5-v2", output });
      setTextInputObject(null);
    } catch (caught) {
      if (!operation || textJob.current === operation) {
        const detail =
          caught instanceof PPXError && caught.code === "invalid-signature"
            ? t("badSignature")
            : caught instanceof PPXError &&
                caught.code === "unknown-sender-contact"
              ? t(
                  object.magic === "PPXM"
                    ? "compactV2UnknownSender"
                    : "unknownSender",
                )
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
    if (next && next.size > FILE_ENCODED_MAX_BYTES) {
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
        if (next.size > TEXT_ARMOR_MAXIMUM_CHARS) {
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
        if (next.size > TEXT_ARMOR_MAXIMUM_CHARS) {
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
    if (value.length > TEXT_ARMOR_MAXIMUM_CHARS) {
      setInput("");
      setSmartError(t("encryptedInputTooLarge"));
      return;
    }
    const trimmed = value.trim();
    const mayBeLinkOrCompact =
      trimmed.startsWith("https://") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("PPX1:MESSAGE:");
    if (mayBeLinkOrCompact) {
      try {
        const classified = classifyEncryptedText(value);
        if (classified.kind === "cat5-v2") {
          setInput("");
          setTextInputObject(classified.object);
          setSmartError("");
          setStatus(t("incomingMessageReady"));
          if (autoDecryptIncomingMessages) {
            void decryptLinkedText(classified.object);
          }
          return;
        }
      } catch {
        setTextInputObject(null);
        setInput("");
        setSmartError(t("incomingMessageInvalid"));
        return;
      }
    }
    setTextInputObject(null);
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

  const decrypted = result?.output ?? null;
  const senderSaved =
    result?.suite === "cat5-v2"
      ? isKnownSender(result.output.senderContact.fingerprint, contacts)
      : false;

  const copyDecryptedText = async () => {
    if (!decrypted || !decryptedOutput.current) return;
    const copyResult = await copyWithBestEffortClear(
      decrypted.plaintext,
      decryptedOutput.current,
      undefined,
      undefined,
      { signal: clipboardCleanup.current.signal },
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
    if (result?.suite !== "cat5-v2" || senderSaved || savingSender) return;
    const output = result.output;
    const hasCollision = contacts.some(
      (item) =>
        item.contact.pseudonym === output.senderContact.pseudonym &&
        !isKnownSender(output.senderContact.fingerprint, [item]),
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
          contact: output.senderContact,
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

  const installLegacySenderContact = (bytes: Uint8Array) => {
    const canonical = encodePublicContact(parsePublicContact(bytes));
    if (legacySenderContactBytes.current)
      zeroize(legacySenderContactBytes.current);
    legacySenderContactBytes.current = Uint8Array.from(canonical);
    zeroize(canonical);
    updateTemporaryContactText("");
    setLegacyContactError("");
    setLegacyContactRequested(false);
    setLegacyContactStatus(t("temporaryLegacyContactReady"));
  };

  const importLegacySenderContactText = () => {
    try {
      installLegacySenderContact(
        encodePublicContact(parsePublicContactQr(temporaryContactText.trim())),
      );
    } catch {
      setLegacyContactStatus("");
      setLegacyContactError(t("invalidTemporaryLegacyContact"));
    }
  };

  const importLegacySenderContactFile = async (next: File | null) => {
    if (!next) return;
    try {
      if (next.size > PPXC_MAXIMUM_SIZE)
        throw new PPXError("oversize-before-allocation");
      installLegacySenderContact(new Uint8Array(await next.arrayBuffer()));
    } catch {
      setLegacyContactStatus("");
      setLegacyContactError(t("invalidTemporaryLegacyContact"));
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
      <details ref={legacyContactDetails} class="warning-panel">
        <summary>{t("temporaryLegacyContactTitle")}</summary>
        <p class="input-meta" id="temporary-legacy-contact-help">
          {t("temporaryLegacyContactHelper")}
        </p>
        <div class="field">
          <label for="temporary-legacy-contact">
            {t("temporaryLegacyContact")}
          </label>
          <textarea
            ref={legacyContactControl}
            class="field-control mono-output"
            id="temporary-legacy-contact"
            rows={3}
            maxLength={"PPX1:CONTACT:".length + PPXC_MAXIMUM_BASE45_CHARS}
            value={temporaryContactText}
            aria-invalid={legacyContactRequested || Boolean(legacyContactError)}
            aria-describedby={`temporary-legacy-contact-help${
              legacyContactRequested || legacyContactError
                ? " temporary-legacy-contact-error"
                : ""
            }`}
            disabled={busy || fileBusy || routingBusy}
            onInput={(event) =>
              updateTemporaryContactText(event.currentTarget.value)
            }
          />
        </div>
        <div class="field">
          <label for="temporary-legacy-contact-file">
            {t("temporaryLegacyContactFile")}
          </label>
          <input
            id="temporary-legacy-contact-file"
            type="file"
            accept=".ppxcontact,application/x-ppx-contact"
            disabled={busy || fileBusy || routingBusy}
            onChange={(event) =>
              void importLegacySenderContactFile(
                event.currentTarget.files?.item(0) ?? null,
              )
            }
          />
        </div>
        <div class="action-row">
          <button
            class="button secondary"
            type="button"
            disabled={
              busy ||
              fileBusy ||
              routingBusy ||
              temporaryContactText.trim() === ""
            }
            onClick={importLegacySenderContactText}
          >
            {t("useTemporaryLegacyContact")}
          </button>
          {legacySenderContactBytes.current && (
            <button
              class="button secondary"
              type="button"
              onClick={clearLegacySenderContact}
            >
              {t("clearTemporaryLegacyContact")}
            </button>
          )}
        </div>
        {legacyContactStatus && (
          <p class="status-note" role="status">
            {legacyContactStatus}
          </p>
        )}
        {legacyContactError && (
          <p
            class="field-error"
            id="temporary-legacy-contact-error"
            role="alert"
          >
            {legacyContactError}
          </p>
        )}
        {legacyContactRequested && !legacyContactError && (
          <p
            class="field-error"
            id="temporary-legacy-contact-error"
            role="alert"
          >
            {t("legacyCompactContactRequired")}
          </p>
        )}
      </details>
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
            maxLength={TEXT_ARMOR_MAXIMUM_CHARS}
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
          (!textInputObject &&
            !file &&
            input.trim() === "" &&
            (!pendingIncomingIntent ||
              pendingIncomingIntent.kind === "invalid"))
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
          {result.suite === "legacy-v1" ? (
            <div class="warning-panel" role="status">
              <p>{t("legacyContentNotice")}</p>
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
          <div class="field decrypted-output-field">
            <label for="decrypted-text-output">{t("decryptedText")}</label>
            <textarea
              ref={decryptedOutput}
              class="field-control decrypted-output"
              id="decrypted-text-output"
              rows={10}
              readOnly
              value={result.output.plaintext}
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
          {result.suite === "cat5-v2" &&
            !senderSaved &&
            !senderPromptDismissed && (
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
