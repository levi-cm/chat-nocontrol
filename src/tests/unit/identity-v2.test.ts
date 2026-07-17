import { describe, expect, it } from "vitest";
import {
  createDecapsulationCapabilityV2,
  createSenderSigningCapabilityV2,
  deriveIdentityV2FromEntropy,
} from "../../crypto/identity-v2";

describe("Cat-5 V2 identity", () => {
  it("derives only ML-KEM-1024 and ML-DSA-87 keys deterministically", async () => {
    const master = Uint8Array.from({ length: 32 }, (_, index) => index);
    const left = await deriveIdentityV2FromEntropy(master, "Alice", 7n);
    const right = await deriveIdentityV2FromEntropy(master, "Alice", 7n);

    expect(left.suite).toBe(0x02);
    expect(left.masterEntropy).not.toBe(master);
    expect(left.kemPublicKey).toEqual(right.kemPublicKey);
    expect(left.signingPublicKey).toEqual(right.signingPublicKey);
    expect(left.fingerprint).toEqual(right.fingerprint);
    expect(left.fingerprint).toHaveLength(32);
    expect(left.identityId).toEqual(left.fingerprint.slice(0, 20));
    expect("x25519PublicKey" in left).toBe(false);
    expect("ed25519PublicKey" in left).toBe(false);
  });

  it("projects narrow signing and decapsulation capabilities", async () => {
    const identity = await deriveIdentityV2FromEntropy(new Uint8Array(32));
    const signing = createSenderSigningCapabilityV2(identity);
    const decapsulation = createDecapsulationCapabilityV2(identity);

    expect(Object.keys(signing).sort()).toEqual(
      ["fingerprint", "signingPublicKey", "signingSecretKey", "suite"].sort(),
    );
    expect(Object.keys(decapsulation).sort()).toEqual(
      ["fingerprint", "identityId", "kemSecretKey", "suite"].sort(),
    );
  });

  it("zeroizes a generated KEM secret when later DSA keygen fails", async () => {
    const kemSecretKey = new Uint8Array(3168).fill(0xab);
    const operation = deriveIdentityV2FromEntropy(new Uint8Array(32), "", 0n, {
      deriveKey: (_input, _salt, _info, length) => new Uint8Array(length),
      kemKeygen: () => ({
        publicKey: new Uint8Array(1568),
        secretKey: kemSecretKey,
      }),
      dsaKeygen: () => {
        throw new Error("injected DSA failure");
      },
    });

    await expect(operation).rejects.toThrow("injected DSA failure");
    expect(kemSecretKey.every((byte) => byte === 0)).toBe(true);
  });
});
