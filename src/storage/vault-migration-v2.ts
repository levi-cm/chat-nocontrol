import { lockVaultV2, unlockVaultV2 } from "../crypto/vault-v2";
import { zeroize, zeroizeIdentitySecretsV2 } from "../crypto/zeroize";
import { equalBytes } from "../protocol/checksum";
import { encodeLockedVault } from "../protocol/ppxv";
import { encodeLockedVaultV2, parseLockedVaultV2 } from "../protocol/ppxv-v2";
import type {
  DerivedIdentityV2,
  LockedVaultObjectV2,
} from "../protocol/types-v2";
import { startLegacyVaultMigrationJob } from "../workers/legacy-v1-client";
import type { PpxDatabase, StoredVaultObject } from "./db";

export interface VaultMigrationV2Result {
  identity: DerivedIdentityV2;
  vault: LockedVaultObjectV2;
}

export interface VaultMigrationV2Dependencies {
  startLegacyVaultMigrationJob: typeof startLegacyVaultMigrationJob;
  lockV2(input: {
    identity: DerivedIdentityV2;
    passphrase: string;
  }): Promise<LockedVaultObjectV2>;
  unlockV2(input: {
    vault: LockedVaultObjectV2;
    passphrase: string;
  }): Promise<DerivedIdentityV2>;
  afterCandidateVerified?(): Promise<void> | void;
}

const DEFAULT_DEPENDENCIES: VaultMigrationV2Dependencies = {
  startLegacyVaultMigrationJob,
  lockV2: lockVaultV2,
  unlockV2: unlockVaultV2,
};

function migrationAbortError(): Error {
  const error = new Error("vault-migration-cancelled");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw migrationAbortError();
}

function exactLegacyBytes(value: StoredVaultObject | undefined): {
  bytes: Uint8Array;
} {
  if (value?.formatVersion !== 1 || value.suite !== 1) {
    throw new Error("not-exact-v1-active-vault");
  }
  return { bytes: encodeLockedVault(value) };
}

function sameMigratedIdentity(
  expected: DerivedIdentityV2,
  actual: DerivedIdentityV2,
): boolean {
  return (
    expected.creationTime === actual.creationTime &&
    expected.pseudonym === actual.pseudonym &&
    equalBytes(expected.masterEntropy, actual.masterEntropy) &&
    equalBytes(expected.fingerprint, actual.fingerprint)
  );
}

/**
 * One-time, persistent-storage-only migration. Legacy decoding is deliberately
 * contained here; V2 import and protocol APIs never accept V1 bytes.
 */
export async function migrateV1VaultToV2(
  db: PpxDatabase,
  passphrase: string,
  overrides: Partial<VaultMigrationV2Dependencies> = {},
  signal?: AbortSignal,
): Promise<VaultMigrationV2Result> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides };
  let original: { bytes: Uint8Array } | undefined;
  let workerRequestBytes: Uint8Array | undefined;
  let derivedIdentity: DerivedIdentityV2 | undefined;
  let verifiedIdentity: DerivedIdentityV2 | undefined;
  let candidateBytes: Uint8Array | undefined;
  let committed = false;
  let cancelWorker: (() => void) | undefined;
  let abortTransaction: (() => void) | undefined;
  const abortOperation = () => {
    cancelWorker?.();
    try {
      abortTransaction?.();
    } catch {
      // The transaction may already be committed or aborted.
    }
  };
  signal?.addEventListener("abort", abortOperation, { once: true });
  try {
    throwIfAborted(signal);
    original = exactLegacyBytes(await db.get("vaults", "active"));
    throwIfAborted(signal);
    try {
      workerRequestBytes = Uint8Array.from(original.bytes);
      const migrationJob = dependencies.startLegacyVaultMigrationJob({
        bytes: workerRequestBytes,
        passphrase,
      });
      cancelWorker = () => migrationJob.cancel();
      throwIfAborted(signal);
      derivedIdentity = await migrationJob.promise;
      cancelWorker = undefined;
      throwIfAborted(signal);
      const candidate = await dependencies.lockV2({
        identity: derivedIdentity,
        passphrase,
      });
      throwIfAborted(signal);
      candidateBytes = encodeLockedVaultV2(candidate);
      await db.put("vaults", candidate, "migration-v2");
      throwIfAborted(signal);

      const reread = await db.get("vaults", "migration-v2");
      throwIfAborted(signal);
      if (reread?.formatVersion !== 2 || reread.suite !== 2) {
        throw new Error("vault-migration-failed");
      }
      const canonicalCandidate = parseLockedVaultV2(
        encodeLockedVaultV2(reread),
      );
      verifiedIdentity = await dependencies.unlockV2({
        vault: canonicalCandidate,
        passphrase,
      });
      throwIfAborted(signal);
      if (!sameMigratedIdentity(derivedIdentity, verifiedIdentity)) {
        throw new Error("vault-migration-failed");
      }
      await dependencies.afterCandidateVerified?.();
      throwIfAborted(signal);

      const transaction = db.transaction(["vaults", "contacts"], "readwrite");
      abortTransaction = () => transaction.abort();
      const current = await transaction.objectStore("vaults").get("active");
      throwIfAborted(signal);
      let currentBytes: Uint8Array | undefined;
      try {
        currentBytes = exactLegacyBytes(current).bytes;
        if (!equalBytes(currentBytes, original.bytes)) {
          transaction.abort();
          await transaction.done.catch(() => undefined);
          throw new Error("vault-migration-race");
        }
      } finally {
        if (currentBytes) zeroize(currentBytes);
      }
      throwIfAborted(signal);
      await transaction.objectStore("vaults").put(reread, "active");
      await transaction.objectStore("vaults").delete("migration-v2");
      await transaction.objectStore("contacts").clear();
      await transaction.done;
      abortTransaction = undefined;
      committed = true;

      const result = { identity: verifiedIdentity, vault: canonicalCandidate };
      verifiedIdentity = undefined;
      return result;
    } catch (error) {
      if (
        signal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw migrationAbortError();
      }
      if (error instanceof Error && error.message === "vault-migration-race") {
        throw error;
      }
      throw new Error("vault-migration-failed");
    }
  } finally {
    signal?.removeEventListener("abort", abortOperation);
    cancelWorker = undefined;
    abortTransaction = undefined;
    try {
      if (!committed) {
        await db.delete("vaults", "migration-v2");
      }
    } finally {
      if (original) zeroize(original.bytes);
      if (workerRequestBytes?.byteLength) zeroize(workerRequestBytes);
      if (candidateBytes) zeroize(candidateBytes);
      if (derivedIdentity) zeroizeIdentitySecretsV2(derivedIdentity);
      if (verifiedIdentity) zeroizeIdentitySecretsV2(verifiedIdentity);
    }
  }
}
