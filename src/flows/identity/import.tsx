import { useEffect, useRef, useState } from "preact/hooks";
import { ErrorSummary } from "../../components/feedback/error-summary";
import { TextField } from "../../components/forms/text-field";
import { PassphraseMeter } from "../../components/forms/passphrase-meter";
import { PasteButton } from "../../components/forms/paste-button";
import { QrImport } from "../../components/qr/import";
import { defaultCryptoProvider } from "../../crypto/default-provider";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";
import { zeroize, zeroizeIdentitySecrets } from "../../crypto/zeroize";
import type { MessageKey } from "../../i18n";
import { classifyQrPayload } from "../decrypt/classify";
import { parseRecoveryObject } from "../../protocol/ppxr";
import type { RecoveryObject } from "../../protocol/types";
import { parseLockedVault, PPXV_MAXIMUM_SIZE } from "../../protocol/ppxv";
import { normalizePseudonym } from "../../protocol/text";
import type { DerivedIdentity, PublicContact } from "../../protocol/types";
import {
  type CryptoWorkerJob,
  startUnlockVaultJob,
} from "../../workers/crypto-client";

interface IdentityImportProps {
  t: (key: MessageKey) => string;
  onBack: () => void;
  onReady: (identity: DerivedIdentity, contact: PublicContact) => void;
  readPrivateFileMagic?: (file: File) => Promise<string>;
}

async function defaultReadPrivateFileMagic(file: File): Promise<string> {
  return new TextDecoder().decode(
    new Uint8Array(await file.slice(0, 4).arrayBuffer()),
  );
}

