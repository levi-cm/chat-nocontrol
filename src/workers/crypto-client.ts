import {
  validateDecapsulationCapabilityV2,
  validateSenderSigningCapabilityV2,
  zeroizeDecapsulationCapabilityV2,
  zeroizeSenderSigningCapabilityV2,
} from "../crypto/capability-v2";
import type {
  PPXCryptoWorkerRequest,
  PPXWorkerEvent,
} from "../crypto/contracts";
import type { LockVaultInputV2, UnlockVaultInputV2 } from "../crypto/vault-v2";
import { PPXError } from "../protocol/types";
import type {
  DecryptedTextOutputV2,
  DecryptTextInputV2,
  DerivedIdentityV2,
  EncryptedTextObjectV2,
  EncryptTextInputV2,
  LockedVaultObjectV2,
  PublicContactV2,
  DecapsulationCapabilityV2,
  SenderSigningCapabilityV2,
} from "../protocol/types-v2";

export interface CryptoWorkerJob<T> {
  readonly requestId: string;
  readonly promise: Promise<T>;
  cancel(): void;
}

type ActiveCryptoRequest = Exclude<PPXCryptoWorkerRequest, { kind: "cancel" }>;

function createRequestId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : [...crypto.getRandomValues(new Uint8Array(16))]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function clonePublicContact(contact: PublicContactV2): PublicContactV2 {
  return {
    magic: contact.magic,
    formatVersion: contact.formatVersion,
    suite: contact.suite,
    creationTime: contact.creationTime,
    pseudonym: contact.pseudonym,
    kemPublicKey: Uint8Array.from(contact.kemPublicKey),
    signingPublicKey: Uint8Array.from(contact.signingPublicKey),
    selfSignature: Uint8Array.from(contact.selfSignature),
    checksum: Uint8Array.from(contact.checksum),
    fingerprint: Uint8Array.from(contact.fingerprint),
    identityId: Uint8Array.from(contact.identityId),
  };
}

function cloneEncryptedTextObject(
  object: EncryptedTextObjectV2,
): EncryptedTextObjectV2 {
  return {
    magic: object.magic,
    formatVersion: object.formatVersion,
    suite: object.suite,
    flags: object.flags,
    mlKemCiphertext: Uint8Array.from(object.mlKemCiphertext),
    salt: Uint8Array.from(object.salt),
    nonce: Uint8Array.from(object.nonce),
    ciphertextLength: object.ciphertextLength,
    ciphertext: Uint8Array.from(object.ciphertext),
    checksum: Uint8Array.from(object.checksum),
  };
}

function cloneLockedVault(vault: LockedVaultObjectV2): LockedVaultObjectV2 {
  return {
    magic: vault.magic,
    formatVersion: vault.formatVersion,
    suite: vault.suite,
    flags: vault.flags,
    kdfId: vault.kdfId,
    scryptN: vault.scryptN,
    scryptR: vault.scryptR,
    scryptP: vault.scryptP,
    salt: Uint8Array.from(vault.salt),
    nonce: Uint8Array.from(vault.nonce),
    ciphertextLength: vault.ciphertextLength,
    ciphertext: Uint8Array.from(vault.ciphertext),
    checksum: Uint8Array.from(vault.checksum),
  };
}

function moveSenderSigningCapability(
  capability: SenderSigningCapabilityV2,
): SenderSigningCapabilityV2 {
  try {
    validateSenderSigningCapabilityV2(capability);
    return {
      suite: capability.suite,
      fingerprint: capability.fingerprint,
      signingPublicKey: capability.signingPublicKey,
      signingSecretKey: capability.signingSecretKey,
    };
  } catch (error) {
    zeroizeSenderSigningCapabilityV2(capability);
    throw error;
  }
}

function moveDecapsulationCapability(
  capability: DecapsulationCapabilityV2,
): DecapsulationCapabilityV2 {
  try {
    validateDecapsulationCapabilityV2(capability);
    return {
      suite: capability.suite,
      fingerprint: capability.fingerprint,
      identityId: capability.identityId,
      kemSecretKey: capability.kemSecretKey,
    };
  } catch (error) {
    zeroizeDecapsulationCapabilityV2(capability);
    throw error;
  }
}

