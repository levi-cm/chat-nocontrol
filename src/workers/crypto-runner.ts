import {
  validateDecapsulationCapabilityV2,
  validateSenderSigningCapabilityV2,
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

type CryptoCompletedResult = Extract<
  PPXWorkerEvent,
  { kind: "completed" }
>["result"];

function safeErrorCode(error: unknown): PPXSafeWorkerError {
  return error instanceof PPXError
    ? error.code
    : "wrong-identity-or-corruption";
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

export function zeroizeCryptoTransferList(
  buffers: readonly ArrayBuffer[],
): void {
  for (const buffer of buffers) {
    if (buffer.byteLength > 0) new Uint8Array(buffer).fill(0);
  }
}

export function cryptoEventTransferList(event: PPXWorkerEvent): ArrayBuffer[] {
  return event.kind === "completed" ? transferList(event.result) : [];
}

function releaseResult(result: unknown): void {
  zeroizeCryptoTransferList(transferList(result));
}

function releaseRequestBuffers(
  request: Exclude<PPXCryptoWorkerRequest, { kind: "cancel" }>,
): void {
  zeroizeCryptoTransferList(transferList(request.input));
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
        releaseRequestBuffers(request);
        emit({
          kind: "error",
          requestId: request.requestId,
          code: "wrong-identity-or-corruption",
        });
        return;
      }
      active.add(request.requestId);
      let result: CryptoCompletedResult | undefined;
      try {
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
        if (cancelled.has(request.requestId)) {
          releaseResult(result);
          result = undefined;
          emit({ kind: "cancelled", requestId: request.requestId });
        } else {
          const completedResult = result as CryptoCompletedResult;
          emit({
            kind: "completed",
            requestId: request.requestId,
            result: completedResult,
          });
          result = undefined;
        }
      } catch (error) {
        releaseResult(result);
        result = undefined;
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
        releaseResult(result);
        releaseRequestBuffers(request);
        active.delete(request.requestId);
        cancelled.delete(request.requestId);
      }
    },
  };
}
