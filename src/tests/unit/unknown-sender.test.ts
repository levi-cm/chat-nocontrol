import { describe, expect, it } from "vitest";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { isKnownSender } from "../../flows/decrypt";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";

describe("unknown sender state", () => {
  it("matches fingerprints, never pseudonyms alone", async () => {
    const alice = await deriveIdentityV2FromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const impostor = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(1),
      "Alice",
    );
    const saved = createPublicContactV2(
      alice,
      "Alice",
      1n,
      new Uint8Array(32).fill(1),
    );
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