function collectArrayBuffers(
  value: unknown,
  buffers: Set<ArrayBuffer>,
  visited: Set<object>,
): void {
  if (Object.prototype.toString.call(value) === "[object Uint8Array]") {
    const bytes = value as Uint8Array;
    if (
      Object.prototype.toString.call(bytes.buffer) === "[object ArrayBuffer]"
    ) {
      buffers.add(bytes.buffer as ArrayBuffer);
    }
    return;
  }
  if (typeof value !== "object" || value === null || visited.has(value)) return;
  visited.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectArrayBuffers(item, buffers, visited);
    return;
  }
  for (const item of Object.values(value)) {
    collectArrayBuffers(item, buffers, visited);
  }
}

function transferList(value: unknown): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  collectArrayBuffers(value, buffers, new Set<object>());
  return [...buffers];
}

function zeroizeTransferList(buffers: readonly ArrayBuffer[]): void {
  for (const buffer of buffers) {
    if (buffer.byteLength > 0) new Uint8Array(buffer).fill(0);
  }
}

export function cryptoRequestTransferList(
  request: PPXCryptoWorkerRequest,
): ArrayBuffer[] {
  return request.kind === "cancel" ? [] : transferList(request.input);
}

function releaseRequestBuffers(request: ActiveCryptoRequest): void {
  zeroizeTransferList(cryptoRequestTransferList(request));
}

function releaseEventBuffers(event: PPXWorkerEvent): void {
  if (event.kind === "completed")
    zeroizeTransferList(transferList(event.result));
}

function startCryptoJob<T>(request: ActiveCryptoRequest): CryptoWorkerJob<T> {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./crypto-worker.ts", import.meta.url), {
      type: "module",
      name: "ppx-crypto-worker",
    });
  } catch (error) {
    releaseRequestBuffers(request);
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
      if (event.requestId !== request.requestId || settled) {
        releaseEventBuffers(event);
        return;
      }
      if (event.kind === "progress") return;
      close();
      if (cancelRequested) {
        releaseEventBuffers(event);
        rejectJob(new Error("cancelled"));
      } else if (event.kind === "completed") {
        resolveJob(event.result as T);
      } else if (event.kind === "cancelled") {
        rejectJob(new Error("cancelled"));
      } else {
        rejectJob(new PPXError(event.code));
      }
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
    worker.postMessage(request, cryptoRequestTransferList(request));
  } catch {
    releaseRequestBuffers(request);
    failWorker();
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
      if (settled) return;
      cancellationTimer = window.setTimeout(() => {
        if (settled) return;
        close();
        rejectJob(new Error("cancelled"));
      }, 5_000);
    },
  };
}

export function startEncryptTextJob(
  input: EncryptTextInputV2,
): CryptoWorkerJob<EncryptedTextObjectV2> {
  const requestId = createRequestId();
  const sender = clonePublicContact(input.sender);
  const recipient = clonePublicContact(input.recipient);
  const messageId = Uint8Array.from(input.messageId);
  const senderSigningCapability = moveSenderSigningCapability(
    input.senderSigningCapability,
  );
  return startCryptoJob({
    kind: "encrypt-text",
    requestId,
    input: {
      compact: input.compact,
      sender,
      senderSigningCapability,
      recipient,
      plaintext: input.plaintext,
      messageId,
      sentAt: input.sentAt,
      createdAt: input.createdAt,
    },
  });
}

export function startDecryptTextJob(
  input: DecryptTextInputV2,
): CryptoWorkerJob<DecryptedTextOutputV2> {
  const requestId = createRequestId();
  const object = cloneEncryptedTextObject(input.object);
  const knownSenders = input.knownSenders.map(clonePublicContact);
  const activeIdentity = moveDecapsulationCapability(input.activeIdentity);
  return startCryptoJob({
    kind: "decrypt-text",
    requestId,
    input: {
      object,
      activeIdentity,
      knownSenders,
    },
  });
}

export function startLockVaultJob(
  input: LockVaultInputV2,
): CryptoWorkerJob<LockedVaultObjectV2> {
  const requestId = createRequestId();
  const creationTime = input.identity.creationTime;
  const pseudonym = input.identity.pseudonym;
  const passphrase = input.passphrase;
  const masterEntropy = Uint8Array.from(input.identity.masterEntropy);
  return startCryptoJob({
    kind: "lock-vault",
    requestId,
    input: {
      identity: {
        masterEntropy,
        creationTime,
        pseudonym,
      },
      passphrase,
    },
  });
}

export function startUnlockVaultJob(
  input: UnlockVaultInputV2,
): CryptoWorkerJob<DerivedIdentityV2> {
  const requestId = createRequestId();
  return startCryptoJob({
    kind: "unlock-vault",
    requestId,
    input: {
      vault: cloneLockedVault(input.vault),
      passphrase: input.passphrase,
    },
  });
}
