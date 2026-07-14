import { describe, expect, it } from "vitest";

import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { decryptQrText, encryptQrText } from "../../crypto/qr-text";
import { createPublicContact } from "../../protocol/ppxc";

async function identities() {
  const alice = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(101),
    "Alice",
  );
  const bob = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(102),
    "Bob",
  );
  const sender = createPublicContact(alice, "Alice", 1n);
  const recipient = createPublicContact(bob, "Bob", 2n);
  return { alice, bob, sender, recipient };
}

describe("compact encrypted QR text", () => {
  it.each([
    ["short Unicode 🔐", 0],
    ["## repeated\n\n- secure message\n".repeat(200), 1],
  ] as const)("round-trips raw/gzip text", async (plaintext, expectedFlag) => {
    const { alice, bob, sender, recipient } = await identities();
    const object = await encryptQrText({
      sender,
      senderSigningCapability: createSenderSigningCapability(alice),
      recipient,
      plaintext,
      messageId: new Uint8Array(16).fill(7),
      sentAt: 8n,
      createdAt: 8n,
    });
    expect(object.flags).toBe(expectedFlag);
    const output = await decryptQrText({
      object,
      activeIdentity: bob,
      knownSenders: [sender],
    });
    expect(output.plaintext).toBe(plaintext);
    expect(output.senderContact.fingerprint).toEqual(sender.fingerprint);
  });

  it("fails closed until the exact sender contact is saved", async () => {
    const { alice, bob, sender, recipient } = await identities();
    const object = await encryptQrText({
      sender,
      senderSigningCapability: createSenderSigningCapability(alice),
      recipient,
      plaintext: "secret",
      messageId: new Uint8Array(16).fill(9),
      sentAt: 10n,
      createdAt: 10n,
    });
    await expect(
      decryptQrText({ object, activeIdentity: bob, knownSenders: [] }),
    ).rejects.toThrow("unknown-sender-contact");
  });
});
