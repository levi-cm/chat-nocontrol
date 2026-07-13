import { describe, expect, it } from "vitest";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { decryptText, encryptText } from "../../crypto/text";
import { createPublicContact } from "../../protocol/ppxc";
import { checksum16 } from "../../protocol/checksum";
import { encodeEncryptedText, parseEncryptedText } from "../../protocol/ppxt";
import { encodeEncryptedTextHeader } from "../../protocol/ppxt-outer";
import {
  encodeSignedTextInner,
  parseSignedTextInner,
} from "../../protocol/ppxt-inner";

function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

describe("PPXT", () => {
  it("round-trips signed text without outer sender or recipient hints", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(1),
      "Alice",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(2),
      "Bob",
    );
    const sender = createPublicContact(alice, "Alice", 10n);
    const recipient = createPublicContact(bob, "Bob", 20n);
    const encrypted = await encryptText({
      sender,
      senderSigningCapability: createSenderSigningCapability(alice),
      recipient,
      plaintext: "Meet at 21:00.",
      messageId: new Uint8Array(16).fill(3),
      sentAt: 30n,
      createdAt: 29n,
    });

    expect(Object.keys(encrypted).sort()).toEqual(
      [
        "magic",
        "formatVersion",
        "suite",
        "flags",
        "mlKemCiphertext",
        "ephemeralX25519PublicKey",
        "salt",
        "nonce",
        "ciphertextLength",
        "ciphertext",
        "checksum",
      ].sort(),
    );
    const parsed = parseEncryptedText(encodeEncryptedText(encrypted));
    const decrypted = await decryptText({
      object: parsed,
      activeIdentity: bob,
    });
    expect(decrypted.plaintext).toBe("Meet at 21:00.");
    expect(decrypted.senderContact.fingerprint).toEqual(alice.fingerprint);
    expect(decrypted.recipientId).toEqual(bob.identityId);
    expect(decrypted.signatureValid).toBe(true);
  });

  it("collapses tampering to wrong identity or corruption", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(1),
      "Alice",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(2),
      "Bob",
    );
    const object = await encryptText({
      sender: createPublicContact(alice, "Alice", 1n),
      senderSigningCapability: createSenderSigningCapability(alice),
      recipient: createPublicContact(bob, "Bob", 2n),
      plaintext: "secret",
      messageId: new Uint8Array(16),
      sentAt: 3n,
      createdAt: 3n,
    });
    object.ciphertext = object.ciphertext.slice();
    object.ciphertext[0] = (object.ciphertext[0] as number) ^ 1;
    await expect(decryptText({ object, activeIdentity: bob })).rejects.toThrow(
      "wrong-identity-or-corruption",
    );
  });

  it("rejects ciphertext tampering after an attacker recomputes the public checksum", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(1),
      "Alice",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(2),
      "Bob",
    );
    const object = await encryptText({
      sender: createPublicContact(alice, "Alice", 1n),
      senderSigningCapability: createSenderSigningCapability(alice),
      recipient: createPublicContact(bob, "Bob", 2n),
      plaintext: "secret",
      messageId: new Uint8Array(16),
      sentAt: 3n,
      createdAt: 3n,
    });
    object.ciphertext = object.ciphertext.slice();
    object.ciphertext[0] = (object.ciphertext[0] as number) ^ 1;
    object.checksum = checksum16(
      concat(encodeEncryptedTextHeader(object), object.ciphertext),
    );
    const reparsed = parseEncryptedText(encodeEncryptedText(object));
    await expect(
      decryptText({ object: reparsed, activeIdentity: bob }),
    ).rejects.toThrow("wrong-identity-or-corruption");
  });

  it("rejects a directly mutated signed inner signature", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(1),
      "Alice",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(2),
      "Bob",
    );
    const inner = encodeSignedTextInner({
      senderContact: createPublicContact(alice, "Alice", 1n),
      signingSecretKey: alice.signingSecretKey,
      recipientId: bob.identityId,
      messageId: new Uint8Array(16),
      sentAt: 3n,
      createdAt: 3n,
      plaintext: "secret",
    });
    inner[inner.byteLength - 1] = (inner[inner.byteLength - 1] as number) ^ 1;
    expect(() => parseSignedTextInner(inner)).toThrow("invalid-signature");
  });

  it("rejects impossible inner lengths before an embedded sender version", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(41),
      "Alice",
    );
    const inner = encodeSignedTextInner({
      senderContact: createPublicContact(alice, "Alice", 1n),
      signingSecretKey: alice.signingSecretKey,
      recipientId: new Uint8Array(20),
      messageId: new Uint8Array(16),
      sentAt: 1n,
      createdAt: 1n,
      plaintext: "ordering",
    });
    inner[8] = 2;
    inner.fill(0, 0, 4);

    expect(() => parseSignedTextInner(inner)).toThrow("impossible-length");
  });
});
