import { describe, expect, it } from "vitest";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { encryptText } from "../../crypto/text";
import { createPublicContact } from "../../protocol/ppxc";
import { decodeTextArmor, encodeTextArmor } from "../../protocol/ppxt-armor";

describe("PPXT armor", () => {
  it("round-trips exact canonical markers and headers", async () => {
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
      plaintext: "armored",
      messageId: new Uint8Array(16),
      sentAt: 3n,
      createdAt: 3n,
    });
    const armor = encodeTextArmor(object);
    expect(armor.startsWith("-----BEGIN PPX ENCRYPTED TEXT-----\n")).toBe(true);
    expect(armor).toContain("Version: 1\nSuite: PPX-HYBRID-1\nBytes: ");
    expect(armor.endsWith("-----END PPX ENCRYPTED TEXT-----")).toBe(true);
    expect(encodeTextArmor(decodeTextArmor(armor))).toBe(armor);
    expect(() =>
      decodeTextArmor(armor.replace("Version: 1", "Version: 2")),
    ).toThrow();
    expect(() => decodeTextArmor(armor.replace("\n\n", "\n\n="))).toThrow();
  });
});
