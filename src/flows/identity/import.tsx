import { useEffect, useRef, useState } from "preact/hooks";
import { ErrorSummary } from "../../components/feedback/error-summary";
import { TextField } from "../../components/forms/text-field";
import { PassphraseMeter } from "../../components/forms/passphrase-meter";
import { PasteButton } from "../../components/forms/paste-button";
import { QrImport } from "../../components/qr/import";
import { defaultCryptoProvider } from "../../crypto/default-provider";
import type { CryptoProvider, RecoveryWordCodec } from "../../crypto/provider";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";
import { zeroize, zeroizeIdentitySecretsV2 } from "../../crypto/zeroize";
import type { MessageKey } from "../../i18n";
import { decodeBase45Upper } from "../../protocol/base45";
import {
  parseRecoveryObject,
  PPXR_MAXIMUM_BASE45_CHARS,
} from "../../protocol/ppxr";
import {
  parseRecoveryObjectV2,
  PPXR_V2_MAXIMUM_BASE45_CHARS,
  PPXR_V2_TEXT_PREFIX,
} from "../../protocol/ppxr-v2";
import {
  parseLockedVault,
  PPXV_MAXIMUM_BASE45_CHARS,
  PPXV_MAXIMUM_SIZE,
} from "../../protocol/ppxv";
import {
  parseLockedVaultV2,
  PPXV_V2_MAXIMUM_BASE45_CHARS,
  PPXV_V2_MAXIMUM_SIZE,
} from "../../protocol/ppxv-v2";
import { normalizePseudonym } from "../../protocol/text";
import type { RecoveryWordsImportInput } from "../../protocol/types";
import type {
  DerivedIdentityV2,
  PublicContactV2,
  RecoveryObjectV2,
} from "../../protocol/types-v2";
import {
  type CryptoWorkerJob,
  startUnlockVaultJob,
} from "../../workers/crypto-client";
import {
  type LegacyV1WorkerJob,
  startLegacyRecoveryMigrationJob,
  startLegacyVaultMigrationJob,
} from "../../workers/legacy-v1-client";

interface IdentityImportProps {
  t: (key: MessageKey) => string;
  onBack: () => void;
  onReady: (
    identity: DerivedIdentityV2,
    contact: PublicContactV2,
    importedAt?: bigint,
    acceptOwnership?: () => boolean,
  ) => Promise<void> | void;
  readPrivateFileMagic?: (file: File) => Promise<string>;
  legacyRecoveryMigrationJobFactory?: typeof startLegacyRecoveryMigrationJob;
  legacyVaultMigrationJobFactory?: typeof startLegacyVaultMigrationJob;
}

async function defaultReadPrivateFileMagic(file: File): Promise<string> {
  return new TextDecoder().decode(
    new Uint8Array(await file.slice(0, 6).arrayBuffer()),
  );
}

export interface RecoveryWordsImportOutputV2 {
  identity: DerivedIdentityV2;
  publicContact: PublicContactV2;
  importedAt: bigint;
}

export type ClassifiedPrivateQr =
  | { kind: "recovery"; suite: 1 | 2; payload: Uint8Array }
  | { kind: "private-vault"; suite: 1 | 2; payload: Uint8Array };

