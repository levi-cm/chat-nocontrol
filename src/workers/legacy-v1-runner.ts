import {
  decryptLegacyCompactTextV1,
  decryptLegacyFileV1,
  decryptLegacyTextV1,
  migrateLegacyRecoveryV1,
  migrateLegacyVaultV1,
} from "../crypto/legacy-v1-reader";
import { zeroize, zeroizeIdentitySecretsV2 } from "../crypto/zeroize";
import {
  PPXError,
  type PPXCryptoError,
  type PPXParseError,
} from "../protocol/types";
import type {
  LegacyV1WorkerEvent,
  LegacyV1WorkerRequest,
} from "./legacy-v1-contracts";
import type { DerivedIdentityV2 } from "../protocol/types-v2";

type ActiveLegacyV1Request = Exclude<LegacyV1WorkerRequest, { kind: "cancel" }>;

export interface LegacyV1RunnerDependencies {
  decryptCompactText: typeof decryptLegacyCompactTextV1;
  decryptText: typeof decryptLegacyTextV1;
  decryptFile: typeof decryptLegacyFileV1;
  migrateRecovery: typeof migrateLegacyRecoveryV1;
  migrateVault: typeof migrateLegacyVaultV1;
}

const DEFAULT_DEPENDENCIES: LegacyV1RunnerDependencies = {
  decryptCompactText: decryptLegacyCompactTextV1,
  decryptText: decryptLegacyTextV1,
  decryptFile: decryptLegacyFileV1,
  migrateRecovery: migrateLegacyRecoveryV1,
  migrateVault: migrateLegacyVaultV1,
};

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

function safeErrorCode(error: unknown): PPXParseError | PPXCryptoError {
  if (
    error instanceof PPXError &&
    (error.code === "unknown-sender-contact" ||
      error.code === "invalid-signature" ||
      error.code === "unsupported-compression")
  ) {
    return error.code;
  }
  return "wrong-identity-or-corruption";
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

export interface LegacyV1Runner {
  handle(request: LegacyV1WorkerRequest): Promise<void>;
}

export function createLegacyV1Runner(
  emit: (event: LegacyV1WorkerEvent) => void,
  overrides: Partial<LegacyV1RunnerDependencies> = {},
): LegacyV1Runner {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides };
  const active = new Set<string>();
  const cancelled = new Set<string>();
  return {
    async handle(request) {
      if (request.kind === "cancel") {
        if (active.has(request.requestId)) cancelled.add(request.requestId);
        return;
      }
      if (active.has(request.requestId)) {
        releaseRequestSecrets(request);
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
        if (request.kind === "decrypt-compact-v1") {
          result = await dependencies.decryptCompactText(request.input);
        } else if (request.kind === "decrypt-text-v1") {
          result = await dependencies.decryptText(request.input);
        } else if (request.kind === "decrypt-file-v1") {
          result = await dependencies.decryptFile(request.input, {
            isCancelled: () => cancelled.has(request.requestId),
            onProgress: (progress) =>
              emit({
                kind: "progress",
                requestId: request.requestId,
                stage: progress.stage === "parse" ? "parse" : "decrypt",
                completedBytes: progress.completedBytes,
                totalBytes: progress.totalBytes,
                ...(progress.chunkIndex === undefined
                  ? {}
                  : { chunkIndex: progress.chunkIndex }),
              }),
          });
        } else if (request.kind === "migrate-recovery-v1") {
          result = await dependencies.migrateRecovery(request.input.bytes);
        } else {
          result = await dependencies.migrateVault(request.input);
        }
        if (cancelled.has(request.requestId)) {
          if (isDerivedIdentityV2(result)) zeroizeIdentitySecretsV2(result);
          emit({ kind: "cancelled", requestId: request.requestId });
        } else {
          emit({ kind: "completed", requestId: request.requestId, result });
        }
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
        releaseRequestSecrets(request);
        active.delete(request.requestId);
        cancelled.delete(request.requestId);
      }
    },
  };
}
