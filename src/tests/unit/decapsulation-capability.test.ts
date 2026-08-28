import { describe, expect, it } from "vitest";
import { createDecapsulationCapability } from "../../crypto/decapsulation-capability";

describe("decapsulation capability", () => {
  const identity = {
    suite: 1 as const,
    fingerprint: new Uint8Array(32).fill(1),
    identityId: new Uint8Array(20).fill(2),
    kemSecretKey: new Uint8Array(1632).fill(3),
    x25519SecretKey: new Uint8Array(32).fill(4),
  };

  it("retains the suite discriminator with independent secret copies", () => {
    const capability = createDecapsulationCapability(identity);

    expect(capability.suite).toBe(1);
    expect(capability.kemSecretKey).not.toBe(identity.kemSecretKey);
    expect(capability.x25519SecretKey).not.toBe(identity.x25519SecretKey);
  });

  it("rejects unsupported suites at the capability boundary", () => {
    expect(() =>
      createDecapsulationCapability({
        ...identity,
        suite: 2,
      } as never),
    ).toThrow("unknown-suite");
  });
});