export function classifyPrivateQr(raw: string): ClassifiedPrivateQr {
  if (raw.startsWith(PPXR_V2_TEXT_PREFIX)) {
    const encoded = raw.slice(PPXR_V2_TEXT_PREFIX.length);
    if (encoded.length > PPXR_V2_MAXIMUM_BASE45_CHARS) {
      throw new Error("oversize private QR");
    }
    const payload = decodeBase45Upper(encoded);
    const recovery = parseRecoveryObjectV2(payload);
    zeroize(recovery.masterEntropy);
    return { kind: "recovery", suite: 2, payload };
  }
  const vaultPrefix = "PPX2:PRIVATE:";
  if (raw.startsWith(vaultPrefix)) {
    const encoded = raw.slice(vaultPrefix.length);
    if (encoded.length > PPXV_V2_MAXIMUM_BASE45_CHARS) {
      throw new Error("oversize private QR");
    }
    const payload = decodeBase45Upper(encoded);
    parseLockedVaultV2(payload);
    return { kind: "private-vault", suite: 2, payload };
  }
  const legacyRecoveryPrefix = "PPX1:RECOVERY:";
  if (raw.startsWith(legacyRecoveryPrefix)) {
    const encoded = raw.slice(legacyRecoveryPrefix.length);
    if (encoded.length > PPXR_MAXIMUM_BASE45_CHARS) {
      throw new Error("oversize private QR");
    }
    const payload = decodeBase45Upper(encoded);
    const recovery = parseRecoveryObject(payload);
    zeroize(recovery.masterEntropy);
    return { kind: "recovery", suite: 1, payload };
  }
  const legacyVaultPrefix = "PPX1:PRIVATE:";
  if (raw.startsWith(legacyVaultPrefix)) {
    const encoded = raw.slice(legacyVaultPrefix.length);
    if (encoded.length > PPXV_MAXIMUM_BASE45_CHARS) {
      throw new Error("oversize private QR");
    }
    const payload = decodeBase45Upper(encoded);
    parseLockedVault(payload);
    return { kind: "private-vault", suite: 1, payload };
  }
  throw new Error("unsupported private QR");
}

export async function importRecoveryWords(
  input: RecoveryWordsImportInput,
  provider: Pick<
    CryptoProvider,
    "deriveIdentity" | "createPublicContact"
  > = defaultCryptoProvider,
  codec: RecoveryWordCodec = createRecoveryWordCodec(),
): Promise<RecoveryWordsImportOutputV2> {
  let entropy: Uint8Array | undefined;
  let identity: DerivedIdentityV2 | undefined;
  let transferred = false;
  try {
    entropy = codec.recoveryWordsToEntropy(input.words);
    identity = await provider.deriveIdentity(entropy);
    const pseudonym = normalizePseudonym(input.pseudonym);
    const importedIdentity: DerivedIdentityV2 = {
      ...identity,
      pseudonym,
      creationTime: 0n,
      importedAt: input.importedAt,
    };
    const output: RecoveryWordsImportOutputV2 = {
      identity: importedIdentity,
      publicContact: provider.createPublicContact(
        importedIdentity,
        pseudonym,
        0n,
      ),
      importedAt: input.importedAt,
    };
    transferred = true;
    return output;
  } finally {
    if (entropy) zeroize(entropy);
    if (identity && !transferred) zeroizeIdentitySecretsV2(identity);
  }
}

