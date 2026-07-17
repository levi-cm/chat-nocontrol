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
import { createCryptoRunner } from "../../workers/crypto-runner";

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
        knownSenders: [alice],
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
          sender: alice,
          senderSigningCapability:
            createSenderSigningCapabilityV2(aliceIdentity),
          recipient: bob,
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
          knownSenders: [alice],
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
});
