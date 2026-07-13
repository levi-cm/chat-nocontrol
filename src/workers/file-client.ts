import type { PPXWorkerEvent } from "../crypto/contracts";
import type {
  DecryptedFileOutput,
  DecryptFileInput,
  EncryptedFileBlobOutput,
  EncryptFileInput,
} from "../protocol/types";
import { PPXError } from "../protocol/types";
import { zeroize } from "../crypto/zeroize";

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

function startFileJob<T>(
  request:
    | { kind: "encrypt-file"; requestId: string; input: EncryptFileInput }
    | { kind: "decrypt-file"; requestId: string; input: DecryptFileInput },
  onProgress?: (event: ProgressEvent) => void,
): FileWorkerJob<T> {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./file-worker.ts", import.meta.url), {
      type: "module",
      name: "ppx-file-worker",
    });
  } catch (error) {
    if (request.kind === "encrypt-file") {
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
      if (event.kind === "progress") {
        onProgress?.(event);
        return;
      }
      close();
      if (cancelRequested && event.kind !== "cancelled") {
        rejectJob(new FileWorkerCancelled());
        return;
      }
      if (event.kind === "completed") {
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
    if (request.kind === "encrypt-file") {
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
        rejectJob(new FileWorkerCancelled());
        return;
      }
      cancellationTimer = window.setTimeout(() => {
        if (settled) return;
        close();
        rejectJob(new FileWorkerCancelled());
      }, 5_000);
    },
  };
}

export function startEncryptFileJob(
  input: EncryptFileInput,
  onProgress?: (event: ProgressEvent) => void,
): FileWorkerJob<EncryptedFileBlobOutput> {
  try {
    const requestId = createRequestId();
    return startFileJob({ kind: "encrypt-file", requestId, input }, onProgress);
  } catch (error) {
    zeroize(input.senderSigningCapability.signingSecretKey);
    throw error;
  }
}

export function startDecryptFileJob(
  input: DecryptFileInput,
  onProgress?: (event: ProgressEvent) => void,
): FileWorkerJob<DecryptedFileOutput> {
  const requestId = createRequestId();
  return startFileJob({ kind: "decrypt-file", requestId, input }, onProgress);
}
