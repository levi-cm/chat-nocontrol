import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { defaultCryptoProvider } from "../../crypto/default-provider";
import type { PPXWorkerEvent } from "../../crypto/contracts";
import {
  createDecapsulationCapabilityV2,
  createSenderSigningCapabilityV2,
  deriveIdentityV2FromEntropy,
} from "../../crypto/identity-v2";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import type {
  DerivedIdentityV2,
  EncryptedTextObjectV2,
  PublicContactV2,
} from "../../protocol/types-v2";
import {
  createCryptoRunner,
  cryptoEventTransferList,
  zeroizeCryptoTransferList,
} from "../../workers/crypto-runner";

const fill = (length: number, value: number) =>
  new Uint8Array(length).fill(value);

describe("Cat-5 V2 crypto-only runner", () => {
  let aliceIdentity: DerivedIdentityV2;
  let bobIdentity: DerivedIdentityV2;
  let alice: PublicContactV2;
  let bob: PublicContactV2;

  beforeAll(async () => {
    aliceIdentity = await deriveIdentityV2FromEntropy(fill(32, 81), "Alice");
    bobIdentity = await deriveIdentityV2FromEntropy(fill(32, 82), "Bob");
    alice = createPublicContactV2(aliceIdentity, "Alice", 1n, fill(32, 83));
    bob = createPublicContactV2(bobIdentity, "Bob", 2n, fill(32, 84));
  });

  afterEach(() => vi.restoreAllMocks());

  it("wipes worker-owned ML-KEM-1024 authority after decrypt completion", async () => {
    const capability = createDecapsulationCapabilityV2(bobIdentity);
    vi.spyOn(defaultCryptoProvider, "decryptText").mockResolvedValue(
      {} as never,
    );
    const runner = createCryptoRunner(() => undefined);

    await runner.handle({
      kind: "decrypt-text",
      requestId: "wipe-decrypt",
      input: {
        object: { magic: "PPXT" } as never,
        activeIdentity: capability,
        knownSenders: [structuredClone(alice)],
      },
    });

    expect(capability.kemSecretKey).toEqual(new Uint8Array(3168));
  });

  it("rejects and wipes a non-Cat-5 suite at the worker boundary", async () => {
    const events: PPXWorkerEvent[] = [];
    const capability = {
      suite: 1,
      fingerprint: fill(32, 1),
      identityId: fill(20, 2),
      kemSecretKey: fill(3168, 7),
    };
    const decrypt = vi.spyOn(defaultCryptoProvider, "decryptText");
    const runner = createCryptoRunner((event) => events.push(event));

    await runner.handle({
      kind: "decrypt-text",
      requestId: "unsupported-suite",
      input: {
        object: { magic: "PPXT" } as never,
        activeIdentity: capability as never,
        knownSenders: [],
      },
    });

    expect(decrypt).not.toHaveBeenCalled();
    expect(events).toContainEqual({
      kind: "error",
      requestId: "unsupported-suite",
      code: "unknown-suite",
    });
    expect(capability.kemSecretKey).toEqual(new Uint8Array(3168));
  });

  it.each([
    ["PPXT", false],
    ["PPXM", true],
  ] as const)(
    "round-trips canonical %s text requests",
    async (magic, compact) => {
      const events: PPXWorkerEvent[] = [];
      const runner = createCryptoRunner((event) => events.push(event));
      const encryptRequestId = `encrypt-${magic}`;
      await runner.handle({
        kind: "encrypt-text",
        requestId: encryptRequestId,
        input: {
          compact,
          sender: structuredClone(alice),
          senderSigningCapability:
            createSenderSigningCapabilityV2(aliceIdentity),
          recipient: structuredClone(bob),
          plaintext: `${magic} worker secret`,
          messageId: fill(16, compact ? 4 : 3),
          sentAt: 4n,
          createdAt: 4n,
        },
      });
      const encrypted = events.find(
        (event) =>
          event.kind === "completed" && event.requestId === encryptRequestId,
      );
      expect(encrypted?.kind).toBe("completed");
      if (
        encrypted?.kind !== "completed" ||
        !("ciphertext" in encrypted.result)
      ) {
        throw new Error("missing encrypted worker result");
      }
      const object = encrypted.result as EncryptedTextObjectV2;
      expect(object).toMatchObject({
        magic,
        formatVersion: 0x02,
        suite: 0x02,
      });

      const decryptRequestId = `decrypt-${magic}`;
      await runner.handle({
        kind: "decrypt-text",
        requestId: decryptRequestId,
        input: {
          object,
          activeIdentity: createDecapsulationCapabilityV2(bobIdentity),
          knownSenders: [structuredClone(alice)],
        },
      });
      const decrypted = events.find(
        (event) =>
          event.kind === "completed" && event.requestId === decryptRequestId,
      );
      expect(decrypted?.kind).toBe("completed");
      if (
        decrypted?.kind !== "completed" ||
        !("plaintext" in decrypted.result)
      ) {
        throw new Error("missing decrypted worker result");
      }
      expect(decrypted.result.plaintext).toBe(`${magic} worker secret`);
    },
    30_000,
  );

  it("transfers every completed identity buffer without retaining worker copies", () => {
    const identity = {
      suite: 2,
      creationTime: 1n,
      pseudonym: "Unlocked",
      masterEntropy: fill(32, 1),
      kemPublicKey: fill(1568, 2),
      kemSecretKey: fill(3168, 3),
      signingPublicKey: fill(2592, 4),
      signingSecretKey: fill(4896, 5),
      fingerprint: fill(32, 6),
      identityId: fill(20, 7),
    } as DerivedIdentityV2;
    const event = {
      kind: "completed" as const,
      requestId: "identity-transfer",
      result: identity,
    };

    const transferred = structuredClone(event, {
      transfer: cryptoEventTransferList(event),
    });

    expect(cryptoEventTransferList(transferred)).toHaveLength(7);
    expect(identity.masterEntropy.byteLength).toBe(0);
    expect(identity.kemPublicKey.byteLength).toBe(0);
    expect(identity.kemSecretKey.byteLength).toBe(0);
    expect(identity.signingPublicKey.byteLength).toBe(0);
    expect(identity.signingSecretKey.byteLength).toBe(0);
    expect(identity.fingerprint.byteLength).toBe(0);
    expect(identity.identityId.byteLength).toBe(0);
  });

  it("zeroizes completed identity buffers when response transfer fails", () => {
    const identity = {
      suite: 2,
      creationTime: 1n,
      pseudonym: "Failed",
      masterEntropy: fill(32, 11),
      kemPublicKey: fill(1568, 12),
      kemSecretKey: fill(3168, 13),
      signingPublicKey: fill(2592, 14),
      signingSecretKey: fill(4896, 15),
      fingerprint: fill(32, 16),
      identityId: fill(20, 17),
    } as DerivedIdentityV2;
    const transferList = cryptoEventTransferList({
      kind: "completed",
      requestId: "identity-post-failure",
      result: identity,
    });

    zeroizeCryptoTransferList(transferList);

    for (const buffer of transferList) {
      expect(new Uint8Array(buffer).every((byte) => byte === 0)).toBe(true);
    }
  });

  it("releases a completed result when the response emitter throws", async () => {
    const events: PPXWorkerEvent[] = [];
    const identity = {
      suite: 2,
      creationTime: 1n,
      pseudonym: "Post failure",
      masterEntropy: fill(32, 18),
      kemPublicKey: fill(1568, 19),
      kemSecretKey: fill(3168, 20),
      signingPublicKey: fill(2592, 21),
      signingSecretKey: fill(4896, 22),
      fingerprint: fill(32, 23),
      identityId: fill(20, 24),
    } as DerivedIdentityV2;
    vi.spyOn(defaultCryptoProvider, "unlockVault").mockResolvedValue(identity);
    const runner = createCryptoRunner((event) => {
      if (event.kind === "completed") throw new Error("post failed");
      events.push(event);
    });

    await runner.handle({
      kind: "unlock-vault",
      requestId: "post-failure",
      input: {
        vault: {
          salt: fill(16, 25),
          nonce: fill(12, 26),
          ciphertext: fill(32, 27),
          checksum: fill(16, 28),
        } as never,
        passphrase: "passphrase",
      },
    });

    expect(events).toContainEqual({
      kind: "error",
      requestId: "post-failure",
      code: "wrong-identity-or-corruption",
    });
    expect(identity.masterEntropy).toEqual(fill(32, 0));
    expect(identity.kemSecretKey).toEqual(fill(3168, 0));
    expect(identity.signingSecretKey).toEqual(fill(4896, 0));
  });

  it("zeroizes a completed identity when its request is cancelled", async () => {
    const events: PPXWorkerEvent[] = [];
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const identity = {
      suite: 2,
      creationTime: 1n,
      pseudonym: "Cancelled",
      masterEntropy: fill(32, 21),
      kemPublicKey: fill(1568, 22),
      kemSecretKey: fill(3168, 23),
      signingPublicKey: fill(2592, 24),
      signingSecretKey: fill(4896, 25),
      fingerprint: fill(32, 26),
      identityId: fill(20, 27),
    } as DerivedIdentityV2;
    vi.spyOn(defaultCryptoProvider, "unlockVault").mockImplementation(
      async () => {
        await pending;
        return identity;
      },
    );
    const requestCiphertext = fill(32, 33);
    const request = {
      kind: "unlock-vault" as const,
      requestId: "cancel-unlock",
      input: {
        vault: {
          salt: fill(16, 31),
          nonce: fill(12, 32),
          ciphertext: requestCiphertext,
          checksum: fill(16, 34),
        } as never,
        passphrase: "passphrase",
      },
    };
    const runner = createCryptoRunner((event) => events.push(event));

    const running = runner.handle(request);
    await runner.handle({ kind: "cancel", requestId: request.requestId });
    finish();
    await running;

    expect(events).toContainEqual({
      kind: "cancelled",
      requestId: request.requestId,
    });
    expect(identity.masterEntropy).toEqual(fill(32, 0));
    expect(identity.kemSecretKey).toEqual(fill(3168, 0));
    expect(identity.signingSecretKey).toEqual(fill(4896, 0));
    expect(requestCiphertext).toEqual(fill(32, 0));
  });
});
