import {
  validateDecapsulationCapabilityV2,
  validateSenderSigningCapabilityV2,
  zeroizeDecapsulationCapabilityV2,
  zeroizeSenderSigningCapabilityV2,
} from "../crypto/capability-v2";
import type {
  PPXCryptoWorkerRequest,
  PPXSafeWorkerError,
  PPXWorkerEvent,
} from "../crypto/contracts";
import { defaultCryptoProvider } from "../crypto/default-provider";
import { PPXError } from "../protocol/types";

export interface CryptoRunner {
  handle(request: PPXCryptoWorkerRequest): Promise<void>;
}

function safeErrorCode(error: unknown): PPXSafeWorkerError {
  return error instanceof PPXError
    ? error.code
    : "wrong-identity-or-corruption";
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
        let result;
        switch (request.kind) {
          case "encrypt-text":
            validateSenderSigningCapabilityV2(
              request.input.senderSigningCapability,
            );
            result = await defaultCryptoProvider.encryptText(request.input);
            break;
          case "decrypt-text":
            validateDecapsulationCapabilityV2(request.input.activeIdentity);
            result = await defaultCryptoProvider.decryptText(request.input);
            break;
          case "lock-vault":
            result = await defaultCryptoProvider.lockVault(request.input);
            break;
          case "unlock-vault":
            result = await defaultCryptoProvider.unlockVault(request.input);
            break;
        }
        emit(
          cancelled.has(request.requestId)
            ? { kind: "cancelled", requestId: request.requestId }
            : { kind: "completed", requestId: request.requestId, result },
        );
      } catch (error) {
        emit(
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
