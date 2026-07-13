import { describe, expect, it } from "vitest";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { decapsulateHybrid, encapsulateHybrid } from "../../crypto/hybrid";
import { decryptText, encryptText } from "../../crypto/text";
import { createPublicContact } from "../../protocol/ppxc";

describe("request-scoped CryptoProvider capabilities", () => {
  it("signs text from a request-owned capability and wipes its secret", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(11),
      "Alice",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(12),
      "Bob",
    );
    const sender = createPublicContact(alice, "Alice", 1n);
    const recipient = createPublicContact(bob, "Bob", 2n);
    const capability = createSenderSigningCapability(alice);

    const object = await encryptText({
      sender,
      senderSigningCapability: capability,
      recipient,
      plaintext: "provider boundary",
      messageId: new Uint8Array(16).fill(9),
      sentAt: 3n,
      createdAt: 3n,
    });

    expect(capability.signingSecretKey).toEqual(new Uint8Array(32));
    await expect(
      decryptText({ object, activeIdentity: bob }),
    ).resolves.toMatchObject({
      plaintext: "provider boundary",
      signatureValid: true,
    });
  });

  it("rejects a capability that does not match the public sender", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(21),
      "Alice",
    );
    const mallory = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(22),
      "Mallory",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(23),
      "Bob",
    );
    const capability = createSenderSigningCapability(mallory);

    await expect(
      encryptText({
        sender: createPublicContact(alice, "Alice", 1n),
        senderSigningCapability: capability,
        recipient: createPublicContact(bob, "Bob", 2n),
        plaintext: "must fail",
        messageId: new Uint8Array(16),
        sentAt: 3n,
        createdAt: 3n,
      }),
    ).rejects.toThrow("invalid-signature");
    expect(capability.signingSecretKey).toEqual(new Uint8Array(32));
  });

  it("rejects a corrupted recipient contact before encapsulation", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(24),
      "Alice",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(25),
      "Bob",
    );
    const recipient = createPublicContact(bob, "Bob", 2n);
    recipient.identityId[0] = (recipient.identityId[0] as number) ^ 1;
    const capability = createSenderSigningCapability(alice);

    await expect(
      encryptText({
        sender: createPublicContact(alice, "Alice", 1n),
        senderSigningCapability: capability,
        recipient,
        plaintext: "must fail before encapsulation",
        messageId: new Uint8Array(16),
        sentAt: 3n,
        createdAt: 3n,
      }),
    ).rejects.toThrow("invalid-signature");
    expect(capability.signingSecretKey).toEqual(new Uint8Array(32));
  });

  it("rejects a substituted signing seed even when public metadata matches", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(26),
      "Alice",
    );
    const mallory = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(27),
      "Mallory",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(28),
      "Bob",
    );
    const capability = createSenderSigningCapability(alice);
    capability.signingSecretKey.set(mallory.signingSecretKey);

    await expect(
      encryptText({
        sender: createPublicContact(alice, "Alice", 1n),
        senderSigningCapability: capability,
        recipient: createPublicContact(bob, "Bob", 2n),
        plaintext: "must fail before encryption",
        messageId: new Uint8Array(16),
        sentAt: 3n,
        createdAt: 3n,
      }),
    ).rejects.toThrow("invalid-signature");
    expect(capability.signingSecretKey).toEqual(new Uint8Array(32));
  });

  it("creates fresh hybrid encapsulation entirely inside crypto", async () => {
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(31),
      "Bob",
    );
    const recipient = {
      recipientFingerprint: bob.fingerprint,
      recipientKemPublicKey: bob.kemPublicKey,
      recipientX25519PublicKey: bob.x25519PublicKey,
    };
    const first = encapsulateHybrid(recipient);
    const second = encapsulateHybrid(recipient);

    expect(first.mlKemCiphertext).toHaveLength(768);
    expect(first.ephemeralX25519PublicKey).toHaveLength(32);
    expect(first.salt).toHaveLength(32);
    expect(first.mlKemCiphertext).not.toEqual(second.mlKemCiphertext);
    expect(first.ephemeralX25519PublicKey).not.toEqual(
      second.ephemeralX25519PublicKey,
    );
    expect(
      decapsulateHybrid({
        activeIdentity: bob,
        mlKemCiphertext: first.mlKemCiphertext,
        ephemeralX25519PublicKey: first.ephemeralX25519PublicKey,
        salt: first.salt,
      }),
    ).toEqual(first.aes256Key);
  });
});
