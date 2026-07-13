import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { decapsulateHybrid, encapsulateHybrid } from "../../crypto/hybrid";

describe("PPX hybrid encapsulation", () => {
  it("derives the same AES-256 key for sender and recipient", async () => {
    const recipient = await deriveIdentityFromEntropy(
      new Uint8Array(32),
      "Bob",
    );
    const sender = encapsulateHybrid({
      recipientFingerprint: recipient.fingerprint,
      recipientKemPublicKey: recipient.kemPublicKey,
      recipientX25519PublicKey: recipient.x25519PublicKey,
    });
    const recipientKey = decapsulateHybrid({
      activeIdentity: recipient,
      mlKemCiphertext: sender.mlKemCiphertext,
      ephemeralX25519PublicKey: sender.ephemeralX25519PublicKey,
      salt: sender.salt,
    });
    expect(sender.aes256Key).toHaveLength(32);
    expect(recipientKey).toEqual(sender.aes256Key);
  });
});
