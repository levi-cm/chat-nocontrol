import { describe, expect, it } from "vitest";
import { zeroizeIdentitySecrets } from "../../crypto/zeroize";
import type { DerivedIdentity } from "../../protocol/types";

describe("identity zeroization", () => {
  it("overwrites every private identity buffer while preserving public fields", () => {
    const identity: DerivedIdentity = {
      suite: 1,
      creationTime: 0n,
      masterEntropy: new Uint8Array(32).fill(1),
      kemPublicKey: new Uint8Array(800).fill(2),
      kemSecretKey: new Uint8Array(1632).fill(3),
      x25519PublicKey: new Uint8Array(32).fill(4),
      x25519SecretKey: new Uint8Array(32).fill(5),
      signingPublicKey: new Uint8Array(32).fill(6),
      signingSecretKey: new Uint8Array(32).fill(7),
      fingerprint: new Uint8Array(20).fill(8),
      identityId: new Uint8Array(16).fill(9),
      pseudonym: "Cedar",
    };

    zeroizeIdentitySecrets(identity);

    expect(identity.masterEntropy.every((byte) => byte === 0)).toBe(true);
    expect(identity.kemSecretKey.every((byte) => byte === 0)).toBe(true);
    expect(identity.x25519SecretKey.every((byte) => byte === 0)).toBe(true);
    expect(identity.signingSecretKey.every((byte) => byte === 0)).toBe(true);
    expect(identity.kemPublicKey[0]).toBe(2);
    expect(identity.fingerprint[0]).toBe(8);
  });
});
