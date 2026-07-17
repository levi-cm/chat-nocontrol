import {
  cloneDecapsulationCapabilityV2,
  validateSenderSigningCapabilityV2,
  zeroizeDecapsulationCapabilityV2,
  zeroizeSenderSigningCapabilityV2,
} from "../crypto/capability-v2";
import type {
  PPXCryptoWorkerRequest,
  PPXWorkerEvent,
} from "../crypto/contracts";
import type {
  DecryptedTextOutputV2,
  DecryptTextInputV2,
  DerivedIdentityV2,
  EncryptedTextObjectV2,
  EncryptTextInputV2,
  LockedVaultObjectV2,
} from "../protocol/types-v2";
import { PPXError } from "../protocol/types";
import type { LockVaultInputV2, UnlockVaultInputV2 } from "../crypto/vault-v2";

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

function releaseRequestAuthority(
  request: Exclude<PPXCryptoWorkerRequest, { kind: "cancel" }>,
): void {
  if (request.kind === "decrypt-text") {
    zeroizeDecapsulationCapabilityV2(request.input.activeIdentity);
  } else if (request.kind === "encrypt-text") {
    zeroizeSenderSigningCapabilityV2(request.input.senderSigningCapability);
  }
}

function startCryptoJob<T>(
  request: Exclude<PPXCryptoWorkerRequest, { kind: "cancel" }>,
): CryptoWorkerJob<T> {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./crypto-worker.ts", import.meta.url), {
      type: "module",
      name: "ppx-crypto-worker",
    });
  } catch (error) {
    releaseRequestAuthority(request);
    throw error;
  }
  let settled = false;
  let resolveJob!: (result: T) => void;
  let rejectJob!: (error: Error) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveJob = resolve;
    rejectJob = reject;
  });
  const close = () => {
    settled = true;
    worker.terminate();
  };
  worker.addEventListener(
    "message",
    (message: MessageEvent<PPXWorkerEvent>) => {
      const event = message.data;
      if (event.requestId !== request.requestId || settled) return;
      if (event.kind === "progress") return;
      close();
      if (event.kind === "completed") resolveJob(event.result as T);
      else if (event.kind === "cancelled") rejectJob(new Error("cancelled"));
      else rejectJob(new PPXError(event.code));
    },
  );
  const failWorker = () => {
    if (settled) return;
    close();
    rejectJob(new PPXError("wrong-identity-or-corruption"));
  };
  worker.addEventListener("error", failWorker);
  worker.addEventListener("messageerror", failWorker);
  try {
    worker.postMessage(request);
  } catch {
    failWorker();
  } finally {
    releaseRequestAuthority(request);
  }
  return {
    requestId: request.requestId,
    promise,
    cancel() {
      if (settled) return;
      close();
      rejectJob(new Error("cancelled"));
    },
  };
}

export function startEncryptTextJob(
  input: EncryptTextInputV2,
): CryptoWorkerJob<EncryptedTextObjectV2> {
  try {
    validateSenderSigningCapabilityV2(input.senderSigningCapability);
    return startCryptoJob({
      kind: "encrypt-text",
      requestId: createRequestId(),
      input,
    });
  } catch (error) {
    zeroizeSenderSigningCapabilityV2(input.senderSigningCapability);
    throw error;
  }
}

export function startDecryptTextJob(
  input: DecryptTextInputV2,
): CryptoWorkerJob<DecryptedTextOutputV2> {
  const requestId = createRequestId();
  return startCryptoJob({
    kind: "decrypt-text",
    requestId,
    input: {
      ...input,
      activeIdentity: cloneDecapsulationCapabilityV2(input.activeIdentity),
    },
  });
}

export function startLockVaultJob(
  input: LockVaultInputV2,
): CryptoWorkerJob<LockedVaultObjectV2> {
  return startCryptoJob({
    kind: "lock-vault",
    requestId: createRequestId(),
    input,
  });
}

export function startUnlockVaultJob(
  input: UnlockVaultInputV2,
): CryptoWorkerJob<DerivedIdentityV2> {
  return startCryptoJob({
    kind: "unlock-vault",
    requestId: createRequestId(),
    input,
  });
}
