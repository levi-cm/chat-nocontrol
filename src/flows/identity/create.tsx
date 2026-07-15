import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { AUTO_LOCK_ACTIVITY_EVENTS, AUTO_LOCK_MS } from "../../app/auto-lock";
import { PublicContactCard } from "../../components/cards/public-contact-card";
import { ConfirmationDialog } from "../../components/dialogs/confirmation";
import { ErrorSummary } from "../../components/feedback/error-summary";
import { PassphraseMeter } from "../../components/forms/passphrase-meter";
import { PasteButton } from "../../components/forms/paste-button";
import { TextField } from "../../components/forms/text-field";
import { downloadBlob, downloadDataUrl } from "../../components/media/blob-url";
import { QrImport } from "../../components/qr/import";
import { defaultCryptoProvider } from "../../crypto/default-provider";
import type { CryptoProvider } from "../../crypto/provider";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";
import {
  estimatePassphraseBits,
  passphraseStrengthBand,
} from "../../crypto/vault";
import { zeroize, zeroizeIdentitySecrets } from "../../crypto/zeroize";
import type { Locale, MessageKey } from "../../i18n";
import { encodeBase45Upper } from "../../protocol/base45";
import {
  encodePublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import { encodeRecoveryObject, PPXR_MAXIMUM_SIZE } from "../../protocol/ppxr";
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
import { IdentityImport } from "./import";
import {
  createRecoveryDocumentModel,
  recoveryArtifactFilename,
  type RecoveryDocumentModel,
} from "./recovery-artifacts";
import {
  generatePrivateRecoveryCardDataUrl,
  generateRecoveryQrDataUrl,
  generateRecoveryUsernameDataUrl,
} from "./recovery-card";
import { RecoveryPdfPreview } from "./recovery-document";
import { generateRecoveryPdfBytes } from "./recovery-pdf";
import {
  chooseRecoveryWordPositions,
  identityCreationProgress,
  identityCreationSteps,
  normalizeRecoveryWordAnswer,
  type BackupCompletion,
  type IdentityCreationStep,
  type RecoveryPracticeState,
  validatePrintableVaultPassword,
} from "./onboarding";
import {
  verifyRecoveryBytesForIdentity,
  verifyRecoveryCodeForIdentity,
} from "./recovery-practice";

interface IdentityCreateProps {
  t: (key: MessageKey) => string;
  locale?: Locale;
  identity: DerivedIdentity | null;
  contact: PublicContact | null;
  persistentStorageAvailable?: boolean;
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
  lockVaultJobFactory?: typeof startLockVaultJob;
  privateCardGenerator?: typeof generatePrivateRecoveryCardDataUrl;
  recoveryQrGenerator?: typeof generateRecoveryQrDataUrl;
  usernameImageGenerator?: typeof generateRecoveryUsernameDataUrl;
  pdfGenerator?: typeof generateRecoveryPdfBytes;
}

type Step =
  | "choice"
  | "username"
  | "import"
  | "password"
  | "digital-backups"
  | "recovery-document"
  | "qr-practice"
  | "file-word-practice"
  | "storage"
  | "import-remember"
  | "import-vault";

interface RecoveryDocumentCompletion {
  wordsWritten: boolean;
  printStored: boolean;
  pdfStored: boolean;
}

const emptyRecoveryDocumentCompletion = (): RecoveryDocumentCompletion => ({
  wordsWritten: false,
  printStored: false,
  pdfStored: false,
});

function WizardProgress({
  t,
  current,
}: {
  t: (key: MessageKey) => string;
  current: number;
}) {
  const value = identityCreationProgress[current - 1] ?? 100;
  return (
    <div class="wizard-progress">
      <p aria-live="polite">
        {t("wizardStep").replace("{current}", String(current))}
      </p>
      <div
        class="wizard-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SecretRestartButton({
  t,
  onRestart,
}: {
  t: (key: MessageKey) => string;
  onRestart: () => void;
}) {
  return (
    <button class="button danger-button" type="button" onClick={onRestart}>
      {t("restartIdentityCreation")}
    </button>
  );
}

export function IdentityCreate({
  t,
  locale = "en",
  identity,
  contact,
  persistentStorageAvailable = true,
  onReady,
  identityProvider = defaultCryptoProvider,
  randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length)),
  autoLockMs = AUTO_LOCK_MS,
  lockVaultJobFactory = startLockVaultJob,
  privateCardGenerator = generatePrivateRecoveryCardDataUrl,
  recoveryQrGenerator = generateRecoveryQrDataUrl,
  usernameImageGenerator = generateRecoveryUsernameDataUrl,
  pdfGenerator = generateRecoveryPdfBytes,
}: IdentityCreateProps) {
  const [step, setStep] = useState<Step>("choice");
  const [username, setUsername] = useState("");
  const [pendingIdentity, setPendingIdentity] =
    useState<DerivedIdentity | null>(null);
  const [pendingContact, setPendingContact] = useState<PublicContact | null>(
    null,
  );
  const [pendingVault, setPendingVault] = useState<LockedVaultObject | null>(
    null,
  );
  const [recoveryBytes, setRecoveryBytes] = useState<Uint8Array | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [confirmationPositions, setConfirmationPositions] = useState<number[]>(
    [],
  );
  const [confirmedWords, setConfirmedWords] = useState<Record<number, string>>(
    {},
  );
  const [wrongWordPositions, setWrongWordPositions] = useState<number[]>([]);
  const [wordAttempts, setWordAttempts] = useState(0);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseConfirmation, setPassphraseConfirmation] = useState("");
  const [qrDownloaded, setQrDownloaded] = useState(false);
  const [fileDownloaded, setFileDownloaded] = useState(false);
  const [qrStored, setQrStored] = useState(false);
  const [fileStored, setFileStored] = useState(false);
  const [printUsed, setPrintUsed] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [recoveryDocumentCompletion, setRecoveryDocumentCompletion] =
    useState<RecoveryDocumentCompletion>(emptyRecoveryDocumentCompletion);
  const [printModel, setPrintModel] = useState<RecoveryDocumentModel | null>(
    null,
  );
  const [recoveryPdfBytes, setRecoveryPdfBytes] = useState<Uint8Array | null>(
    null,
  );
  const [recoveryPdfFilename, setRecoveryPdfFilename] = useState("");
  const [qrPracticeValue, setQrPracticeValue] = useState("");
  const [qrVerified, setQrVerified] = useState(false);
  const [practiceFile, setPracticeFile] = useState<File | null>(null);
  const [fileVerified, setFileVerified] = useState(false);
  const [wordsVerified, setWordsVerified] = useState(false);
  const [rememberLocally, setRememberLocally] = useState(
    persistentStorageAvailable,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [vaultCreationError, setVaultCreationError] = useState(false);
  const [dialog, setDialog] = useState<
    "skip" | "restart" | "weak-password" | null
  >(null);

  const mounted = useRef(true);
  const vaultJob = useRef<CryptoWorkerJob<LockedVaultObject> | null>(null);
  const readyTransfer = useRef<AbortController | null>(null);
  const pendingIdentityOwner = useRef<DerivedIdentity | null>(null);
  const recoveryBytesOwner = useRef<Uint8Array | null>(null);
  const artifactOperation = useRef(0);
  const wizardPanel = useRef<HTMLElement | null>(null);
  const passwordInput = useRef<HTMLInputElement | null>(null);
  const vaultErrorSummary = useRef<HTMLElement | null>(null);

  let normalizedUsername = "";
  let usernameError = "";
  if (username !== "") {
    try {
      normalizedUsername = normalizePseudonym(username);
    } catch {
      usernameError = t("pseudonymError");
    }
  }

  const passwordPolicyError = validatePrintableVaultPassword(passphrase);
  const passwordError =
    passwordPolicyError === "surrounding-space"
      ? t("passwordSurroundingSpace")
      : passwordPolicyError === "non-ascii"
        ? t("passwordPrintableAscii")
        : passwordPolicyError === "too-long"
          ? t("passphraseError")
          : "";
  const passwordConfirmationError =
    passphraseConfirmation !== "" && passphraseConfirmation !== passphrase
      ? t("passwordMismatch")
      : "";
  const passwordStrength = passphraseStrengthBand(
    estimatePassphraseBits(passphrase),
  );
  const backupCompletion: BackupCompletion = {
    qrDownloaded,
    recoveryFileDownloaded: fileDownloaded,
    qrStored,
    recoveryFileStored: fileStored,
  };
  const recoveryPracticeState: RecoveryPracticeState = {
    qrVerified,
    recoveryFileVerified: fileVerified,
    recoveryWordsVerified: wordsVerified,
    failedWordSubmissions: wordAttempts,
  };

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

  const clearSecretPresentation = () => {
    setWords([]);
    setPassphrase("");
    setPassphraseConfirmation("");
    setPrintModel(null);
    setRecoveryPdfBytes((current) => {
      if (current) zeroize(current);
      return null;
    });
    setRecoveryPdfFilename("");
    setRecoveryDocumentCompletion(emptyRecoveryDocumentCompletion());
    setPrintUsed(false);
    setPdfDownloaded(false);
    setQrPracticeValue("");
    if (recoveryBytesOwner.current) {
      zeroize(recoveryBytesOwner.current);
      recoveryBytesOwner.current = null;
    }
    setRecoveryBytes(null);
  };

  const clearSetupState = () => {
    setPendingIdentity(null);
    setPendingContact(null);
    setPendingVault(null);
    setRecoveryBytes(null);
    setWords([]);
    setConfirmationPositions([]);
    setConfirmedWords({});
    setWrongWordPositions([]);
    setWordAttempts(0);
    setPassphrase("");
    setPassphraseConfirmation("");
    setUsername("");
    setQrDownloaded(false);
    setFileDownloaded(false);
    setQrStored(false);
    setFileStored(false);
    setPrintUsed(false);
    setPdfDownloaded(false);
    setRecoveryDocumentCompletion(emptyRecoveryDocumentCompletion());
    setPrintModel(null);
    setRecoveryPdfBytes((current) => {
      if (current) zeroize(current);
      return null;
    });
    setRecoveryPdfFilename("");
    setQrPracticeValue("");
    setQrVerified(false);
    setPracticeFile(null);
    setFileVerified(false);
    setWordsVerified(false);
    setRememberLocally(persistentStorageAvailable);
    setBusy(false);
    setError("");
    setVaultCreationError(false);
    setDialog(null);
    setStep("choice");
  };

  const abandonPendingSetup = () => {
    artifactOperation.current += 1;
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
      artifactOperation.current += 1;
      vaultJob.current?.cancel();
      readyTransfer.current?.abort();
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

  useEffect(() => {
    if (!persistentStorageAvailable) setRememberLocally(false);
  }, [persistentStorageAvailable]);

  useLayoutEffect(() => {
    if (!identityCreationSteps.includes(step as IdentityCreationStep)) return;
    wizardPanel.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [step]);

  useLayoutEffect(() => {
    if (vaultCreationError) vaultErrorSummary.current?.focus();
  }, [vaultCreationError]);

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
    for (const event of AUTO_LOCK_ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity);
    }
    document.addEventListener("visibilitychange", checkSuspendedTab);
    schedule();
    return () => {
      window.clearTimeout(timer);
      for (const event of AUTO_LOCK_ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity);
      }
      document.removeEventListener("visibilitychange", checkSuspendedTab);
    };
  }, [pendingIdentity, autoLockMs]);

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

  const createIdentity = async () => {
    setBusy(true);
    setError("");
    let entropy: Uint8Array | undefined;
    let derived: DerivedIdentity | undefined;
    let recovery: Uint8Array | undefined;
    let transferred = false;
    try {
      entropy = randomBytes(32);
      const validUsername = normalizePseudonym(username);
      const createdAt = BigInt(Math.floor(Date.now() / 1000));
      derived = {
        ...(await identityProvider.deriveIdentity(entropy)),
        pseudonym: validUsername,
        creationTime: createdAt,
      };
      const publicContact = identityProvider.createPublicContact(
        derived,
        validUsername,
        createdAt,
      );
      recovery = encodeRecoveryObject({
        magic: "PPXR",
        formatVersion: 1,
        suite: 1,
        flags: 0,
        masterEntropy: entropy,
        creationTime: createdAt,
        pseudonym: validUsername,
        checksum: new Uint8Array(16),
      });
      const recoveryWords =
        createRecoveryWordCodec().entropyToRecoveryWords(entropy);
      const positions = chooseRecoveryWordPositions(randomBytes(16));
      ownPendingIdentity(derived);
      setPendingContact(publicContact);
      ownRecoveryBytes(recovery);
      setWords(recoveryWords);
      setConfirmationPositions(positions);
      transferred = true;
      setStep("password");
    } catch {
      setError(t("setupError"));
    } finally {
      if (entropy) zeroize(entropy);
      if (!transferred) {
        if (derived) zeroizeIdentitySecrets(derived);
        if (recovery) zeroize(recovery);
      }
      if (mounted.current) setBusy(false);
    }
  };

  const createPendingVault = async (nextStep: Step = "digital-backups") => {
    if (!pendingIdentity) return;
    let operation: CryptoWorkerJob<LockedVaultObject> | null = null;
    setBusy(true);
    setError("");
    setVaultCreationError(false);
    try {
      operation = lockVaultJobFactory({
        identity: pendingIdentity,
        passphrase,
      });
      vaultJob.current = operation;
      const vault = await operation.promise;
      if (vaultJob.current !== operation) return;
      setPendingVault(vault);
      setStep(nextStep);
    } catch {
      if (!operation || vaultJob.current === operation) {
        setVaultCreationError(true);
      }
    } finally {
      if (!operation || vaultJob.current === operation) {
        vaultJob.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  };

  const recoveryCode = recoveryBytes
    ? `PPX1:RECOVERY:${encodeBase45Upper(recoveryBytes)}`
    : "";
  const recoveryIsoDate = pendingIdentity
    ? new Date(Number(pendingIdentity.creationTime) * 1000)
        .toISOString()
        .slice(0, 10)
    : "";

  const downloadRecoveryFile = () => {
    if (!recoveryBytes || !pendingIdentity) return;
    downloadBlob(
      new Blob([Uint8Array.from(recoveryBytes).buffer], {
        type: "application/x-ppx-recovery",
      }),
      recoveryArtifactFilename(
        pendingIdentity.pseudonym,
        recoveryIsoDate,
        "ppxrecovery",
      ),
    );
    setFileDownloaded(true);
  };

  const downloadPrivateQr = async () => {
    if (!pendingIdentity || recoveryCode === "") return;
    const identitySnapshot = pendingIdentity;
    const operation = ++artifactOperation.current;
    setBusy(true);
    setError("");
    try {
      const dataUrl = await privateCardGenerator(
        locale,
        pendingIdentity.pseudonym,
        recoveryCode,
      );
      if (
        operation !== artifactOperation.current ||
        pendingIdentityOwner.current !== identitySnapshot
      ) {
        return;
      }
      downloadDataUrl(
        dataUrl,
        recoveryArtifactFilename(
          pendingIdentity.pseudonym,
          recoveryIsoDate,
          "png",
        ),
      );
      setQrDownloaded(true);
    } catch {
      if (
        operation === artifactOperation.current &&
        pendingIdentityOwner.current === identitySnapshot
      ) {
        setError(t("recoveryArtifactError"));
      }
    } finally {
      if (mounted.current && operation === artifactOperation.current) {
        setBusy(false);
      }
    }
  };

  const buildRecoveryDocument = async (): Promise<RecoveryDocumentModel> => {
    if (!pendingIdentity || recoveryCode === "" || words.length !== 24) {
      throw new Error("Recovery document is unavailable");
    }
    return createRecoveryDocumentModel({
      locale,
      username: pendingIdentity.pseudonym,
      creationTime: pendingIdentity.creationTime,
      recoveryCode,
      words,
      password: passphrase,
      qrDataUrl: await recoveryQrGenerator(recoveryCode),
      usernameImageDataUrl: /[^\x20-\x7e]/u.test(pendingIdentity.pseudonym)
        ? usernameImageGenerator(pendingIdentity.pseudonym)
        : undefined,
    });
  };

  useEffect(() => {
    if (step !== "recovery-document" || !pendingIdentity) return;
    const identitySnapshot = pendingIdentity;
    const operation = ++artifactOperation.current;
    setBusy(true);
    setError("");
    void (async () => {
      try {
        const model = await buildRecoveryDocument();
        const bytes = await pdfGenerator(model);
        if (
          operation !== artifactOperation.current ||
          pendingIdentityOwner.current !== identitySnapshot
        ) {
          zeroize(bytes);
          return;
        }
        setPrintModel(model);
        setRecoveryPdfBytes(bytes);
        setRecoveryPdfFilename(
          recoveryArtifactFilename(model.username, model.isoDate, "pdf"),
        );
      } catch {
        if (
          operation === artifactOperation.current &&
          pendingIdentityOwner.current === identitySnapshot
        ) {
          setError(t("recoveryArtifactError"));
        }
      } finally {
        if (mounted.current && operation === artifactOperation.current) {
          setBusy(false);
        }
      }
    })();
    return () => {
      if (artifactOperation.current === operation) {
        artifactOperation.current += 1;
      }
    };
  }, [step]);

  const leaveSecretScreens = () => {
    clearSecretPresentation();
    setStep("qr-practice");
  };

  const verifyQrPractice = async () => {
    if (!pendingIdentity || qrPracticeValue.trim() === "") return;
    setBusy(true);
    setError("");
    try {
      const matched = await verifyRecoveryCodeForIdentity(
        qrPracticeValue.trim(),
        pendingIdentity.identityId,
        identityProvider,
      );
      if (!matched) throw new Error("identity mismatch");
      setQrPracticeValue("");
      setQrVerified(true);
      setStep("file-word-practice");
    } catch {
      setQrPracticeValue("");
      setError(t("practiceRecoveryError"));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const verifyFilePractice = async () => {
    if (!pendingIdentity || !practiceFile) return;
    setBusy(true);
    setError("");
    try {
      if (practiceFile.size < 1 || practiceFile.size > PPXR_MAXIMUM_SIZE) {
        throw new Error("invalid recovery file size");
      }
      const bytes = new Uint8Array(await practiceFile.arrayBuffer());
      try {
        const matched = await verifyRecoveryBytesForIdentity(
          bytes,
          pendingIdentity.identityId,
          identityProvider,
        );
        if (!matched) throw new Error("identity mismatch");
      } finally {
        zeroize(bytes);
      }
      setPracticeFile(null);
      setFileVerified(true);
    } catch {
      setPracticeFile(null);
      setError(t("practiceRecoveryError"));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const verifyWordPractice = () => {
    if (!pendingIdentity) return;
    const expected = createRecoveryWordCodec().entropyToRecoveryWords(
      pendingIdentity.masterEntropy,
    );
    const wrong = confirmationPositions.filter((position) => {
      const answer = normalizeRecoveryWordAnswer(
        confirmedWords[position] ?? "",
      );
      return (
        answer === null || answer !== expected[position]?.normalize("NFKD")
      );
    });
    setWrongWordPositions(wrong);
    if (wrong.length > 0) {
      expected.fill("");
      setWordAttempts((current) => current + 1);
      setError(t("wordPracticeError"));
      setConfirmedWords((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([position]) => !wrong.includes(Number(position)),
          ),
        ),
      );
      return;
    }
    expected.fill("");
    setConfirmedWords({});
    setWrongWordPositions([]);
    setWordsVerified(true);
    setError("");
    setStep("storage");
  };

  const finishNewIdentity = async () => {
    if (!pendingIdentity || !pendingContact) return;
    setBusy(true);
    setError("");
    try {
      await transferReady(
        pendingIdentity,
        pendingContact,
        rememberLocally ? (pendingVault ?? undefined) : undefined,
      );
    } catch {
      setError(t("setupError"));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const finishImportedSession = async () => {
    if (!pendingIdentity || !pendingContact) return;
    setBusy(true);
    try {
      await transferReady(pendingIdentity, pendingContact);
    } catch {
      setError(t("setupError"));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const finishImportedVault = async () => {
    if (!pendingIdentity || !pendingContact) return;
    let operation: CryptoWorkerJob<LockedVaultObject> | null = null;
    setBusy(true);
    setError("");
    try {
      operation = lockVaultJobFactory({
        identity: pendingIdentity,
        passphrase,
      });
      vaultJob.current = operation;
      const vault = await operation.promise;
      if (vaultJob.current !== operation) return;
      await transferReady(pendingIdentity, pendingContact, vault);
    } catch {
      if (!operation || vaultJob.current === operation) {
        setError(t("setupError"));
      }
    } finally {
      if (!operation || vaultJob.current === operation) {
        vaultJob.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  };

  const dialogOverlay =
    dialog === "skip" ? (
      <ConfirmationDialog
        t={t}
        title={t("expertSkipTitle")}
        body={t("expertSkipBody")}
        confirmLabel={t("skipPractice")}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          setStep("storage");
        }}
      />
    ) : dialog === "restart" ? (
      <ConfirmationDialog
        t={t}
        title={t("restartIdentityTitle")}
        body={t("restartIdentityBody")}
        confirmLabel={t("restartIdentityCreation")}
        onCancel={() => setDialog(null)}
        onConfirm={abandonPendingSetup}
      />
    ) : dialog === "weak-password" ? (
      <ConfirmationDialog
        t={t}
        title={t("weakVaultPasswordTitle")}
        body={t("weakVaultPasswordBody")}
        cancelLabel={t("changeVaultPassword")}
        confirmLabel={t("useWeakVaultPassword")}
        returnFocus={() => passwordInput.current}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          void createPendingVault();
        }}
      />
    ) : null;

  if (identity && contact) {
    return (
      <PublicContactCard
        pseudonym={contact.pseudonym}
        qrText={encodePublicContactQr(contact)}
        authorityLabel={t("publicAuthority")}
        title={t("publicLabel")}
        qrLabel={t("publicQrAlt")}
        qrDownloadLabel={t("saveContactQr")}
        enlargeQrLabel={t("showLargerQr")}
        closeQrLabel={t("closeLargerQr")}
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
    );
  }

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
              onClick={() => setStep("username")}
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
          setStep("import-remember");
        }}
      />
    );
  }

  if (step === "username") {
    return (
      <section class="flow-panel" ref={wizardPanel}>
        <WizardProgress t={t} current={1} />
        <h1 tabIndex={-1}>{t("createIdentity")}</h1>
        <p class="username-guidance">{t("usernameHint")}</p>
        <TextField
          id="username"
          label={t("username")}
          value={username}
          error={usernameError}
          onInput={setUsername}
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
            disabled={busy || normalizedUsername === "" || usernameError !== ""}
            onClick={() => void createIdentity()}
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

  if (step === "password") {
    return (
      <>
        <section class="flow-panel" ref={wizardPanel}>
          <WizardProgress t={t} current={2} />
          <h1 tabIndex={-1}>{t("passwordStepTitle")}</h1>
          <p class="lead">{t("passwordStepBody")}</p>
          <div class="passphrase-field-group">
            <TextField
              id="vault-password"
              inputRef={passwordInput}
              label={t("vaultPassword")}
              type="password"
              value={passphrase}
              error={passwordError}
              onInput={setPassphrase}
            />
            <PassphraseMeter value={passphrase} t={t} />
          </div>
          <TextField
            id="vault-password-confirmation"
            label={t("confirmVaultPassword")}
            type="password"
            value={passphraseConfirmation}
            error={passwordConfirmationError}
            onInput={setPassphraseConfirmation}
          />
          {vaultCreationError && (
            <ErrorSummary
              title={t("vaultCreationErrorTitle")}
              errors={[t("vaultCreationErrorBody")]}
              summaryRef={vaultErrorSummary}
            />
          )}
          <div class="action-row">
            <button
              class="button primary"
              type="button"
              disabled={
                busy ||
                passwordPolicyError !== null ||
                passphraseConfirmation !== passphrase
              }
              onClick={() => {
                if (passwordStrength === "weak") {
                  setDialog("weak-password");
                  return;
                }
                void createPendingVault();
              }}
            >
              {busy ? t("creatingIdentity") : t("createEncryptedVault")}
            </button>
            <SecretRestartButton t={t} onRestart={() => setDialog("restart")} />
          </div>
        </section>
        {dialogOverlay}
      </>
    );
  }

  if (step === "digital-backups") {
    return (
      <>
        <section class="flow-panel" ref={wizardPanel}>
          <WizardProgress t={t} current={3} />
          <h1 tabIndex={-1}>{t("digitalBackupsTitle")}</h1>
          <p class="lead">{t("digitalBackupsBody")}</p>
          <div class="backup-actions">
            <button
              class="button secondary"
              type="button"
              disabled={busy}
              onClick={() => void downloadPrivateQr()}
            >
              {t("savePrivateQr")}
            </button>
            <label class="check-row">
              <input
                type="checkbox"
                disabled={!qrDownloaded}
                checked={qrStored}
                onChange={(event) => setQrStored(event.currentTarget.checked)}
              />
              <span>{t("confirmQrStored")}</span>
            </label>
            <button
              class="button secondary"
              type="button"
              onClick={downloadRecoveryFile}
            >
              {t("downloadRecoveryFile")}
            </button>
            <label class="check-row">
              <input
                type="checkbox"
                disabled={!fileDownloaded}
                checked={fileStored}
                onChange={(event) => setFileStored(event.currentTarget.checked)}
              />
              <span>{t("confirmFileStored")}</span>
            </label>
          </div>
          {error && (
            <p class="field-error" role="alert">
              {error}
            </p>
          )}
          <button
            class="button primary"
            type="button"
            disabled={
              !backupCompletion.qrDownloaded ||
              !backupCompletion.recoveryFileDownloaded ||
              !backupCompletion.qrStored ||
              !backupCompletion.recoveryFileStored
            }
            onClick={() => setStep("recovery-document")}
          >
            {t("continueRecoveryWords")}
          </button>
          <SecretRestartButton t={t} onRestart={() => setDialog("restart")} />
        </section>
        {dialogOverlay}
      </>
    );
  }

  if (step === "recovery-document") {
    return (
      <>
        <section class="flow-panel recovery-flow" ref={wizardPanel}>
          <WizardProgress t={t} current={4} />
          <h1 tabIndex={-1}>{t("recoveryDocumentTitle")}</h1>
          <p class="danger-copy">{t("recoveryDocumentBody")}</p>
          <ol class="word-grid">
            {words.map((word, index) => (
              <li key={`${index}-${word}`}>{word}</li>
            ))}
          </ol>
          {printModel && recoveryPdfBytes ? (
            <RecoveryPdfPreview
              bytes={recoveryPdfBytes}
              filename={recoveryPdfFilename}
              locale={locale}
              onPrint={() => setPrintUsed(true)}
              onDownload={() => setPdfDownloaded(true)}
            />
          ) : (
            <p aria-live="polite">{busy ? t("creatingIdentity") : error}</p>
          )}
          <fieldset class="backup-methods">
            <legend>{t("confirmWordBackup")}</legend>
            <label class="check-row">
              <input
                type="checkbox"
                checked={recoveryDocumentCompletion.wordsWritten}
                onChange={(event) =>
                  setRecoveryDocumentCompletion((current) => ({
                    ...current,
                    wordsWritten: event.currentTarget.checked,
                  }))
                }
              />
              <span>{t("confirmWordsWritten")}</span>
            </label>
            <label class="check-row">
              <input
                type="checkbox"
                disabled={!printUsed}
                checked={recoveryDocumentCompletion.printStored}
                onChange={(event) =>
                  setRecoveryDocumentCompletion((current) => ({
                    ...current,
                    printStored: event.currentTarget.checked,
                  }))
                }
              />
              <span>{t("confirmPrintedRecovery")}</span>
            </label>
            <label class="check-row">
              <input
                type="checkbox"
                disabled={!pdfDownloaded}
                checked={recoveryDocumentCompletion.pdfStored}
                onChange={(event) =>
                  setRecoveryDocumentCompletion((current) => ({
                    ...current,
                    pdfStored: event.currentTarget.checked,
                  }))
                }
              />
              <span>{t("confirmPdfStored")}</span>
            </label>
          </fieldset>
          {error && (
            <p class="field-error" role="alert">
              {error}
            </p>
          )}
          <button
            class="button primary"
            type="button"
            disabled={
              !recoveryDocumentCompletion.wordsWritten ||
              !recoveryDocumentCompletion.printStored ||
              !recoveryDocumentCompletion.pdfStored
            }
            onClick={leaveSecretScreens}
          >
            {t("continueRestorePractice")}
          </button>
          <SecretRestartButton t={t} onRestart={() => setDialog("restart")} />
        </section>
        {dialogOverlay}
      </>
    );
  }

  if (step === "qr-practice") {
    return (
      <>
        <section class="flow-panel" ref={wizardPanel}>
          <WizardProgress t={t} current={5} />
          <h1 tabIndex={-1}>{t("qrPracticeTitle")}</h1>
          <p class="lead">{t("qrPracticeBody")}</p>
          {!recoveryPracticeState.qrVerified ? (
            <>
              <QrImport
                idPrefix="onboarding-recovery"
                t={t}
                onDecoded={setQrPracticeValue}
              />
              <div class="field">
                <div class="field-heading">
                  <label for="recovery-code-practice">
                    {t("privateRecoveryCode")}
                  </label>
                  <PasteButton
                    label={t("paste")}
                    unavailableLabel={t("pasteUnavailable")}
                    failureLabel={t("pasteFailed")}
                    disabled={busy}
                    onPaste={setQrPracticeValue}
                    onError={setError}
                  />
                </div>
                <textarea
                  id="recovery-code-practice"
                  value={qrPracticeValue}
                  onInput={(event) =>
                    setQrPracticeValue(event.currentTarget.value)
                  }
                />
              </div>
              <button
                class="button primary"
                type="button"
                disabled={busy || qrPracticeValue.trim() === ""}
                onClick={() => void verifyQrPractice()}
              >
                {t("verifyQrRecovery")}
              </button>
            </>
          ) : (
            <button
              class="button primary"
              type="button"
              onClick={() => setStep("file-word-practice")}
            >
              {t("continueFilePractice")}
            </button>
          )}
          {error && (
            <p class="field-error" role="alert">
              {error}
            </p>
          )}
          <button
            class="subtle-link-button"
            type="button"
            onClick={() => setDialog("skip")}
          >
            {t("expertSkip")}
          </button>
        </section>
        {dialogOverlay}
      </>
    );
  }

  if (step === "file-word-practice") {
    return (
      <>
        <section class="flow-panel" ref={wizardPanel}>
          <WizardProgress t={t} current={6} />
          <h1 tabIndex={-1}>{t("fileWordPracticeTitle")}</h1>
          {!recoveryPracticeState.recoveryFileVerified ? (
            <>
              <p>{t("filePracticeBody")}</p>
              <div class="field">
                <label for="practice-recovery-file">{t("recoveryFile")}</label>
                <input
                  id="practice-recovery-file"
                  type="file"
                  accept=".ppxrecovery,application/x-ppx-recovery"
                  onChange={(event) =>
                    setPracticeFile(event.currentTarget.files?.[0] ?? null)
                  }
                />
              </div>
              <button
                class="button primary"
                type="button"
                disabled={busy || !practiceFile}
                onClick={() => void verifyFilePractice()}
              >
                {t("verifyRecoveryFile")}
              </button>
            </>
          ) : !recoveryPracticeState.recoveryWordsVerified ? (
            <>
              <p>{t("wordPracticeBody")}</p>
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
                    error={
                      wrongWordPositions.includes(position)
                        ? t("wordIncorrect")
                        : ""
                    }
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
                class="button primary"
                type="button"
                onClick={verifyWordPractice}
              >
                {t("verifyRecoveryWords")}
              </button>
              {recoveryPracticeState.failedWordSubmissions >= 10 && (
                <SecretRestartButton
                  t={t}
                  onRestart={() => setDialog("restart")}
                />
              )}
            </>
          ) : (
            <button
              class="button primary"
              type="button"
              onClick={() => setStep("storage")}
            >
              {t("continueStorageChoice")}
            </button>
          )}
          {error && (
            <p class="field-error" role="alert">
              {error}
            </p>
          )}
          <div class="action-row">
            <button
              class="subtle-link-button"
              type="button"
              onClick={() => setDialog("skip")}
            >
              {t("expertSkip")}
            </button>
          </div>
        </section>
        {dialogOverlay}
      </>
    );
  }

  if (step === "storage") {
    return (
      <section class="flow-panel storage-flow" ref={wizardPanel}>
        <WizardProgress t={t} current={7} />
        <h1 tabIndex={-1}>{t("storageChoiceTitle")}</h1>
        <p class="lead">{t("storageChoiceBody")}</p>
        {!persistentStorageAvailable && (
          <p class="offline-banner" role="alert">
            {t("storageUnavailable")}
          </p>
        )}
        <fieldset class="choice-grid storage-choice">
          <legend class="sr-only">{t("storageChoiceTitle")}</legend>
          <label
            class={rememberLocally ? "choice-card selected" : "choice-card"}
          >
            <input
              type="radio"
              name="storage-choice"
              disabled={!persistentStorageAvailable}
              checked={rememberLocally}
              onChange={() => setRememberLocally(true)}
            />
            <strong>{t("rememberRecommended")}</strong>
            <span>{t("rememberRecommendedBody")}</span>
          </label>
          <label
            class={!rememberLocally ? "choice-card selected" : "choice-card"}
          >
            <input
              type="radio"
              name="storage-choice"
              checked={!rememberLocally}
              onChange={() => setRememberLocally(false)}
            />
            <strong>{t("useSessionOnly")}</strong>
            <span>{t("sessionOnlyText")}</span>
          </label>
        </fieldset>
        <p class="storage-recovery-note">{t("storageRecoveryNote")}</p>
        <p class="danger-copy">{t("identityLossWarning")}</p>
        {error && (
          <p class="field-error" role="alert">
            {error}
          </p>
        )}
        <div class="action-row">
          <button
            class="button primary"
            type="button"
            disabled={busy}
            onClick={() => void finishNewIdentity()}
          >
            {t("finishIdentitySetup")}
          </button>
          <button
            class="button secondary"
            type="button"
            onClick={() => setStep("file-word-practice")}
          >
            {t("back")}
          </button>
        </div>
      </section>
    );
  }

  if (step === "import-remember") {
    return (
      <section class="flow-panel">
        <h1>{t("rememberTitle")}</h1>
        <p class="lead">{t("rememberBody")}</p>
        <div class="choice-grid">
          <button
            class="choice-card"
            type="button"
            disabled={busy}
            onClick={() => void finishImportedSession()}
          >
            <strong>{t("useSessionOnly")}</strong>
          </button>
          <button
            class="choice-card"
            type="button"
            onClick={() => setStep("import-vault")}
          >
            <strong>{t("rememberDevice")}</strong>
          </button>
        </div>
      </section>
    );
  }

  if (step === "import-vault") {
    const passphraseBytes = new TextEncoder().encode(passphrase).byteLength;
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
        <PassphraseMeter value={passphrase} t={t} />
        <p class="input-meta">{t("passphraseHint")}</p>
        {passphraseBytes > 256 && (
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
          disabled={busy || passphraseBytes === 0 || passphraseBytes > 256}
          onClick={() => void finishImportedVault()}
        >
          {t("saveEncryptedVault")}
        </button>
      </section>
    );
  }

  return null;
}
