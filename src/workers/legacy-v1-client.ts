import { zeroize, zeroizeIdentitySecretsV2 } from "../crypto/zeroize";
import { PPXError } from "../protocol/types";
import type {
  DecryptedFileOutput,
  DecryptedQrTextOutput,
  DecryptedTextOutput,
  EncryptedFileObject,
  EncryptedTextObject,
} from "../protocol/types";
import type { DerivedIdentityV2 } from "../protocol/types-v2";
import type {
  LegacyV1WorkerEvent,
  LegacyV1WorkerRequest,
} from "./legacy-v1-contracts";

type ActiveLegacyV1Request = Exclude<LegacyV1WorkerRequest, { kind: "cancel" }>;
type ProgressEvent = Extract<LegacyV1WorkerEvent, { kind: "progress" }>;

export class LegacyV1WorkerCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "LegacyV1WorkerCancelled";
  }
}

export interface LegacyV1WorkerJob<T> {
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

function releaseRequestSecrets(request: ActiveLegacyV1Request): void {
  if (request.kind === "decrypt-compact-v1") {
    zeroize(
      request.input.ppxqBytes,
      request.input.senderContactBytes,
      request.input.masterEntropy,
    );
  } else if (
    request.kind === "decrypt-text-v1" ||
    request.kind === "decrypt-file-v1"
  ) {
    zeroize(request.input.masterEntropy);
  } else {
    zeroize(request.input.bytes);
  }
}

function isDerivedIdentityV2(value: unknown): value is DerivedIdentityV2 {
  return (
    typeof value === "object" &&
    value !== null &&
    "masterEntropy" in value &&
    "kemSecretKey" in value &&
    "signingSecretKey" in value
  );
}

function startLegacyV1Job<T>(
  request: ActiveLegacyV1Request,
  onProgress?: (event: ProgressEvent) => void,
): LegacyV1WorkerJob<T> {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./legacy-v1-worker.ts", import.meta.url), {
      type: "module",
      name: "ppx-legacy-v1-reader",
    });
  } catch (error) {
    releaseRequestSecrets(request);
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
    (message: MessageEvent<LegacyV1WorkerEvent>) => {
      const event = message.data;
      if (event.requestId !== request.requestId || settled) return;
      if (event.kind === "progress") {
        onProgress?.(event);
        return;
      }
      close();
      if (cancelRequested && event.kind !== "cancelled") {
        if (event.kind === "completed" && isDerivedIdentityV2(event.result)) {
          zeroizeIdentitySecretsV2(event.result);
        }
        rejectJob(new LegacyV1WorkerCancelled());
      } else if (event.kind === "completed") {
        resolveJob(event.result as T);
      } else if (event.kind === "cancelled") {
        rejectJob(new LegacyV1WorkerCancelled());
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
        ? new LegacyV1WorkerCancelled()
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
    releaseRequestSecrets(request);
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
        rejectJob(new LegacyV1WorkerCancelled());
        return;
      }
      cancellationTimer = window.setTimeout(() => {
        if (settled) return;
        close();
        rejectJob(new LegacyV1WorkerCancelled());
      }, 5_000);
    },
  };
}

export function startLegacyTextDecryptJob(input: {
  object: EncryptedTextObject;
  masterEntropy: Uint8Array;
}): LegacyV1WorkerJob<DecryptedTextOutput> {
  return startLegacyV1Job({
    kind: "decrypt-text-v1",
    requestId: createRequestId(),
    input: {
      object: input.object,
      masterEntropy: Uint8Array.from(input.masterEntropy),
    },
  });
}

export function startLegacyCompactTextDecryptJob(input: {
  ppxqBytes: Uint8Array;
  senderContactBytes: Uint8Array;
  masterEntropy: Uint8Array;
}): LegacyV1WorkerJob<DecryptedQrTextOutput> {
  return startLegacyV1Job({
    kind: "decrypt-compact-v1",
    requestId: createRequestId(),
    input: {
      ppxqBytes: Uint8Array.from(input.ppxqBytes),
      senderContactBytes: Uint8Array.from(input.senderContactBytes),
      masterEntropy: Uint8Array.from(input.masterEntropy),
    },
  });
}

export function startLegacyFileDecryptJob(
  input: {
    object: EncryptedFileObject | Blob;
    masterEntropy: Uint8Array;
  },
  onProgress?: (event: ProgressEvent) => void,
): LegacyV1WorkerJob<DecryptedFileOutput> {
  return startLegacyV1Job(
    {
      kind: "decrypt-file-v1",
      requestId: createRequestId(),
      input: {
        object: input.object,
        masterEntropy: Uint8Array.from(input.masterEntropy),
      },
    },
    onProgress,
  );
}

export function startLegacyRecoveryMigrationJob(
  bytes: Uint8Array,
): LegacyV1WorkerJob<DerivedIdentityV2> {
  const ownedBytes = Uint8Array.from(bytes);
  zeroize(bytes);
  return startLegacyV1Job({
    kind: "migrate-recovery-v1",
    requestId: createRequestId(),
    input: { bytes: ownedBytes },
  });
}

export function startLegacyVaultMigrationJob(input: {
  bytes: Uint8Array;
  passphrase: string;
}): LegacyV1WorkerJob<DerivedIdentityV2> {
  const ownedBytes = Uint8Array.from(input.bytes);
  zeroize(input.bytes);
  return startLegacyV1Job({
    kind: "migrate-vault-v1",
    requestId: createRequestId(),
    input: { bytes: ownedBytes, passphrase: input.passphrase },
  });
}
