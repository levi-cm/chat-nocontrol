import { describe, expect, it } from "vitest";
import type { PPXWorkerEvent } from "../../crypto/contracts";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { createPublicContact } from "../../protocol/ppxc";
import type { EncryptedTextObject } from "../../protocol/types";
import { createCryptoRunner } from "../../workers/crypto-runner";

describe("typed text crypto runner", () => {
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
});
