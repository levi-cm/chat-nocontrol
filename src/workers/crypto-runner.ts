import type {
  PPXSafeWorkerError,
  PPXWorkerEvent,
  PPXWorkerRequest,
} from "../crypto/contracts";
import { defaultCryptoProvider } from "../crypto/default-provider";
import { PPXError } from "../protocol/types";

export interface CryptoRunner {
  handle(request: PPXWorkerRequest): Promise<void>;
}

function safeErrorCode(error: unknown): PPXSafeWorkerError {
  return error instanceof PPXError
    ? error.code
    : "wrong-identity-or-corruption";
}

export function createCryptoRunner(
  emit: (event: PPXWorkerEvent) => void,
): CryptoRunner {
  const active = new Set<string>();
  const cancelled = new Set<string>();

  return {
    async handle(request) {
      if (request.kind === "cancel") {
        if (active.has(request.requestId)) cancelled.add(request.requestId);
        return;
      }
      if (request.kind === "encrypt-file" || request.kind === "decrypt-file") {
        emit({
          kind: "error",
          requestId: request.requestId,
          code: "wrong-identity-or-corruption",
        });
        return;
      }
      if (active.has(request.requestId)) {
        emit({
          kind: "error",
          requestId: request.requestId,
          code: "wrong-identity-or-corruption",
        });
        return;
      }

      active.add(request.requestId);
      try {
        switch (request.kind) {
          case "encrypt-text": {
            const result = await defaultCryptoProvider.encryptText(
              request.input,
            );
            if (cancelled.has(request.requestId)) {
              emit({ kind: "cancelled", requestId: request.requestId });
            } else {
              emit({ kind: "completed", requestId: request.requestId, result });
            }
            break;
          }
          case "decrypt-text": {
            const result = await defaultCryptoProvider.decryptText(
              request.input,
            );
            if (cancelled.has(request.requestId)) {
              emit({ kind: "cancelled", requestId: request.requestId });
            } else {
              emit({ kind: "completed", requestId: request.requestId, result });
            }
            break;
          }
          case "lock-vault": {
            const result = await defaultCryptoProvider.lockVault(request.input);
            if (cancelled.has(request.requestId)) {
              emit({ kind: "cancelled", requestId: request.requestId });
            } else {
              emit({ kind: "completed", requestId: request.requestId, result });
            }
            break;
          }
          case "unlock-vault": {
            const result = await defaultCryptoProvider.unlockVault(
              request.input,
            );
            if (cancelled.has(request.requestId)) {
              emit({ kind: "cancelled", requestId: request.requestId });
            } else {
              emit({ kind: "completed", requestId: request.requestId, result });
            }
            break;
          }
        }
      } catch (error) {
        if (cancelled.has(request.requestId)) {
          emit({ kind: "cancelled", requestId: request.requestId });
        } else {
          emit({
            kind: "error",
            requestId: request.requestId,
            code: safeErrorCode(error),
          });
        }
      } finally {
        active.delete(request.requestId);
        cancelled.delete(request.requestId);
      }
    },
  };
}
