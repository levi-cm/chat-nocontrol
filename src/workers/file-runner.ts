import {
  validateDecapsulationCapabilityV2,
  validateSenderSigningCapabilityV2,
  zeroizeDecapsulationCapabilityV2,
  zeroizeSenderSigningCapabilityV2,
} from "../crypto/capability-v2";
import type {
  PPXFileWorkerRequest,
  PPXSafeWorkerError,
  PPXWorkerEvent,
} from "../crypto/contracts";
import {
  decryptFileV2,
  encryptFileToBlobV2,
  FileOperationCancelledV2,
} from "../crypto/file-v2";
import { PPXError } from "../protocol/types";

export interface FileRunner {
  handle(request: PPXFileWorkerRequest): Promise<void>;
}

function safeErrorCode(error: unknown): PPXSafeWorkerError {
  return error instanceof PPXError
    ? error.code
    : "wrong-identity-or-corruption";
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

export function createFileRunner(
  emit: (event: PPXWorkerEvent) => void,
): FileRunner {
  const active = new Set<string>();
  const cancelled = new Set<string>();
  return {
    async handle(request) {
      if (request.kind === "cancel") {
        if (active.has(request.requestId)) cancelled.add(request.requestId);
        return;
      }
      if (active.has(request.requestId)) {
        releaseRequestAuthority(request);
        emit({
          kind: "error",
          requestId: request.requestId,
          code: "wrong-identity-or-corruption",
        });
        return;
      }
      active.add(request.requestId);
      try {
        const hooks = {
          isCancelled: () => cancelled.has(request.requestId),
          onProgress: (progress: {
            stage: "parse" | "encrypt" | "decrypt" | "sign" | "serialize";
            completedBytes: bigint;
            totalBytes: bigint;
            chunkIndex?: number;
          }) =>
            emit({
              kind: "progress",
              requestId: request.requestId,
              ...progress,
            }),
        };
        if (request.kind === "encrypt-file") {
          validateSenderSigningCapabilityV2(
            request.input.senderSigningCapability,
          );
          const result = await encryptFileToBlobV2(request.input, hooks);
          if (cancelled.has(request.requestId)) {
            throw new FileOperationCancelledV2();
          }
          emit({ kind: "completed", requestId: request.requestId, result });
        } else {
          validateDecapsulationCapabilityV2(request.input.activeIdentity);
          const result = await decryptFileV2(request.input, hooks);
          if (cancelled.has(request.requestId)) {
            throw new FileOperationCancelledV2();
          }
          emit({ kind: "completed", requestId: request.requestId, result });
        }
      } catch (error) {
        emit(
          error instanceof FileOperationCancelledV2 ||
            cancelled.has(request.requestId)
            ? { kind: "cancelled", requestId: request.requestId }
            : {
                kind: "error",
                requestId: request.requestId,
                code: safeErrorCode(error),
              },
        );
      } finally {
        releaseRequestAuthority(request);
        active.delete(request.requestId);
        cancelled.delete(request.requestId);
      }
    },
  };
}
