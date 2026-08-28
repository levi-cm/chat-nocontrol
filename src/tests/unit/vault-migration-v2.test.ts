import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { lockVault } from "../../crypto/vault";
import { lockVaultV2 } from "../../crypto/vault-v2";
import { checksum16, equalBytes } from "../../protocol/checksum";
import { createPublicContact } from "../../protocol/ppxc";
import { encodeLockedVault } from "../../protocol/ppxv";
import {
  encodeLockedVaultHeaderV2,
  encodeLockedVaultV2,
} from "../../protocol/ppxv-v2";
import type { LockedVaultObjectV2 } from "../../protocol/types-v2";
import { contactStorageId, listContacts } from "../../storage/contacts";
import { deletePpxDatabase, openPpxDatabase } from "../../storage/db";
import { migrateV1VaultToV2 } from "../../storage/vault-migration-v2";

const PASSPHRASE = "five random words make safer vaults";

async function legacyFixture(fill = 1) {
  const identity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(fill),
    "Alice",
    1_717_171_717n,
  );
  return {
    identity,
    vault: await lockVault({ identity, passphrase: PASSPHRASE }),
  };
}

async function migratedFixture(fill = 1) {
  return deriveIdentityV2FromEntropy(
    new Uint8Array(32).fill(fill),
    "Alice",
    1_717_171_717n,
  );
}

function canonicalVaultFixture(fill = 0x33): LockedVaultObjectV2 {
  const vault: LockedVaultObjectV2 = {
    magic: "PPXV",
    formatVersion: 2,
    suite: 2,
    flags: 1,
    kdfId: 1,
    scryptN: 65_536,
    scryptR: 8,
    scryptP: 2,
    salt: new Uint8Array(16).fill(fill),
    nonce: new Uint8Array(12).fill(fill + 1),
    ciphertextLength: 58,
    ciphertext: new Uint8Array(58).fill(fill + 2),
    checksum: new Uint8Array(16),
  };
  const header = encodeLockedVaultHeaderV2(vault);
  const payload = new Uint8Array(header.byteLength + vault.ciphertextLength);
  try {
    payload.set(header);
    payload.set(vault.ciphertext, header.byteLength);
    vault.checksum = checksum16(payload);
    return vault;
  } finally {
    header.fill(0);
    payload.fill(0);
  }
}

function completedMigrationJob(
  identity: Awaited<ReturnType<typeof migratedFixture>>,
) {
  return (input: { bytes: Uint8Array; passphrase: string }) => {
    input.bytes.fill(0);
    return {
      requestId: "test-vault-migration",
      promise:
        input.passphrase === PASSPHRASE
          ? Promise.resolve(identity)
          : Promise.reject(new Error("wrong password")),
      cancel() {},
    };
  };
}

async function putExactLegacyFixture(
  db: Awaited<ReturnType<typeof openPpxDatabase>>,
  legacy: Awaited<ReturnType<typeof legacyFixture>>,
  withContact = false,
) {
  await db.put("vaults", legacy.vault, "active");
  if (!withContact) return;
  const contact = createPublicContact(legacy.identity, "Alice", 1_717_171_717n);
  await db.put("contacts", {
    id: contactStorageId(contact.fingerprint),
    contact,
    nickname: "Old contact",
    includeSenderContactInLinks: true,
  } as never);
}

