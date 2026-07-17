import type {
  PPXSafeWorkerError,
  PPXWorkerEvent,
  PPXWorkerRequest,
} from "../crypto/contracts";
import { defaultCryptoProvider } from "../crypto/default-provider";
import {
  validateDecapsulationCapability,
  zeroizeDecapsulationCapability,
} from "../crypto/decapsulation-capability";
import { FileOperationCancelled } from "../crypto/file";
import { PPXError } from "../protocol/types";

export interface FileRunner {
  handle(request: PPXWorkerRequest): Promise<void>;
}

function safeErrorCode(error: unknown): PPXSafeWorkerError {
  return error instanceof PPXError
    ? error.code
    : "wrong-identity-or-corruption";
}

export function createFileRunner(
  emit: (event: PPXWorkerEvent) => void,
): FileRunner {
  const active = new Set<string>();
  const cancelled = new Set<string>();

  async function runFile(
    request: Extract<
      PPXWorkerRequest,
      { kind: "encrypt-file" | "decrypt-file" }
    >,
  ): Promise<void> {
    if (active.has(request.requestId)) {
      if (request.kind === "decrypt-file") {
        zeroizeDecapsulationCapability(request.input.activeIdentity);
      }
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
        }) => {
          emit({
            kind: "progress",
            requestId: request.requestId,
            ...progress,
          });
        },
      };
      if (request.kind === "encrypt-file") {
        const result = await defaultCryptoProvider.encryptFileToBlob(
          request.input,
          hooks,
        );
        if (cancelled.has(request.requestId)) {
          throw new FileOperationCancelled();
        }
        emit({ kind: "completed", requestId: request.requestId, result });
      } else {
        validateDecapsulationCapability(request.input.activeIdentity);
        const result = await defaultCryptoProvider.decryptFile(
          request.input,
          hooks,
        );
        if (cancelled.has(request.requestId)) {
          throw new FileOperationCancelled();
        }
        emit({ kind: "completed", requestId: request.requestId, result });
      }
    } catch (error) {
      if (
        error instanceof FileOperationCancelled ||
        cancelled.has(request.requestId)
      ) {
        emit({ kind: "cancelled", requestId: request.requestId });
      } else {
        emit({
          kind: "error",
          requestId: request.requestId,
          code: safeErrorCode(error),
        });
      }
    } finally {
      if (request.kind === "decrypt-file") {
        zeroizeDecapsulationCapability(request.input.activeIdentity);
      }
      active.delete(request.requestId);
      cancelled.delete(request.requestId);
    }
  }

  return {
    async handle(request) {
      if (request.kind === "cancel") {
        if (active.has(request.requestId)) cancelled.add(request.requestId);
        return;
      }
      if (request.kind === "encrypt-file" || request.kind === "decrypt-file") {
        await runFile(request);
        return;
      }
      if (
        request.kind === "decrypt-text" ||
        request.kind === "decrypt-qr-text"
      ) {
        zeroizeDecapsulationCapability(request.input.activeIdentity);
      }
      emit({
        kind: "error",
        requestId: request.requestId,
        code: "wrong-identity-or-corruption",
      });
    },
  };
}
