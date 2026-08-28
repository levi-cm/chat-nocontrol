import {
  validateDecapsulationCapabilityV2,
  validateSenderSigningCapabilityV2,
  zeroizeDecapsulationCapabilityV2,
  zeroizeSenderSigningCapabilityV2,
} from "../crypto/capability-v2";
import type { PPXFileWorkerRequest, PPXWorkerEvent } from "../crypto/contracts";
import type {
  DecryptFileSourceInputV2,
  EncryptedFileBlobOutputV2,
} from "../crypto/file-v2";
import type {
  DecryptedFileOutputV2,
  EncryptFileInputV2,
} from "../protocol/types-v2";
import { PPXError } from "../protocol/types";

type ProgressEvent = Extract<PPXWorkerEvent, { kind: "progress" }>;

export class FileWorkerCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "FileWorkerCancelled";
  }
}

export interface FileWorkerJob<T> {
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
  request: Exclude<PPXFileWorkerRequest, { kind: "cancel" }>,
): void {
  if (request.kind === "decrypt-file") {
    zeroizeDecapsulationCapabilityV2(request.input.activeIdentity);
  } else {
    zeroizeSenderSigningCapabilityV2(request.input.senderSigningCapability);
  }
}

function startFileJob<T>(
  request: Exclude<PPXFileWorkerRequest, { kind: "cancel" }>,
  onProgress?: (event: ProgressEvent) => void,
): FileWorkerJob<T> {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./file-worker.ts", import.meta.url), {
      type: "module",
      name: "ppx-file-worker",
    });
  } catch (error) {
    releaseRequestAuthority(request);
    throw error;
  }
  let settled = false;
  let cancelRequested = false;
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
      if (event.kind === "progress") {
        onProgress?.(event);
        return;
      }
      close();
      if (cancelRequested && event.kind !== "cancelled") {
        rejectJob(new FileWorkerCancelled());
      } else if (event.kind === "completed") {
        resolveJob(event.result as T);
      } else if (event.kind === "cancelled") {
        rejectJob(new FileWorkerCancelled());
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
        ? new FileWorkerCancelled()
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
    releaseRequestAuthority(request);
  }
  return {
    requestId: request.requestId,
    promise,
    cancel() {
      if (settled || cancelRequested) return;
      cancelRequested = true;
      // Each file job owns its worker. Termination is the only synchronous
      // cancellation boundary during the authenticated plaintext-release
      // pass; a queued cancel message can otherwise wait behind more crypto.
      close();
      rejectJob(new FileWorkerCancelled());
    },
  };
}

export function startEncryptFileJob(
  input: EncryptFileInputV2,
  onProgress?: (event: ProgressEvent) => void,
): FileWorkerJob<EncryptedFileBlobOutputV2> {
  try {
    validateSenderSigningCapabilityV2(input.senderSigningCapability);
    return startFileJob(
      { kind: "encrypt-file", requestId: createRequestId(), input },
      onProgress,
    );
  } catch (error) {
    zeroizeSenderSigningCapabilityV2(input.senderSigningCapability);
    throw error;
  }
}

export function startDecryptFileJob(
  input: DecryptFileSourceInputV2,
  onProgress?: (event: ProgressEvent) => void,
): FileWorkerJob<DecryptedFileOutputV2> {
  try {
    validateDecapsulationCapabilityV2(input.activeIdentity);
  } catch (error) {
    zeroizeDecapsulationCapabilityV2(input.activeIdentity);
    throw error;
  }
  return startFileJob(
    {
      kind: "decrypt-file",
      requestId: createRequestId(),
      input: {
        ...input,
        activeIdentity: {
          suite: input.activeIdentity.suite,
          fingerprint: input.activeIdentity.fingerprint,
          identityId: input.activeIdentity.identityId,
          kemSecretKey: input.activeIdentity.kemSecretKey,
        },
      },
    },
    onProgress,
  );
}