export function IdentityImport({
  t,
  onBack,
  onReady,
  readPrivateFileMagic = defaultReadPrivateFileMagic,
}: IdentityImportProps) {
  const [pseudonym, setPseudonym] = useState("");
  const [words, setWords] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<"recovery" | "vault" | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const passphraseBytes = new TextEncoder().encode(passphrase).byteLength;
  const [scannedQr, setScannedQr] = useState("");
  const [qrKind, setQrKind] = useState<"recovery" | "vault" | null>(null);
  const [busy, setBusy] = useState(false);
  const [routingPrivateFile, setRoutingPrivateFile] = useState(false);
  const [error, setError] = useState("");
  const errorSummary = useRef<HTMLElement | null>(null);
  const unlockJob = useRef<CryptoWorkerJob<DerivedIdentity> | null>(null);
  const mounted = useRef(true);
  const fileGeneration = useRef(0);
  let normalizedPseudonym = "";
  let pseudonymError = "";
  if (pseudonym !== "") {
    try {
      normalizedPseudonym = normalizePseudonym(pseudonym);
    } catch {
      pseudonymError = t("pseudonymError");
    }
  }

  useEffect(
    () => () => {
      mounted.current = false;
      fileGeneration.current += 1;
      unlockJob.current?.cancel();
      unlockJob.current = null;
    },
    [],
  );

  useEffect(() => {
    if (error !== "") errorSummary.current?.focus();
  }, [error]);

  const complete = (
    identity: DerivedIdentity,
    publicPseudonym: string,
    creationTime = BigInt(Math.floor(Date.now() / 1000)),
  ) => {
    if (!mounted.current) {
      zeroizeIdentitySecrets(identity);
      return;
    }
    try {
      const relabeledIdentity = {
        ...identity,
        pseudonym: normalizePseudonym(publicPseudonym),
        creationTime,
      };
      const contact = defaultCryptoProvider.createPublicContact(
        relabeledIdentity,
        publicPseudonym,
        creationTime,
      );
      onReady(relabeledIdentity, contact);
    } catch (caught) {
      zeroizeIdentitySecrets(identity);
      throw caught;
    }
  };

  const importWords = async () => {
    setBusy(true);
    setError("");
    let entropy: Uint8Array | undefined;
    try {
      const normalizedWords = words
        .normalize("NFKD")
        .trim()
        .toLowerCase()
        .split(/\s+/u);
      entropy =
        createRecoveryWordCodec().recoveryWordsToEntropy(normalizedWords);
      const identity = await defaultCryptoProvider.deriveIdentity(entropy);
      complete(identity, pseudonym);
    } catch {
      if (mounted.current) setError(t("importError"));
    } finally {
      if (entropy) zeroize(entropy);
      if (mounted.current) setBusy(false);
    }
  };

  const importFile = async () => {
    if (!file) return;
    fileGeneration.current += 1;
    let operation: CryptoWorkerJob<DerivedIdentity> | null = null;
    let bytes: Uint8Array | undefined;
    let recovery: RecoveryObject | undefined;
    setBusy(true);
    setError("");
    try {
      if (file.size > PPXV_MAXIMUM_SIZE)
        throw new Error("oversize private file");
      bytes = new Uint8Array(await file.arrayBuffer());
      const magic = new TextDecoder().decode(bytes.slice(0, 4));
      if (magic === "PPXR") {
        recovery = parseRecoveryObject(bytes);
        const identity = await defaultCryptoProvider.deriveIdentity(
          recovery.masterEntropy,
        );
        complete(identity, recovery.pseudonym, recovery.creationTime);
      } else if (magic === "PPXV") {
        operation = startUnlockVaultJob({
          vault: parseLockedVault(bytes),
          passphrase,
        });
        unlockJob.current = operation;
        const identity = await operation.promise;
        if (unlockJob.current !== operation) {
          zeroizeIdentitySecrets(identity);
          return;
        }
        complete(identity, identity.pseudonym, identity.creationTime);
      } else {
        throw new Error("unsupported private file");
      }
    } catch {
      if (mounted.current && (!operation || unlockJob.current === operation))
        setError(t("importError"));
    } finally {
      if (bytes) zeroize(bytes);
      if (recovery) zeroize(recovery.masterEntropy);
      if (mounted.current && (!operation || unlockJob.current === operation)) {
        unlockJob.current = null;
        setBusy(false);
      }
    }
  };

  const choosePrivateFile = async (next: File | null) => {
    if (busy) return;
    const generation = fileGeneration.current + 1;
    fileGeneration.current = generation;
    setFile(null);
    setFileKind(null);
    setError("");
    if (!next) return;
    setRoutingPrivateFile(true);
    try {
      if (next.size > PPXV_MAXIMUM_SIZE)
        throw new Error("oversize private file");
      const magic = await readPrivateFileMagic(next);
      if (!mounted.current || fileGeneration.current !== generation) return;
      if (magic !== "PPXR" && magic !== "PPXV") {
        throw new Error("unsupported private file");
      }
      setFile(next);
      setFileKind(magic === "PPXR" ? "recovery" : "vault");
    } catch {
      if (mounted.current && fileGeneration.current === generation) {
        setError(t("importError"));
      }
    } finally {
      if (mounted.current && fileGeneration.current === generation) {
        setRoutingPrivateFile(false);
      }
    }
  };

  const acceptScannedQr = (value: string) => {
    if (busy) return;
    setScannedQr("");
    setQrKind(null);
    setError("");
    let privatePayload: Uint8Array | undefined;
    try {
      const classified = classifyQrPayload(value);
      if (classified.kind !== "public-contact") {
        privatePayload = classified.payload;
      }
      if (classified.kind === "recovery") setQrKind("recovery");
      else if (classified.kind === "private-vault") setQrKind("vault");
      else throw new Error("public contact is not a private identity");
      setScannedQr(value);
    } catch {
      setError(t("importError"));
    } finally {
      if (privatePayload) zeroize(privatePayload);
    }
  };

  const importQr = async () => {
    let operation: CryptoWorkerJob<DerivedIdentity> | null = null;
    let privatePayload: Uint8Array | undefined;
    let recovery: RecoveryObject | undefined;
    setBusy(true);
    setError("");
    try {
      const classified = classifyQrPayload(scannedQr);
      if (classified.kind !== "public-contact") {
        privatePayload = classified.payload;
      }
      if (classified.kind === "recovery") {
        recovery = parseRecoveryObject(classified.payload);
        const identity = await defaultCryptoProvider.deriveIdentity(
          recovery.masterEntropy,
        );
        complete(identity, recovery.pseudonym, recovery.creationTime);
      } else if (classified.kind === "private-vault") {
        operation = startUnlockVaultJob({
          vault: parseLockedVault(classified.payload),
          passphrase,
        });
        unlockJob.current = operation;
        const identity = await operation.promise;
        if (unlockJob.current !== operation) {
          zeroizeIdentitySecrets(identity);
          return;
        }
        complete(identity, identity.pseudonym, identity.creationTime);
      } else {
        throw new Error("public contact is not a private identity");
      }
    } catch {
      if (mounted.current && (!operation || unlockJob.current === operation))
        setError(t("importError"));
    } finally {
      if (recovery) zeroize(recovery.masterEntropy);
      if (privatePayload) zeroize(privatePayload);
      if (mounted.current && (!operation || unlockJob.current === operation)) {
        unlockJob.current = null;
        setBusy(false);
      }
    }
  };

  return (
    <section class="flow-panel">
      <h1>{t("importIdentity")}</h1>
      <ErrorSummary
        title={t("importErrorSummaryTitle")}
        errors={error === "" ? [] : [error]}
        summaryRef={errorSummary}
      />
      <section>
        <h2 id="words-import-title">{t("recoveryWordsTitle")}</h2>
        <TextField
          id="import-pseudonym"
          label={t("pseudonym")}
          value={pseudonym}
          error={pseudonymError}
          onInput={setPseudonym}
        />
        <div class="field">
          <div class="field-heading">
            <label for="recovery-words">{t("recoveryWordsTitle")}</label>
            <PasteButton
              label={t("paste")}
              unavailableLabel={t("pasteUnavailable")}
              failureLabel={t("pasteFailed")}
              disabled={busy}
              onPaste={setWords}
              onError={setError}
            />
          </div>
          <textarea
            class="field-control"
            id="recovery-words"
            rows={6}
            value={words}
            onInput={(event) => setWords(event.currentTarget.value)}
          />
        </div>
        <button
          class="button primary"
          type="button"
          disabled={busy || normalizedPseudonym === "" || words.trim() === ""}
          onClick={() => void importWords()}
        >
          {t("importWords")}
        </button>
      </section>
      <div class="flow-divider" aria-hidden="true" />
      <div class="field" aria-busy={routingPrivateFile}>
        <label for="recovery-file">{t("recoveryFile")}</label>
        <input
          id="recovery-file"
          type="file"
          accept=".ppxrecovery,.ppxvault,application/x-ppx-recovery,application/x-ppx-vault"
          disabled={busy}
          onChange={(event) =>
            void choosePrivateFile(event.currentTarget.files?.[0] ?? null)
          }
        />
      </div>
      {file && (
        <p class="input-meta">
          {t("selectedFile")}: {file.name}
        </p>
      )}
      {fileKind === "recovery" && (
        <div class="warning-panel danger-copy" role="alert">
          <strong>{t("recoveryHint")}</strong>
          <p>{t("recoveryImportWarning")}</p>
        </div>
      )}
      {fileKind === "vault" && (
        <div class="warning-panel" role="note">
          <p>{t("vaultWarning")}</p>
        </div>
      )}
      <TextField
        id="import-passphrase"
        label={t("passphrase")}
        type="password"
        value={passphrase}
        onInput={setPassphrase}
      />
      <PassphraseMeter value={passphrase} t={t} />
      <p class="input-meta">{t("passphraseHint")}</p>
      {passphraseBytes > 256 && (
        <p class="field-error" role="alert">
          {t("passphraseError")}
        </p>
      )}
      <button
        class="button primary"
        type="button"
        disabled={
          busy ||
          routingPrivateFile ||
          file === null ||
          (fileKind === "vault" &&
            (passphraseBytes === 0 || passphraseBytes > 256))
        }
        onClick={() => void importFile()}
      >
        {t("importFile")}
      </button>
      <div class="flow-divider" aria-hidden="true" />
      <QrImport idPrefix="identity" t={t} onDecoded={acceptScannedQr} />
      {qrKind === "recovery" && (
        <div class="warning-panel danger-copy" role="alert">
          <strong>{t("recoveryHint")}</strong>
          <p>{t("recoveryImportWarning")}</p>
        </div>
      )}
      {qrKind === "vault" && (
        <div class="warning-panel" role="note">
          <p>{t("vaultWarning")}</p>
        </div>
      )}
      <button
        class="button primary"
        type="button"
        disabled={
          busy ||
          scannedQr === "" ||
          (qrKind === "vault" &&
            (passphraseBytes === 0 || passphraseBytes > 256))
        }
        onClick={() => void importQr()}
      >
        {t("importScannedQr")}
      </button>
      <button
        class="button secondary"
        type="button"
        disabled={busy}
        onClick={onBack}
      >
        {t("back")}
      </button>
    </section>
  );
}
