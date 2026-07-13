import type { PPXWorkerEvent, PPXWorkerRequest } from "../crypto/contracts";
import { zeroize } from "../crypto/zeroize";
import type {
  DecryptedTextOutput,
  DecryptTextInput,
  DerivedIdentity,
  EncryptedTextObject,
  EncryptTextInput,
  LockedVaultObject,
  LockVaultInput,
  UnlockVaultInput,
} from "../protocol/types";
import { PPXError } from "../protocol/types";

export interface CryptoWorkerJob<T> {
  readonly requestId: string;
  readonly promise: Promise<T>;
  cancel(): void;
}

function createRequestId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : [...crypto.getRandomValues(new Uint8Array(16))]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function startCryptoJob<T>(
  request: Exclude<
    PPXWorkerRequest,
    { kind: "cancel" | "encrypt-file" | "decrypt-file" }
  >,
): CryptoWorkerJob<T> {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./crypto-worker.ts", import.meta.url), {
      type: "module",
      name: "ppx-crypto-worker",
    });
  } catch (error) {
    if (request.kind === "encrypt-text") {
      zeroize(request.input.senderSigningCapability.signingSecretKey);
    }
    throw error;
  }
  let settled = false;
  let cancelRequested = false;
  let cancellationTimer: number | null = null;
  let resolveJob!: (result: T) => void;
  let rejectJob!: (error: Error) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveJob = resolve;
    rejectJob = reject;
  });
  const close = () => {
    settled = true;
    if (cancellationTimer !== null) window.clearTimeout(cancellationTimer);
    cancellationTimer = null;
    worker.terminate();
  };
  worker.addEventListener(
    "message",
    (message: MessageEvent<PPXWorkerEvent>) => {
      const event = message.data;
      if (event.requestId !== request.requestId || settled) return;
      if (event.kind === "progress") return;
      close();
      if (cancelRequested && event.kind !== "cancelled") {
        rejectJob(new Error("cancelled"));
      } else if (event.kind === "completed") resolveJob(event.result as T);
      else if (event.kind === "cancelled") rejectJob(new Error("cancelled"));
      else rejectJob(new PPXError(event.code));
    },
  );
  const failWorker = () => {
    if (settled) return;
    close();
    rejectJob(
      cancelRequested
        ? new Error("cancelled")
        : new PPXError("wrong-identity-or-corruption"),
    );
  };
  worker.addEventListener("error", failWorker);
  worker.addEventListener("messageerror", failWorker);
  try {
    worker.postMessage(request);
  } catch {
    failWorker();
  } finally {
    if (request.kind === "encrypt-text") {
      zeroize(request.input.senderSigningCapability.signingSecretKey);
    }
  }
  return {
    requestId: request.requestId,
    promise,
    cancel() {
      if (settled || cancelRequested) return;
      cancelRequested = true;
      try {
        worker.postMessage({ kind: "cancel", requestId: request.requestId });
      } catch {
        close();
        rejectJob(new Error("cancelled"));
        return;
      }
      cancellationTimer = window.setTimeout(() => {
        if (settled) return;
        close();
        rejectJob(new Error("cancelled"));
      }, 5_000);
    },
  };
}

export function startEncryptTextJob(
  input: EncryptTextInput,
): CryptoWorkerJob<EncryptedTextObject> {
  try {
    const requestId = createRequestId();
    return startCryptoJob({ kind: "encrypt-text", requestId, input });
  } catch (error) {
    zeroize(input.senderSigningCapability.signingSecretKey);
    throw error;
  }
}

export function startDecryptTextJob(
  input: DecryptTextInput,
): CryptoWorkerJob<DecryptedTextOutput> {
  const requestId = createRequestId();
  return startCryptoJob({ kind: "decrypt-text", requestId, input });
}

export function startLockVaultJob(
  input: LockVaultInput,
): CryptoWorkerJob<LockedVaultObject> {
  const requestId = createRequestId();
  return startCryptoJob({ kind: "lock-vault", requestId, input });
}

export function startUnlockVaultJob(
  input: UnlockVaultInput,
): CryptoWorkerJob<DerivedIdentity> {
  const requestId = createRequestId();
  return startCryptoJob({ kind: "unlock-vault", requestId, input });
}
