import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCryptoProvider } from "../../crypto/default-provider";
import type { PPXWorkerEvent } from "../../crypto/contracts";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { createPublicContact } from "../../protocol/ppxc";
import type { EncryptedTextObject } from "../../protocol/types";
import { createCryptoRunner } from "../../workers/crypto-runner";

describe("typed text crypto runner", () => {
  afterEach(() => vi.restoreAllMocks());

  it("wipes worker-owned decapsulation secrets after decrypt completion", async () => {
    const capability = {
      suite: 1 as const,
      fingerprint: new Uint8Array(32),
      identityId: new Uint8Array(20),
      kemSecretKey: new Uint8Array(1632).fill(7),
      x25519SecretKey: new Uint8Array(32).fill(8),
    };
    vi.spyOn(defaultCryptoProvider, "decryptText").mockResolvedValue(
      {} as never,
    );
    const runner = createCryptoRunner(() => undefined);

    await runner.handle({
      kind: "decrypt-text",
      requestId: "wipe-decrypt",
      input: { object: {} as never, activeIdentity: capability },
    });

    expect(capability.kemSecretKey).toEqual(new Uint8Array(1632));
    expect(capability.x25519SecretKey).toEqual(new Uint8Array(32));
  });

  it("rejects and wipes an unsupported decapsulation suite at the worker boundary", async () => {
    const events: PPXWorkerEvent[] = [];
    const capability = {
      suite: 2,
      fingerprint: new Uint8Array(32),
      identityId: new Uint8Array(20),
      kemSecretKey: new Uint8Array(1632).fill(7),
      x25519SecretKey: new Uint8Array(32).fill(8),
    };
    const decrypt = vi.spyOn(defaultCryptoProvider, "decryptText");
    const runner = createCryptoRunner((event) => events.push(event));

    await runner.handle({
      kind: "decrypt-text",
      requestId: "unsupported-suite",
      input: { object: {} as never, activeIdentity: capability as never },
    });

    expect(decrypt).not.toHaveBeenCalled();
    expect(events).toContainEqual({
      kind: "error",
      requestId: "unsupported-suite",
      code: "unknown-suite",
    });
    expect(capability.kemSecretKey).toEqual(new Uint8Array(1632));
    expect(capability.x25519SecretKey).toEqual(new Uint8Array(32));
  });

  it("wipes decrypt-file authority rejected by the wrong worker", async () => {
    const events: PPXWorkerEvent[] = [];
    const capability = {
      suite: 1 as const,
      fingerprint: new Uint8Array(32),
      identityId: new Uint8Array(20),
      kemSecretKey: new Uint8Array(1632).fill(7),
      x25519SecretKey: new Uint8Array(32).fill(8),
    };
    const runner = createCryptoRunner((event) => events.push(event));

    await runner.handle({
      kind: "decrypt-file",
      requestId: "wrong-crypto-worker",
      input: { object: {} as never, activeIdentity: capability },
    });

    expect(events).toContainEqual({
      kind: "error",
      requestId: "wrong-crypto-worker",
      code: "wrong-identity-or-corruption",
    });
    expect(capability.kemSecretKey).toEqual(new Uint8Array(1632));
    expect(capability.x25519SecretKey).toEqual(new Uint8Array(32));
  });

  it("encrypts and decrypts text through authoritative worker requests", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(81),
      "Alice",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(82),
      "Bob",
    );
    const events: PPXWorkerEvent[] = [];
    const runner = createCryptoRunner((event) => events.push(event));
    await runner.handle({
      kind: "encrypt-text",
      requestId: "encrypt-text-1",
      input: {
        sender: createPublicContact(alice, "Alice", 1n),
        senderSigningCapability: createSenderSigningCapability(alice),
        recipient: createPublicContact(bob, "Bob", 2n),
        plaintext: "worker secret",
        messageId: new Uint8Array(16).fill(3),
        sentAt: 4n,
        createdAt: 4n,
      },
    });
    const encrypted = events.find(
      (event) =>
        event.kind === "completed" && event.requestId === "encrypt-text-1",
    );
    expect(encrypted?.kind).toBe("completed");
    if (encrypted?.kind !== "completed" || !("ciphertext" in encrypted.result))
      throw new Error("missing encrypted worker result");
    const encryptedObject = encrypted.result as EncryptedTextObject;

    await runner.handle({
      kind: "decrypt-text",
      requestId: "decrypt-text-1",
      input: { object: encryptedObject, activeIdentity: bob },
    });
    const decrypted = events.find(
      (event) =>
        event.kind === "completed" && event.requestId === "decrypt-text-1",
    );
    expect(decrypted?.kind).toBe("completed");
    if (decrypted?.kind !== "completed" || !("plaintext" in decrypted.result))
      throw new Error("missing decrypted worker result");
    expect(decrypted.result.plaintext).toBe("worker secret");
  });

  it("emits v2 only for beneficial gzip and decrypts it through the worker", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(91),
      "Alice",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(92),
      "Bob",
    );
    const plaintext = "## Repeated heading\n\n- repeated item\n".repeat(512);
    const events: PPXWorkerEvent[] = [];
    const runner = createCryptoRunner((event) => events.push(event));
    await runner.handle({
      kind: "encrypt-text",
      requestId: "compressible",
      input: {
        sender: createPublicContact(alice, "Alice", 1n),
        senderSigningCapability: createSenderSigningCapability(alice),
        recipient: createPublicContact(bob, "Bob", 2n),
        plaintext,
        messageId: new Uint8Array(16).fill(4),
        sentAt: 5n,
        createdAt: 5n,
      },
    });
    const encrypted = events.find(
      (event) =>
        event.kind === "completed" && event.requestId === "compressible",
    );
    expect(encrypted?.kind).toBe("completed");
    if (encrypted?.kind !== "completed" || !("ciphertext" in encrypted.result))
      throw new Error("missing compressed worker result");
    const object = encrypted.result as EncryptedTextObject;
    expect(object).toMatchObject({ formatVersion: 2, flags: 1 });

    await runner.handle({
      kind: "decrypt-text",
      requestId: "decompress",
      input: { object, activeIdentity: bob },
    });
    const decrypted = events.find(
      (event) => event.kind === "completed" && event.requestId === "decompress",
    );
    expect(decrypted?.kind).toBe("completed");
    if (decrypted?.kind !== "completed" || !("plaintext" in decrypted.result))
      throw new Error("missing decompressed worker result");
    expect(decrypted.result.plaintext).toBe(plaintext);
  });

  it("keeps short and incompressible text on v1", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(93),
      "Alice",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(94),
      "Bob",
    );
    let state = 0x1234_5678;
    const incompressible = Array.from({ length: 4_096 }, () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return String.fromCharCode(33 + (state % 94));
    }).join("");
    for (const [requestId, plaintext] of [
      ["short-v1", "short message"],
      ["random-v1", incompressible],
    ] as const) {
      const events: PPXWorkerEvent[] = [];
      const runner = createCryptoRunner((event) => events.push(event));
      await runner.handle({
        kind: "encrypt-text",
        requestId,
        input: {
          sender: createPublicContact(alice, "Alice", 1n),
          senderSigningCapability: createSenderSigningCapability(alice),
          recipient: createPublicContact(bob, "Bob", 2n),
          plaintext,
          messageId: new Uint8Array(16).fill(6),
          sentAt: 7n,
          createdAt: 7n,
        },
      });
      const encrypted = events.find(
        (event) => event.kind === "completed" && event.requestId === requestId,
      );
      expect(encrypted?.kind).toBe("completed");
      if (
        encrypted?.kind !== "completed" ||
        !("ciphertext" in encrypted.result)
      )
        throw new Error("missing v1 worker result");
      expect(encrypted.result).toMatchObject({ formatVersion: 1, flags: 0 });
    }
  });
});
