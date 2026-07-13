import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";

describe("deterministic identity", () => {
  it("derives stable keys and a pseudonym-independent fingerprint", async () => {
    const entropy = Uint8Array.from({ length: 32 }, (_, index) => index);
    const alice = await deriveIdentityFromEntropy(entropy, "Alice");
    const bob = await deriveIdentityFromEntropy(entropy, "Bob");

    expect(alice.kemPublicKey).toHaveLength(800);
    expect(alice.x25519PublicKey).toHaveLength(32);
    expect(alice.signingPublicKey).toHaveLength(32);
    expect(alice.fingerprint).toHaveLength(32);
    expect(alice.identityId).toEqual(alice.fingerprint.slice(0, 20));
    expect(alice.fingerprint).toEqual(bob.fingerprint);
    expect(alice.pseudonym).toBe("Alice");
    expect(bob.pseudonym).toBe("Bob");
  });

  it("rejects entropy that is not exactly 32 bytes", async () => {
    await expect(
      deriveIdentityFromEntropy(new Uint8Array(31), "Alice"),
    ).rejects.toThrow("impossible-length");
  });
});
