import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { AUTO_LOCK_ACTIVITY_EVENTS, AUTO_LOCK_MS } from "../../app/auto-lock";
import { PrivateExportCard } from "../../components/cards/private-export-card";
import { PublicContactCard } from "../../components/cards/public-contact-card";
import { LiveRegion } from "../../components/feedback/live-region";
import { TextField } from "../../components/forms/text-field";
import { downloadBlob } from "../../components/media/blob-url";
import { IdentityImport } from "./import";
import { defaultCryptoProvider } from "../../crypto/default-provider";
import type { CryptoProvider } from "../../crypto/provider";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";
import { zeroize, zeroizeIdentitySecrets } from "../../crypto/zeroize";
import type { MessageKey } from "../../i18n";
import { encodeBase45Upper } from "../../protocol/base45";
import {
  encodePublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import { encodeRecoveryObject } from "../../protocol/ppxr";
import { normalizePseudonym } from "../../protocol/text";
import type {
  DerivedIdentity,
  LockedVaultObject,
  PublicContact,
} from "../../protocol/types";
import {
  type CryptoWorkerJob,
  startLockVaultJob,
} from "../../workers/crypto-client";

interface IdentityCreateProps {
  t: (key: MessageKey) => string;
  identity: DerivedIdentity | null;
  contact: PublicContact | null;
  onReady: (
    identity: DerivedIdentity,
    contact: PublicContact,
    vault?: LockedVaultObject,
    signal?: AbortSignal,
    acceptOwnership?: () => boolean,
  ) => Promise<void> | void;
  identityProvider?: Pick<
    CryptoProvider,
    "deriveIdentity" | "createPublicContact"
  >;
  randomBytes?: (length: number) => Uint8Array;
  autoLockMs?: number;
}

type Step = "choice" | "form" | "import" | "recovery" | "remember" | "vault";

export function IdentityCreate({
  t,
  identity,
  contact,
  onReady,
  identityProvider = defaultCryptoProvider,
  randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length)),
  autoLockMs = AUTO_LOCK_MS,
}: IdentityCreateProps) {
  const [step, setStep] = useState<Step>("choice");
  const [pseudonym, setPseudonym] = useState("");
  const [pendingIdentity, setPendingIdentity] =
    useState<DerivedIdentity | null>(null);
  const [pendingContact, setPendingContact] = useState<PublicContact | null>(
    null,
  );
  const [recoveryBytes, setRecoveryBytes] = useState<Uint8Array | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [exported, setExported] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [confirmationPositions, setConfirmationPositions] = useState<number[]>(
    [],
  );
  const [confirmedWords, setConfirmedWords] = useState<Record<number, string>>(
    {},
  );
  const [passphrase, setPassphrase] = useState("");
  const passphraseBytes = new TextEncoder().encode(passphrase).byteLength;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [holdingExport, setHoldingExport] = useState(false);
  const exportTimer = useRef<number | null>(null);
  const mounted = useRef(true);
  const vaultJob = useRef<CryptoWorkerJob<LockedVaultObject> | null>(null);
  const readyTransfer = useRef<AbortController | null>(null);
  const pendingIdentityOwner = useRef<DerivedIdentity | null>(null);
  const recoveryBytesOwner = useRef<Uint8Array | null>(null);
  let normalizedPseudonym = "";
  let pseudonymError = "";
  if (pseudonym !== "") {
    try {
      normalizedPseudonym = normalizePseudonym(pseudonym);
    } catch {
      pseudonymError = t("pseudonymError");
    }
  }

  const cancelExportHold = () => {
    if (exportTimer.current !== null) window.clearTimeout(exportTimer.current);
    exportTimer.current = null;
    setHoldingExport(false);
  };

  const clearSetupState = () => {
    setPendingIdentity(null);
    setPendingContact(null);
    setRecoveryBytes(null);
    setWords([]);
    setExported(false);
    setConfirmation("");
    setConfirmationPositions([]);
    setConfirmedWords({});
    setPassphrase("");
    setPseudonym("");
    setBusy(false);
    setError("");
    setStep("choice");
  };

  const abandonPendingSetup = () => {
    cancelExportHold();
    readyTransfer.current?.abort();
    readyTransfer.current = null;
    vaultJob.current?.cancel();
    vaultJob.current = null;
    if (pendingIdentityOwner.current) {
      zeroizeIdentitySecrets(pendingIdentityOwner.current);
      pendingIdentityOwner.current = null;
    }
    if (recoveryBytesOwner.current) {
      zeroize(recoveryBytesOwner.current);
      recoveryBytesOwner.current = null;
    }
    clearSetupState();
  };

  useEffect(
    () => () => {
      mounted.current = false;
      if (exportTimer.current !== null)
        window.clearTimeout(exportTimer.current);
      vaultJob.current?.cancel();
      vaultJob.current = null;
      readyTransfer.current?.abort();
      readyTransfer.current = null;
      if (pendingIdentityOwner.current) {
        zeroizeIdentitySecrets(pendingIdentityOwner.current);
        pendingIdentityOwner.current = null;
      }
      if (recoveryBytesOwner.current) {
        zeroize(recoveryBytesOwner.current);
        recoveryBytesOwner.current = null;
      }
    },
    [],
  );

  useLayoutEffect(() => {
    if (!pendingIdentity) return;
    let timer = 0;
    let deadline = Date.now() + autoLockMs;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(
        abandonPendingSetup,
        Math.max(0, deadline - Date.now()),
      );
    };
    const recordActivity = () => {
      if (Date.now() >= deadline) {
        abandonPendingSetup();
        return;
      }
      deadline = Date.now() + autoLockMs;
      schedule();
    };
    const checkSuspendedTab = () => {
      if (document.visibilityState === "visible" && Date.now() >= deadline) {
        abandonPendingSetup();
      }
    };
    for (const event of AUTO_LOCK_ACTIVITY_EVENTS)
      window.addEventListener(event, recordActivity);
    document.addEventListener("visibilitychange", checkSuspendedTab);
    schedule();
    return () => {
      window.clearTimeout(timer);
      for (const event of AUTO_LOCK_ACTIVITY_EVENTS)
        window.removeEventListener(event, recordActivity);
      document.removeEventListener("visibilitychange", checkSuspendedTab);
    };
  }, [pendingIdentity, autoLockMs]);

  const ownPendingIdentity = (next: DerivedIdentity) => {
    if (pendingIdentityOwner.current && pendingIdentityOwner.current !== next) {
      zeroizeIdentitySecrets(pendingIdentityOwner.current);
    }
    pendingIdentityOwner.current = next;
    setPendingIdentity(next);
  };

  const ownRecoveryBytes = (next: Uint8Array) => {
    if (recoveryBytesOwner.current && recoveryBytesOwner.current !== next) {
      zeroize(recoveryBytesOwner.current);
    }
    recoveryBytesOwner.current = next;
    setRecoveryBytes(next);
  };

  const transferReady = async (
    readyIdentity: DerivedIdentity,
    readyContact: PublicContact,
    vault?: LockedVaultObject,
  ) => {
    if (pendingIdentityOwner.current !== readyIdentity) return;
    const controller = new AbortController();
    let accepted = false;
    const acceptOwnership = () => {
      if (
        accepted ||
        controller.signal.aborted ||
        pendingIdentityOwner.current !== readyIdentity
      ) {
        return false;
      }
      pendingIdentityOwner.current = null;
      if (recoveryBytesOwner.current) {
        zeroize(recoveryBytesOwner.current);
        recoveryBytesOwner.current = null;
      }
      if (readyTransfer.current === controller) readyTransfer.current = null;
      accepted = true;
      return true;
    };
    readyTransfer.current?.abort();
    readyTransfer.current = controller;
    try {
      await onReady(
        readyIdentity,
        readyContact,
        vault,
        controller.signal,
        acceptOwnership,
      );
      if (!accepted && !acceptOwnership()) return;
      if (mounted.current) clearSetupState();
    } catch (caught) {
      if (
        controller.signal.aborted ||
        pendingIdentityOwner.current !== readyIdentity
      ) {
        return;
      }
      pendingIdentityOwner.current = null;
      zeroizeIdentitySecrets(readyIdentity);
      if (recoveryBytesOwner.current) {
        zeroize(recoveryBytesOwner.current);
        recoveryBytesOwner.current = null;
      }
      if (mounted.current) clearSetupState();
      throw caught;
    } finally {
      if (readyTransfer.current === controller) readyTransfer.current = null;
    }
  };

  if (identity && contact) {
    return (
      <div class="identity-detail">
        <p class="status-label">{t("identityReady")}</p>
        <PublicContactCard
          pseudonym={contact.pseudonym}
          qrText={encodePublicContactQr(contact)}
          authorityLabel={t("publicAuthority")}
          title={t("publicLabel")}
          qrLabel={t("publicQrAlt")}
          helper={t("publicContactHelper")}
          formatHint={t("publicContactHint")}
          fileBytes={encodePublicContact(contact)}
          downloadLabel={t("downloadContact")}
          identityId={contact.identityId}
          fingerprint={contact.fingerprint}
          identityIdLabel={t("shortIdentityId")}
          fingerprintLabel={t("fingerprint")}
          fingerprintGuidance={t("verifyFingerprintGuidance")}
        />
      </div>
    );
  }

  const create = async () => {
    setBusy(true);
    setError("");
    let entropy: Uint8Array | undefined;
    let derived: DerivedIdentity | undefined;
    let recovery: Uint8Array | undefined;
    let transferred = false;
    try {
      entropy = randomBytes(32);
      const validPseudonym = normalizePseudonym(pseudonym);
      const createdAt = BigInt(Math.floor(Date.now() / 1000));
      derived = {
        ...(await identityProvider.deriveIdentity(entropy)),
        pseudonym: validPseudonym,
        creationTime: createdAt,
      };
      const publicContact = identityProvider.createPublicContact(
        derived,
        validPseudonym,
        createdAt,
      );
      recovery = encodeRecoveryObject({
        magic: "PPXR",
        formatVersion: 1,
        suite: 1,
        flags: 0,
        masterEntropy: entropy,
        creationTime: createdAt,
        pseudonym: validPseudonym,
        checksum: new Uint8Array(16),
      });
      const recoveryWords =
        createRecoveryWordCodec().entropyToRecoveryWords(entropy);
      const random = randomBytes(12);
      const positions: number[] = [];
      for (const value of random) {
        const position = value % 24;
        if (!positions.includes(position)) positions.push(position);
        if (positions.length === 3) break;
      }
      for (let position = 0; positions.length < 3; position += 1) {
        if (!positions.includes(position)) positions.push(position);
      }
      ownPendingIdentity(derived);
      setPendingContact(publicContact);
      ownRecoveryBytes(recovery);
      transferred = true;
      setWords(recoveryWords);
      setConfirmationPositions(positions.sort((left, right) => left - right));
      setConfirmedWords({});
      setStep("recovery");
    } catch {
      setError(t("setupError"));
    } finally {
      if (entropy) zeroize(entropy);
      if (!transferred) {
        if (derived) zeroizeIdentitySecrets(derived);
        if (recovery) zeroize(recovery);
      }
      setBusy(false);
    }
  };

  const downloadRecovery = () => {
    if (!recoveryBytes) return;
    downloadBlob(
      new Blob([Uint8Array.from(recoveryBytes).buffer], {
        type: "application/x-ppx-recovery",
      }),
      "chat-nocontrol-private.ppxrecovery",
    );
    setExported(true);
  };

  const finishSession = async () => {
    if (!pendingIdentity || !pendingContact) return;
    setBusy(true);
    setError("");
    try {
      await transferReady(pendingIdentity, pendingContact);
    } catch {
      setError(t("setupError"));
    } finally {
      setBusy(false);
    }
  };

  const finishVault = async () => {
    if (!pendingIdentity || !pendingContact) return;
    let operation: CryptoWorkerJob<LockedVaultObject> | null = null;
    setBusy(true);
    setError("");
    try {
      operation = startLockVaultJob({
        identity: pendingIdentity,
        passphrase,
      });
      vaultJob.current = operation;
      const vault = await operation.promise;
      if (vaultJob.current !== operation) return;
      await transferReady(pendingIdentity, pendingContact, vault);
    } catch {
      if (!operation || vaultJob.current === operation)
        setError(t("setupError"));
    } finally {
      if (!operation || vaultJob.current === operation) {
        vaultJob.current = null;
        setBusy(false);
      }
    }
  };

  if (step === "choice") {
    return (
      <>
        <section class="intro-panel">
          <p class="status-label">{t("localOnly")}</p>
          <h1>{t("firstTitle")}</h1>
          <p class="lead">{t("firstBody")}</p>
          <div class="action-row">
            <button
              class="button primary"
              type="button"
              onClick={() => setStep("form")}
            >
              {t("createIdentity")}
            </button>
            <button
              class="button secondary"
              type="button"
              onClick={() => setStep("import")}
            >
              {t("importIdentity")}
            </button>
          </div>
        </section>
        <section class="authority-panel" aria-labelledby="authority-title">
          <h2 id="authority-title">{t("publicPrivateTitle")}</h2>
          <div class="authority-grid">
            <article class="authority public-authority">
              <span class="authority-symbol" aria-hidden="true">
                P
              </span>
              <div>
                <h3>{t("publicLabel")}</h3>
                <p>{t("publicBody")}</p>
              </div>
            </article>
            <article class="authority private-authority">
              <span class="authority-symbol" aria-hidden="true">
                !
              </span>
              <div>
                <h3>{t("privateLabel")}</h3>
                <p>{t("privateBody")}</p>
              </div>
            </article>
          </div>
        </section>
      </>
    );
  }

  if (step === "import") {
    return (
      <IdentityImport
        t={t}
        onBack={() => setStep("choice")}
        onReady={(importedIdentity, importedContact) => {
          ownPendingIdentity(importedIdentity);
          setPendingContact(importedContact);
          setStep("remember");
        }}
      />
    );
  }

  if (step === "form") {
    return (
      <section class="flow-panel">
        <h1>{t("createIdentity")}</h1>
        <p>{t("pseudonymHint")}</p>
        <div class="warning-panel" role="note">
          <h2>{t("pseudonymWarningTitle")}</h2>
          <p>{t("pseudonymWarningText")}</p>
        </div>
        <TextField
          id="pseudonym"
          label={t("pseudonym")}
          value={pseudonym}
          error={pseudonymError}
          onInput={setPseudonym}
        />
        {error && (
          <p class="field-error" role="alert">
            {error}
          </p>
        )}
        <div class="action-row">
          <button
            class="button primary"
            type="button"
            disabled={
              busy || normalizedPseudonym === "" || pseudonymError !== ""
            }
            onClick={() => void create()}
          >
            {busy ? t("creatingIdentity") : t("generateIdentity")}
          </button>
          <button
            class="button secondary"
            type="button"
            onClick={() => setStep("choice")}
          >
            {t("back")}
          </button>
        </div>
      </section>
    );
  }

  if (step === "recovery" && recoveryBytes) {
    return (
      <section class="flow-panel recovery-flow">
        <PrivateExportCard
          title={t("recoveryTitle")}
          warning={t("recoveryWarning")}
          qrText={"PPX1:RECOVERY:" + encodeBase45Upper(recoveryBytes)}
          authorityLabel={t("privateAuthority")}
          qrLabel={t("recoveryQrAlt")}
          formatHint={t("recoveryHint")}
        />
        <h2>{t("recoveryWordsTitle")}</h2>
        <p class="danger-copy">{t("recoveryWordsWarning")}</p>
        <ol class="word-grid">
          {words.map((word, index) => (
            <li key={`${index}-${word}`}>{word}</li>
          ))}
        </ol>
        <button
          class={
            holdingExport
              ? "button danger-export-button holding"
              : "button danger-export-button"
          }
          type="button"
          onPointerDown={(event) => {
            if (event.button !== 0 || exported) return;
            cancelExportHold();
            setHoldingExport(true);
            event.currentTarget.setPointerCapture(event.pointerId);
            exportTimer.current = window.setTimeout(() => {
              exportTimer.current = null;
              setHoldingExport(false);
              downloadRecovery();
            }, 800);
          }}
          onPointerUp={cancelExportHold}
          onPointerCancel={cancelExportHold}
          onClick={(event) => {
            if (event.detail === 0) downloadRecovery();
          }}
        >
          {t("downloadRecovery")}
        </button>
        <p class="input-meta">{t("recoveryExportKeyboard")}</p>
        <LiveRegion message={holdingExport ? t("holdExportProgress") : ""} />
        {!exported && <p class="blocked-note">{t("recoveryExportBlocker")}</p>}
        <TextField
          id="recovery-confirmation"
          label={t("confirmationLabel")}
          value={confirmation}
          disabled={!exported}
          onInput={setConfirmation}
        />
        <h2>{t("confirmWordsTitle")}</h2>
        <p>{t("confirmWordsHelper")}</p>
        <p class="input-meta">{t("confirmWordsNote")}</p>
        <div class="confirmation-words">
          {confirmationPositions.map((position) => (
            <TextField
              key={position}
              id={`recovery-word-confirmation-${position + 1}`}
              label={t("confirmWordPosition").replace(
                "{n}",
                String(position + 1),
              )}
              value={confirmedWords[position] ?? ""}
              disabled={!exported}
              onInput={(value) =>
                setConfirmedWords((current) => ({
                  ...current,
                  [position]: value,
                }))
              }
            />
          ))}
        </div>
        <button
          class="button secondary"
          type="button"
          disabled={
            confirmation !== t("confirmationPhrase") ||
            confirmationPositions.some(
              (position) =>
                (confirmedWords[position] ?? "").normalize("NFKD").trim() !==
                words[position]?.normalize("NFKD"),
            )
          }
          onClick={() => setStep("remember")}
        >
          {t("confirmRecovery")}
        </button>
      </section>
    );
  }

  if (step === "remember") {
    return (
      <section class="flow-panel">
        <h1>{t("rememberTitle")}</h1>
        <p class="lead">{t("rememberBody")}</p>
        <div class="choice-grid">
          <button
            class="choice-card"
            type="button"
            disabled={busy}
            onClick={() => void finishSession()}
          >
            <strong>{t("useSessionOnly")}</strong>
          </button>
          <button
            class="choice-card"
            type="button"
            onClick={() => setStep("vault")}
          >
            <strong>{t("rememberDevice")}</strong>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section class="flow-panel">
      <h1>{t("rememberDevice")}</h1>
      <TextField
        id="vault-passphrase"
        label={t("passphrase")}
        type="password"
        value={passphrase}
        onInput={setPassphrase}
      />
      <p class="input-meta">{t("passphraseHint")}</p>
      {passphrase !== "" && (passphraseBytes < 12 || passphraseBytes > 256) && (
        <p class="field-error" role="alert">
          {t("passphraseError")}
        </p>
      )}
      {error && (
        <p class="field-error" role="alert">
          {error}
        </p>
      )}
      <button
        class="button primary"
        type="button"
        disabled={busy || passphraseBytes < 12 || passphraseBytes > 256}
        onClick={() => void finishVault()}
      >
        {t("saveEncryptedVault")}
      </button>
      {busy && (
        <div>
          <p class="input-meta">{t("cancelNote")}</p>
          <button
            class="button secondary"
            type="button"
            onClick={() => {
              const operation = vaultJob.current;
              vaultJob.current = null;
              operation?.cancel();
              setBusy(false);
              setError(t("operationCancelled"));
            }}
          >
            {t("cancelOperation")}
          </button>
        </div>
      )}
      <LiveRegion message={busy ? t("creatingIdentity") : ""} />
    </section>
  );
}
