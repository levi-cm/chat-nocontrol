import { deriveIdentityV2FromEntropy } from "../crypto/identity-v2";
import { unlockVault } from "../crypto/vault";
import { lockVaultV2, unlockVaultV2 } from "../crypto/vault-v2";
import {
  zeroize,
  zeroizeIdentitySecrets,
  zeroizeIdentitySecretsV2,
} from "../crypto/zeroize";
import { equalBytes } from "../protocol/checksum";
import { encodeLockedVault } from "../protocol/ppxv";
import { encodeLockedVaultV2, parseLockedVaultV2 } from "../protocol/ppxv-v2";
import type { DerivedIdentity, LockedVaultObject } from "../protocol/types";
import type {
  DerivedIdentityV2,
  LockedVaultObjectV2,
} from "../protocol/types-v2";
import type { PpxDatabase, StoredVaultObject } from "./db";

export interface VaultMigrationV2Result {
  identity: DerivedIdentityV2;
  vault: LockedVaultObjectV2;
}

export interface VaultMigrationV2Dependencies {
  unlockLegacy(input: {
    vault: LockedVaultObject;
    passphrase: string;
  }): Promise<DerivedIdentity>;
  deriveV2(
    entropy: Uint8Array,
    pseudonym: string,
    creationTime: bigint,
  ): Promise<DerivedIdentityV2>;
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
  unlockLegacy: unlockVault,
  deriveV2: deriveIdentityV2FromEntropy,
  lockV2: lockVaultV2,
  unlockV2: unlockVaultV2,
};

function exactLegacyBytes(value: StoredVaultObject | undefined): {
  vault: LockedVaultObject;
  bytes: Uint8Array;
} {
  if (value?.formatVersion !== 1 || value.suite !== 1) {
    throw new Error("not-exact-v1-active-vault");
  }
  const vault = value;
  return { vault, bytes: encodeLockedVault(vault) };
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
): Promise<VaultMigrationV2Result> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides };
  let original: { vault: LockedVaultObject; bytes: Uint8Array } | undefined;
  let legacyIdentity: DerivedIdentity | undefined;
  let derivedIdentity: DerivedIdentityV2 | undefined;
  let verifiedIdentity: DerivedIdentityV2 | undefined;
  let candidateBytes: Uint8Array | undefined;
  let committed = false;
  try {
    original = exactLegacyBytes(await db.get("vaults", "active"));
    try {
      legacyIdentity = await dependencies.unlockLegacy({
        vault: original.vault,
        passphrase,
      });
      derivedIdentity = await dependencies.deriveV2(
        legacyIdentity.masterEntropy,
        legacyIdentity.pseudonym,
        legacyIdentity.creationTime,
      );
      const candidate = await dependencies.lockV2({
        identity: derivedIdentity,
        passphrase,
      });
      candidateBytes = encodeLockedVaultV2(candidate);
      await db.put("vaults", candidate, "migration-v2");

      const reread = await db.get("vaults", "migration-v2");
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
      if (!sameMigratedIdentity(derivedIdentity, verifiedIdentity)) {
        throw new Error("vault-migration-failed");
      }
      await dependencies.afterCandidateVerified?.();

      const transaction = db.transaction(["vaults", "contacts"], "readwrite");
      const current = await transaction.objectStore("vaults").get("active");
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
      await transaction.objectStore("vaults").put(reread, "active");
      await transaction.objectStore("vaults").delete("migration-v2");
      await transaction.objectStore("contacts").clear();
      await transaction.done;
      committed = true;

      const result = { identity: verifiedIdentity, vault: canonicalCandidate };
      verifiedIdentity = undefined;
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === "vault-migration-race") {
        throw error;
      }
      throw new Error("vault-migration-failed");
    }
  } finally {
    try {
      if (!committed) {
        await db.delete("vaults", "migration-v2");
      }
    } finally {
      if (original) zeroize(original.bytes);
      if (candidateBytes) zeroize(candidateBytes);
      if (legacyIdentity) zeroizeIdentitySecrets(legacyIdentity);
      if (derivedIdentity) zeroizeIdentitySecretsV2(derivedIdentity);
      if (verifiedIdentity) zeroizeIdentitySecretsV2(verifiedIdentity);
    }
  }
}
