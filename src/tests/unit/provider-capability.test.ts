import { describe, expect, it } from "vitest";
import {
  cloneDecapsulationCapabilityV2,
  cloneSenderSigningCapabilityV2,
  validateDecapsulationCapabilityV2,
  validateSenderSigningCapabilityV2,
  zeroizeDecapsulationCapabilityV2,
  zeroizeSenderSigningCapabilityV2,
} from "../../crypto/capability-v2";
import {
  createDecapsulationCapabilityV2,
  createSenderSigningCapabilityV2,
  deriveIdentityV2FromEntropy,
} from "../../crypto/identity-v2";

describe("Cat-5 request capabilities", () => {
  it("clones, validates, and wipes ML-KEM-1024 decapsulation authority", async () => {
    const identity = await deriveIdentityV2FromEntropy(new Uint8Array(32));
    const source = createDecapsulationCapabilityV2(identity);
    const clone = cloneDecapsulationCapabilityV2(source);

    expect(() => validateDecapsulationCapabilityV2(clone)).not.toThrow();
    expect(Object.keys(clone).sort()).toEqual(
      ["fingerprint", "identityId", "kemSecretKey", "suite"].sort(),
    );
    expect(clone.kemSecretKey).not.toBe(source.kemSecretKey);
    zeroizeDecapsulationCapabilityV2(clone);
    expect(clone.kemSecretKey).toEqual(new Uint8Array(3168));
    expect(source.kemSecretKey).not.toEqual(new Uint8Array(3168));
  });

  it("clones, validates, and wipes ML-DSA-87 signing authority", async () => {
    const identity = await deriveIdentityV2FromEntropy(new Uint8Array(32));
    const source = createSenderSigningCapabilityV2(identity);
    const clone = cloneSenderSigningCapabilityV2(source);

    expect(() => validateSenderSigningCapabilityV2(clone)).not.toThrow();
    expect(clone.signingSecretKey).not.toBe(source.signingSecretKey);
    zeroizeSenderSigningCapabilityV2(clone);
    expect(clone.signingSecretKey).toEqual(new Uint8Array(4896));
    expect(source.signingSecretKey).not.toEqual(new Uint8Array(4896));
  });

  it("rejects non-Cat-5 suites before length validation", () => {
    expect(() =>
      validateDecapsulationCapabilityV2({
        suite: 1,
        fingerprint: new Uint8Array(32),
        identityId: new Uint8Array(20),
        kemSecretKey: new Uint8Array(3168),
      } as never),
    ).toThrow("unknown-suite");
    expect(() =>
      validateSenderSigningCapabilityV2({
        suite: 1,
        fingerprint: new Uint8Array(32),
        signingPublicKey: new Uint8Array(2592),
        signingSecretKey: new Uint8Array(4896),
      } as never),
    ).toThrow("unknown-suite");
  });

  it("rejects malformed Cat-5 capability lengths", () => {
    expect(() =>
      validateDecapsulationCapabilityV2({
        suite: 2,
        fingerprint: new Uint8Array(31),
        identityId: new Uint8Array(20),
        kemSecretKey: new Uint8Array(3168),
      }),
    ).toThrow("wrong-identity-or-corruption");
    expect(() =>
      validateSenderSigningCapabilityV2({
        suite: 2,
        fingerprint: new Uint8Array(32),
        signingPublicKey: new Uint8Array(2592),
        signingSecretKey: new Uint8Array(4895),
      }),
    ).toThrow("wrong-identity-or-corruption");
  });
});
