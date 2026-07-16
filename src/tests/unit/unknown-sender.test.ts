import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { isKnownSender } from "../../flows/decrypt";
import { createPublicContact } from "../../protocol/ppxc";

describe("unknown sender state", () => {
  it("matches fingerprints, never pseudonyms alone", async () => {
    const alice = await deriveIdentityFromEntropy(new Uint8Array(32), "Alice");
    const impostor = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(1),
      "Alice",
    );
    const saved = createPublicContact(alice, "Alice", 1n);
    expect(
      isKnownSender(saved.fingerprint, [
        {
          contact: saved,
          nickname: "",
          includeSenderContactInLinks: true,
        },
      ]),
    ).toBe(true);
    expect(
      isKnownSender(impostor.fingerprint, [
        {
          contact: saved,
          nickname: "",
          includeSenderContactInLinks: true,
        },
      ]),
    ).toBe(false);
  });
});