export function IdentityImport({
  t,
  onBack,
  onReady,
  readPrivateFileMagic = defaultReadPrivateFileMagic,
  legacyRecoveryMigrationJobFactory = startLegacyRecoveryMigrationJob,
  legacyVaultMigrationJobFactory = startLegacyVaultMigrationJob,
}: IdentityImportProps) {
  const [pseudonym, setPseudonym] = useState("");
  const [words, setWords] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<"recovery" | "vault" | null>(null);
  const [fileSuite, setFileSuite] = useState<1 | 2 | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const passphraseRef = useRef("");
  const passphraseBytes = new TextEncoder().encode(passphrase).byteLength;
  const [scannedQr, setScannedQr] = useState("");
  const [qrKind, setQrKind] = useState<"recovery" | "vault" | null>(null);
  const [qrSuite, setQrSuite] = useState<1 | 2 | null>(null);
  const [busy, setBusy] = useState(false);
  const [routingPrivateFile, setRoutingPrivateFile] = useState(false);
  const [error, setError] = useState("");
  const errorSummary = useRef<HTMLElement | null>(null);
  const unlockJob = useRef<
    | CryptoWorkerJob<DerivedIdentityV2>
    | LegacyV1WorkerJob<DerivedIdentityV2>
    | null
  >(null);
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

  const updatePassphrase = (value: string) => {
    passphraseRef.current = value;
    setPassphrase(value);
  };

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

  const complete = async (
    identity: DerivedIdentityV2,
    publicPseudonym: string,
    creationTime: bigint,
    importedAt?: bigint,
  ) => {
    if (!mounted.current) {
      zeroizeIdentitySecretsV2(identity);
      return;
    }
    try {
      const relabeledIdentity = {
        ...identity,
        pseudonym: normalizePseudonym(publicPseudonym),
        creationTime,
        ...(importedAt === undefined ? {} : { importedAt }),
      };
      const contact = defaultCryptoProvider.createPublicContact(
        relabeledIdentity,
        publicPseudonym,
        creationTime,
      );
      if (importedAt === undefined) {
        await onReady(relabeledIdentity, contact);
      } else {
        const output: RecoveryWordsImportOutputV2 = {
          identity: relabeledIdentity,
          publicContact: contact,
          importedAt,
        };
        await onReady(output.identity, output.publicContact, output.importedAt);
      }
    } catch (caught) {
      zeroizeIdentitySecretsV2(identity);
      throw caught;
    }
  };

  const importWords = async () => {
    setBusy(true);
    setError("");
    try {
      const normalizedWords = words
        .normalize("NFKD")
        .trim()
        .toLowerCase()
        .split(/\s+/u);
      const output = await importRecoveryWords({
        words: normalizedWords,
        pseudonym,
        importedAt: BigInt(Math.floor(Date.now() / 1000)),
      });
      if (!mounted.current) {
        zeroizeIdentitySecretsV2(output.identity);
        return;
      }
      let accepted = false;
      const acceptOwnership = () => {
        if (accepted) return false;
        accepted = true;
        return true;
      };
      try {
        await onReady(
          output.identity,
          output.publicContact,
          output.importedAt,
          acceptOwnership,
        );
        if (!accepted) acceptOwnership();
      } finally {
        if (!accepted) zeroizeIdentitySecretsV2(output.identity);
      }
    } catch {
      if (mounted.current) setError(t("importError"));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const importFile = async () => {
    if (!file) return;
    fileGeneration.current += 1;
    let operation:
      | CryptoWorkerJob<DerivedIdentityV2>
      | LegacyV1WorkerJob<DerivedIdentityV2>
      | null = null;
    let bytes: Uint8Array | undefined;
    let recovery: RecoveryObjectV2 | undefined;
    setBusy(true);
    setError("");
    try {
      if (file.size > Math.max(PPXV_MAXIMUM_SIZE, PPXV_V2_MAXIMUM_SIZE))
        throw new Error("oversize private file");
      bytes = new Uint8Array(await file.arrayBuffer());
      const magic = new TextDecoder().decode(bytes.slice(0, 4));
      if (magic === "PPXR" && fileSuite === 1) {
        operation = legacyRecoveryMigrationJobFactory(bytes);
        unlockJob.current = operation;
        const identity = await operation.promise;
        if (unlockJob.current !== operation) {
          zeroizeIdentitySecretsV2(identity);
          return;
        }
        await complete(identity, identity.pseudonym, identity.creationTime);
      } else if (magic === "PPXV" && fileSuite === 1) {
        operation = legacyVaultMigrationJobFactory({
          bytes,
          passphrase: passphraseRef.current,
        });
        unlockJob.current = operation;
        const identity = await operation.promise;
        if (unlockJob.current !== operation) {
          zeroizeIdentitySecretsV2(identity);
          return;
        }
        await complete(identity, identity.pseudonym, identity.creationTime);
      } else if (magic === "PPXR" && fileSuite === 2) {
        recovery = parseRecoveryObjectV2(bytes);
        const identity = await defaultCryptoProvider.deriveIdentity(
          recovery.masterEntropy,
        );
        await complete(identity, recovery.pseudonym, recovery.creationTime);
      } else if (magic === "PPXV" && fileSuite === 2) {
        operation = startUnlockVaultJob({
          vault: parseLockedVaultV2(bytes),
          passphrase: passphraseRef.current,
        });
        unlockJob.current = operation;
        const identity = await operation.promise;
        if (unlockJob.current !== operation) {
          zeroizeIdentitySecretsV2(identity);
          return;
        }
        await complete(identity, identity.pseudonym, identity.creationTime);
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
    setFileSuite(null);
    setError("");
    if (!next) return;
    setRoutingPrivateFile(true);
    try {
      if (next.size > Math.max(PPXV_MAXIMUM_SIZE, PPXV_V2_MAXIMUM_SIZE))
        throw new Error("oversize private file");
      const magic = await readPrivateFileMagic(next);
      if (!mounted.current || fileGeneration.current !== generation) return;
      if (
        magic !== "PPXR\u0001\u0001" &&
        magic !== "PPXV\u0001\u0001" &&
        magic !== "PPXR\u0002\u0002" &&
        magic !== "PPXV\u0002\u0002"
      ) {
        throw new Error("unsupported private file");
      }
      setFile(next);
      setFileKind(magic.startsWith("PPXR") ? "recovery" : "vault");
      setFileSuite(magic.charCodeAt(4) === 1 ? 1 : 2);
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
    setQrSuite(null);
    setError("");
    let privatePayload: Uint8Array | undefined;
    try {
      const classified = classifyPrivateQr(value);
      privatePayload = classified.payload;
      setQrSuite(classified.suite);
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
    let operation:
      | CryptoWorkerJob<DerivedIdentityV2>
      | LegacyV1WorkerJob<DerivedIdentityV2>
      | null = null;
    let privatePayload: Uint8Array | undefined;
    let recovery: RecoveryObjectV2 | undefined;
    setBusy(true);
    setError("");
    try {
      const classified = classifyPrivateQr(scannedQr);
      privatePayload = classified.payload;
      if (classified.kind === "recovery" && classified.suite === 1) {
        operation = legacyRecoveryMigrationJobFactory(privatePayload);
        unlockJob.current = operation;
        const identity = await operation.promise;
        if (unlockJob.current !== operation) {
          zeroizeIdentitySecretsV2(identity);
          return;
        }
        await complete(identity, identity.pseudonym, identity.creationTime);
      } else if (
        classified.kind === "private-vault" &&
        classified.suite === 1
      ) {
        operation = legacyVaultMigrationJobFactory({
          bytes: privatePayload,
          passphrase: passphraseRef.current,
        });
        unlockJob.current = operation;
        const identity = await operation.promise;
        if (unlockJob.current !== operation) {
          zeroizeIdentitySecretsV2(identity);
          return;
        }
        await complete(identity, identity.pseudonym, identity.creationTime);
      } else if (classified.kind === "recovery" && classified.suite === 2) {
        recovery = parseRecoveryObjectV2(classified.payload);
        const identity = await defaultCryptoProvider.deriveIdentity(
          recovery.masterEntropy,
        );
        await complete(identity, recovery.pseudonym, recovery.creationTime);
      } else if (
        classified.kind === "private-vault" &&
        classified.suite === 2
      ) {
        operation = startUnlockVaultJob({
          vault: parseLockedVaultV2(classified.payload),
          passphrase: passphraseRef.current,
        });
        unlockJob.current = operation;
        const identity = await operation.promise;
        if (unlockJob.current !== operation) {
          zeroizeIdentitySecretsV2(identity);
          return;
        }
        await complete(identity, identity.pseudonym, identity.creationTime);
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
      {fileSuite === 1 && (
        <div class="warning-panel" role="note">
          <p>{t("legacyRecoveryUpgradeNotice")}</p>
        </div>
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
        onInput={updatePassphrase}
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
      {qrSuite === 1 && (
        <div class="warning-panel" role="note">
          <p>{t("legacyRecoveryUpgradeNotice")}</p>
        </div>
      )}
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
