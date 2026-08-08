import { describe, expect, it } from "vitest";
import { PPXError, type DecryptedFileOutput } from "../../protocol/types";
import type { DerivedIdentityV2 } from "../../protocol/types-v2";
import {
  legacyV1EventTransferList,
  type LegacyV1WorkerEvent,
  zeroizeLegacyV1TransferList,
} from "../../workers/legacy-v1-contracts";
import { createLegacyV1Runner } from "../../workers/legacy-v1-runner";

const fill = (length: number, value: number) =>
  new Uint8Array(length).fill(value);

describe("legacy V1 worker runner", () => {
  it("transfers every owned migrated identity buffer without retaining worker copies", () => {
    const identity = {
      suite: 2,
      creationTime: 1n,
      pseudonym: "Migrated",
      masterEntropy: fill(32, 1),
      kemPublicKey: fill(64, 2),
      kemSecretKey: fill(64, 3),
      signingPublicKey: fill(32, 4),
      signingSecretKey: fill(32, 5),
      fingerprint: fill(32, 6),
      identityId: fill(20, 7),
    } as DerivedIdentityV2;
    const event = {
      kind: "completed" as const,
      requestId: "migration-transfer",
      result: identity,
    };

    const transferred = structuredClone(event, {
      transfer: legacyV1EventTransferList(event),
    });

    expect(legacyV1EventTransferList(transferred)).toHaveLength(7);
    expect(identity.masterEntropy.byteLength).toBe(0);
    expect(identity.kemPublicKey.byteLength).toBe(0);
    expect(identity.kemSecretKey.byteLength).toBe(0);
    expect(identity.signingPublicKey.byteLength).toBe(0);
    expect(identity.signingSecretKey.byteLength).toBe(0);
    expect(identity.fingerprint.byteLength).toBe(0);
    expect(identity.identityId.byteLength).toBe(0);
  });

  it("zeroizes every migrated identity buffer when worker response transfer fails", () => {
    const identity = {
      suite: 2,
      creationTime: 2n,
      pseudonym: "Failed transfer",
      masterEntropy: fill(32, 11),
      kemPublicKey: fill(64, 12),
      kemSecretKey: fill(64, 13),
      signingPublicKey: fill(32, 14),
      signingSecretKey: fill(32, 15),
      fingerprint: fill(32, 16),
      identityId: fill(20, 17),
    } as DerivedIdentityV2;
    const transferList = legacyV1EventTransferList({
      kind: "completed",
      requestId: "failed-migration-transfer",
      result: identity,
    });

    zeroizeLegacyV1TransferList(transferList);

    for (const buffer of transferList) {
      expect(new Uint8Array(buffer).every((byte) => byte === 0)).toBe(true);
    }
  });

  it.each([
    "unknown-sender-contact",
    "invalid-signature",
    "unsupported-compression",
  ] as const)("preserves the safe compact decrypt error %s", async (code) => {
    const events: LegacyV1WorkerEvent[] = [];
    const ppxqBytes = fill(64, 4);
    const senderContactBytes = fill(64, 5);
    const masterEntropy = fill(32, 6);
    const runner = createLegacyV1Runner((event) => events.push(event), {
      decryptCompactText: () => Promise.reject(new PPXError(code)),
    });

    await runner.handle({
      kind: "decrypt-compact-v1",
      requestId: `compact-${code}`,
      input: { ppxqBytes, senderContactBytes, masterEntropy },
    });

    expect(events).toContainEqual({
      kind: "error",
      requestId: `compact-${code}`,
      code,
    });
    expect(ppxqBytes).toEqual(new Uint8Array(64));
    expect(senderContactBytes).toEqual(new Uint8Array(64));
    expect(masterEntropy).toEqual(new Uint8Array(32));
  });

  it("rejects a duplicate compact request without disturbing the active request", async () => {
    const events: LegacyV1WorkerEvent[] = [];
    let release!: () => void;
    const pendingDecrypt = new Promise<void>((resolve) => {
      release = resolve;
    });
    const result = { plaintext: "legacy compact" } as never;
    const runner = createLegacyV1Runner((event) => events.push(event), {
      decryptCompactText: async () => {
        await pendingDecrypt;
        return result;
      },
    });
    const activeRequest = {
      kind: "decrypt-compact-v1" as const,
      requestId: "duplicate-compact",
      input: {
        ppxqBytes: fill(64, 7),
        senderContactBytes: fill(64, 8),
        masterEntropy: fill(32, 9),
      },
    };
    const duplicateRequest = {
      kind: "decrypt-compact-v1" as const,
      requestId: "duplicate-compact",
      input: {
        ppxqBytes: fill(64, 10),
        senderContactBytes: fill(64, 11),
        masterEntropy: fill(32, 12),
      },
    };

    const active = runner.handle(activeRequest);
    await runner.handle(duplicateRequest);
    release();
    await active;

    expect(events).toContainEqual({
      kind: "error",
      requestId: "duplicate-compact",
      code: "wrong-identity-or-corruption",
    });
    expect(events).toContainEqual({
      kind: "completed",
      requestId: "duplicate-compact",
      result,
    });
    expect(duplicateRequest.input.ppxqBytes).toEqual(new Uint8Array(64));
    expect(duplicateRequest.input.senderContactBytes).toEqual(
      new Uint8Array(64),
    );
    expect(duplicateRequest.input.masterEntropy).toEqual(new Uint8Array(32));
    expect(activeRequest.input.ppxqBytes).toEqual(new Uint8Array(64));
    expect(activeRequest.input.senderContactBytes).toEqual(new Uint8Array(64));
    expect(activeRequest.input.masterEntropy).toEqual(new Uint8Array(32));
  });

  it("collapses other compact failures to wrong identity or corruption", async () => {
    const events: LegacyV1WorkerEvent[] = [];
    const runner = createLegacyV1Runner((event) => events.push(event), {
      decryptCompactText: () =>
        Promise.reject(new PPXError("checksum-mismatch")),
    });

    await runner.handle({
      kind: "decrypt-compact-v1",
      requestId: "compact-checksum",
      input: {
        ppxqBytes: fill(64, 13),
        senderContactBytes: fill(64, 14),
        masterEntropy: fill(32, 15),
      },
    });

    expect(events).toContainEqual({
      kind: "error",
      requestId: "compact-checksum",
      code: "wrong-identity-or-corruption",
    });
  });

  it("wipes request entropy when legacy decryption fails", async () => {
    const events: LegacyV1WorkerEvent[] = [];
    const entropy = fill(32, 7);
    const runner = createLegacyV1Runner((event) => events.push(event));

    await runner.handle({
      kind: "decrypt-text-v1",
      requestId: "bad-text",
      input: { object: { magic: "PPXT" } as never, masterEntropy: entropy },
    });

    expect(entropy).toEqual(new Uint8Array(32));
    expect(events).toContainEqual({
      kind: "error",
      requestId: "bad-text",
      code: "wrong-identity-or-corruption",
    });
  });

  it("returns a migrated V2 identity and wipes recovery bytes", async () => {
    const events: LegacyV1WorkerEvent[] = [];
    const bytes = fill(64, 8);
    const expected = { suite: 2, pseudonym: "Alice" } as DerivedIdentityV2;
    const runner = createLegacyV1Runner((event) => events.push(event), {
      migrateRecovery: () => Promise.resolve(expected),
    });

    await runner.handle({
      kind: "migrate-recovery-v1",
      requestId: "recovery",
      input: { bytes },
    });

    expect(bytes).toEqual(new Uint8Array(64));
    expect(events).toContainEqual({
      kind: "completed",
      requestId: "recovery",
      result: expected,
    });
  });

  it("cancels an active legacy file operation without returning plaintext", async () => {
    const events: LegacyV1WorkerEvent[] = [];
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    const runner = createLegacyV1Runner((event) => events.push(event), {
      decryptFile: async (_input, hooks) => {
        await started;
        if (hooks?.isCancelled?.()) throw new Error("cancelled");
        return {} as DecryptedFileOutput;
      },
    });
    const request = {
      kind: "decrypt-file-v1" as const,
      requestId: "cancel-file",
      input: {
        object: new Blob(["ciphertext"]),
        masterEntropy: fill(32, 9),
      },
    };

    const pending = runner.handle(request);
    await runner.handle({ kind: "cancel", requestId: "cancel-file" });
    release();
    await pending;

    expect(events).toContainEqual({
      kind: "cancelled",
      requestId: "cancel-file",
    });
    expect(
      events.some(
        (event) =>
          event.kind === "completed" && event.requestId === "cancel-file",
      ),
    ).toBe(false);
    expect(request.input.masterEntropy).toEqual(new Uint8Array(32));
  });

  it("zeroizes a migrated identity completed after cancellation", async () => {
    const events: LegacyV1WorkerEvent[] = [];
    let release!: () => void;
    const pendingMigration = new Promise<void>((resolve) => {
      release = resolve;
    });
    const migrated = {
      suite: 2,
      masterEntropy: fill(32, 10),
      kemSecretKey: fill(32, 11),
      signingSecretKey: fill(32, 12),
    } as DerivedIdentityV2;
    const runner = createLegacyV1Runner((event) => events.push(event), {
      migrateRecovery: async () => {
        await pendingMigration;
        return migrated;
      },
    });

    const pending = runner.handle({
      kind: "migrate-recovery-v1",
      requestId: "cancel-recovery",
      input: { bytes: fill(64, 13) },
    });
    await runner.handle({ kind: "cancel", requestId: "cancel-recovery" });
    release();
    await pending;

    expect(events).toContainEqual({
      kind: "cancelled",
      requestId: "cancel-recovery",
    });
    expect(migrated.masterEntropy).toEqual(new Uint8Array(32));
    expect(migrated.kemSecretKey).toEqual(new Uint8Array(32));
    expect(migrated.signingSecretKey).toEqual(new Uint8Array(32));
  });
});