describe("one-time stored V1 to V2 vault migration", () => {
  afterEach(async () => {
    await deletePpxDatabase();
  });

  it("routes request-owned canonical V1 bytes through the isolated migration worker", async () => {
    const db = await openPpxDatabase();
    const legacy = await legacyFixture(7);
    await putExactLegacyFixture(db, legacy);
    const expectedBytes = encodeLockedVault(legacy.vault);
    let receivedBytes: Uint8Array | undefined;
    let receivedPassphrase: string | undefined;
    let requestBytes: Uint8Array | undefined;

    const migrated = await migrateV1VaultToV2(db, PASSPHRASE, {
      startLegacyVaultMigrationJob: (input) => {
        requestBytes = input.bytes;
        receivedBytes = Uint8Array.from(input.bytes);
        receivedPassphrase = input.passphrase;
        input.bytes.fill(0);
        return {
          requestId: "test-vault-migration",
          promise: deriveIdentityV2FromEntropy(
            new Uint8Array(32).fill(7),
            "Alice",
            1_717_171_717n,
          ),
          cancel() {},
        };
      },
    });

    expect(receivedBytes).toEqual(expectedBytes);
    expect(receivedPassphrase).toBe(PASSPHRASE);
    expect(requestBytes).toEqual(new Uint8Array(expectedBytes.byteLength));
    expect(migrated.vault.formatVersion).toBe(2);
    db.close();
  });

  it("verifies a temporary V2 vault then atomically replaces active and clears contacts", async () => {
    const db = await openPpxDatabase();
    const legacy = await legacyFixture();
    const workerIdentity = await migratedFixture();
    const verifiedIdentity = await migratedFixture();
    const candidate = canonicalVaultFixture();
    const lockV2 = vi.fn(() => Promise.resolve(candidate));
    const unlockV2 = vi.fn(() => Promise.resolve(verifiedIdentity));
    await putExactLegacyFixture(db, legacy, true);

    const migrated = await migrateV1VaultToV2(db, PASSPHRASE, {
      startLegacyVaultMigrationJob: completedMigrationJob(workerIdentity),
      lockV2,
      unlockV2,
    });
    const active = (await db.get("vaults", "active")) as LockedVaultObjectV2;

    expect(lockV2).toHaveBeenCalledOnce();
    expect(unlockV2).toHaveBeenCalledOnce();
    expect(active.formatVersion).toBe(2);
    expect(active.suite).toBe(2);
    expect(encodeLockedVaultV2(active)).toEqual(encodeLockedVaultV2(candidate));
    expect(await db.get("vaults", "migration-v2")).toBeUndefined();
    expect(await listContacts(db)).toEqual([]);
    expect(migrated.identity.fingerprint).toEqual(verifiedIdentity.fingerprint);
    db.close();
  });

  it("leaves exact active V1 bytes and contacts untouched after failure", async () => {
    const db = await openPpxDatabase();
    const legacy = await legacyFixture();
    await putExactLegacyFixture(db, legacy, true);
    const before = encodeLockedVault(legacy.vault);

    await expect(
      migrateV1VaultToV2(db, "wrong password", {
        startLegacyVaultMigrationJob: (input) => {
          input.bytes.fill(0);
          return {
            requestId: "test-vault-migration-failure",
            promise: Promise.reject(new Error("wrong password")),
            cancel() {},
          };
        },
      }),
    ).rejects.toThrow("vault-migration-failed");

    const active = (await db.get("vaults", "active")) as typeof legacy.vault;
    expect(equalBytes(encodeLockedVault(active), before)).toBe(true);
    expect(await db.get("vaults", "migration-v2")).toBeUndefined();
    expect(await listContacts(db)).toHaveLength(1);
    db.close();
  });

  it("does not overwrite an active vault changed during migration", async () => {
    const db = await openPpxDatabase();
    const legacy = await legacyFixture(1);
    const competing = await legacyFixture(2);
    const workerIdentity = await migratedFixture(1);
    const verifiedIdentity = await migratedFixture(1);
    const candidate = canonicalVaultFixture(0x44);
    await putExactLegacyFixture(db, legacy);

    await expect(
      migrateV1VaultToV2(db, PASSPHRASE, {
        startLegacyVaultMigrationJob: completedMigrationJob(workerIdentity),
        lockV2: () => Promise.resolve(candidate),
        unlockV2: () => Promise.resolve(verifiedIdentity),
        afterCandidateVerified: async () => {
          await db.put("vaults", competing.vault, "active");
        },
      }),
    ).rejects.toThrow("vault-migration-race");

    const active = (await db.get("vaults", "active")) as typeof competing.vault;
    expect(
      equalBytes(encodeLockedVault(active), encodeLockedVault(competing.vault)),
    ).toBe(true);
    expect(await db.get("vaults", "migration-v2")).toBeUndefined();
    db.close();
  });

  it("leaves V1 and contacts untouched when the reread V2 identity does not verify", async () => {
    const db = await openPpxDatabase();
    const legacy = await legacyFixture(5);
    const workerIdentity = await migratedFixture(5);
    await putExactLegacyFixture(db, legacy, true);
    const before = encodeLockedVault(legacy.vault);
    const wrong = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(9),
      "Wrong",
      9n,
    );

    await expect(
      migrateV1VaultToV2(db, PASSPHRASE, {
        startLegacyVaultMigrationJob: completedMigrationJob(workerIdentity),
        unlockV2: () => Promise.resolve(wrong),
      }),
    ).rejects.toThrow("vault-migration-failed");

    const active = await db.get("vaults", "active");
    expect(active?.formatVersion).toBe(1);
    if (active?.formatVersion !== 1) throw new Error("expected V1 vault");
    expect(equalBytes(encodeLockedVault(active), before)).toBe(true);
    expect(await listContacts(db)).toHaveLength(1);
    expect(await db.get("vaults", "migration-v2")).toBeUndefined();
    expect(wrong.masterEntropy.every((byte) => byte === 0)).toBe(true);
    expect(wrong.kemSecretKey.every((byte) => byte === 0)).toBe(true);
    expect(wrong.signingSecretKey.every((byte) => byte === 0)).toBe(true);
    db.close();
  });

  it("zeroizes the worker-migrated V2 identity when candidate creation fails", async () => {
    const db = await openPpxDatabase();
    const legacy = await legacyFixture(4);
    await putExactLegacyFixture(db, legacy);
    const derived = await migratedFixture(4);

    await expect(
      migrateV1VaultToV2(db, PASSPHRASE, {
        startLegacyVaultMigrationJob: completedMigrationJob(derived),
        lockV2: () => Promise.reject(new Error("injected-lock-failure")),
      }),
    ).rejects.toThrow("vault-migration-failed");

    for (const secret of [
      derived.masterEntropy,
      derived.kemSecretKey,
      derived.signingSecretKey,
    ]) {
      expect(secret.every((byte) => byte === 0)).toBe(true);
    }
    expect(await db.get("vaults", "migration-v2")).toBeUndefined();
    db.close();
  });

  it("zeroizes request-owned canonical bytes if worker startup throws", async () => {
    const db = await openPpxDatabase();
    const legacy = await legacyFixture(6);
    await putExactLegacyFixture(db, legacy);
    let requestBytes: Uint8Array | undefined;

    await expect(
      migrateV1VaultToV2(db, PASSPHRASE, {
        startLegacyVaultMigrationJob: (input) => {
          requestBytes = input.bytes;
          throw new Error("worker startup failed");
        },
      }),
    ).rejects.toThrow("vault-migration-failed");

    expect(requestBytes).toEqual(
      new Uint8Array(encodeLockedVault(legacy.vault).byteLength),
    );
    expect(await db.get("vaults", "migration-v2")).toBeUndefined();
    db.close();
  });

  it("cancels the isolated worker and never commits after abort", async () => {
    const db = await openPpxDatabase();
    const legacy = await legacyFixture(8);
    await putExactLegacyFixture(db, legacy, true);
    const before = encodeLockedVault(legacy.vault);
    const controller = new AbortController();
    let rejectWorker: ((error: Error) => void) | undefined;
    let cancelCalls = 0;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });

    const migration = migrateV1VaultToV2(
      db,
      PASSPHRASE,
      {
        startLegacyVaultMigrationJob: (input) => {
          input.bytes.fill(0);
          markStarted?.();
          return {
            requestId: "test-vault-migration-abort",
            promise: new Promise((_resolve, reject) => {
              rejectWorker = reject;
            }),
            cancel() {
              cancelCalls += 1;
              rejectWorker?.(new Error("cancelled"));
            },
          };
        },
      },
      controller.signal,
    );

    await started;
    controller.abort();

    await expect(migration).rejects.toMatchObject({ name: "AbortError" });
    expect(cancelCalls).toBe(1);
    const active = await db.get("vaults", "active");
    expect(active?.formatVersion).toBe(1);
    if (active?.formatVersion !== 1) throw new Error("expected V1 vault");
    expect(equalBytes(encodeLockedVault(active), before)).toBe(true);
    expect(await listContacts(db)).toHaveLength(1);
    expect(await db.get("vaults", "migration-v2")).toBeUndefined();
    db.close();
  });

  it("rejects a V2 active vault instead of exposing a general legacy parser", async () => {
    const db = await openPpxDatabase();
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(3),
      "Alice",
    );
    const v2 = await lockVaultV2({ identity, passphrase: PASSPHRASE });
    await db.put("vaults", v2, "active");
    await db.put("vaults", v2, "migration-v2");

    await expect(migrateV1VaultToV2(db, PASSPHRASE)).rejects.toThrow(
      "not-exact-v1-active-vault",
    );
    expect(
      equalBytes(
        encodeLockedVaultV2(
          (await db.get("vaults", "active")) as LockedVaultObjectV2,
        ),
        encodeLockedVaultV2(v2),
      ),
    ).toBe(true);
    expect(await db.get("vaults", "migration-v2")).toBeUndefined();
    db.close();
  });
});
