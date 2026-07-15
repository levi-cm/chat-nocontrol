import { describe, expect, it, vi } from "vitest";
import type { CryptoProvider } from "../../crypto/provider";
import {
  verifyRecoveryBytesForIdentity,
  verifyRecoveryCodeForIdentity,
} from "../../flows/identity/recovery-practice";
import { encodeBase45Upper } from "../../protocol/base45";
import { encodeRecoveryObject } from "../../protocol/ppxr";
import type { DerivedIdentity } from "../../protocol/types";

function recoveredIdentity(): DerivedIdentity {
  return {
    suite: 1,
    creationTime: 1n,
    masterEntropy: new Uint8Array(32).fill(1),
    kemPublicKey: new Uint8Array(800),
    kemSecretKey: new Uint8Array(1632).fill(2),
    x25519PublicKey: new Uint8Array(32),
    x25519SecretKey: new Uint8Array(32).fill(3),
    signingPublicKey: new Uint8Array(32),
    signingSecretKey: new Uint8Array(32).fill(4),
    fingerprint: new Uint8Array(32).fill(9),
    identityId: new Uint8Array(20).fill(9),
    pseudonym: "Alice",
  };
}

function recoveryBytes() {
  return encodeRecoveryObject({
    magic: "PPXR",
    formatVersion: 1,
    suite: 1,
    flags: 0,
    masterEntropy: new Uint8Array(32).fill(7),
    creationTime: 1n,
    pseudonym: "Alice",
    checksum: new Uint8Array(16),
  });
}

describe("onboarding recovery practice", () => {
  it("rejects malformed private material before deriving an identity", async () => {
    const provider = {
      deriveIdentity: vi.fn(),
    } satisfies Pick<CryptoProvider, "deriveIdentity">;
    await expect(
      verifyRecoveryBytesForIdentity(
        new Uint8Array([1, 2, 3]),
        new Uint8Array(20),
        provider,
      ),
    ).rejects.toThrow();
    expect(provider.deriveIdentity).not.toHaveBeenCalled();
  });

  it("fully derives and matches the expected identity", async () => {
    const recovered = recoveredIdentity();
    const provider = {
      deriveIdentity: vi.fn().mockResolvedValue(recovered),
    } satisfies Pick<CryptoProvider, "deriveIdentity">;
    await expect(
      verifyRecoveryBytesForIdentity(
        recoveryBytes(),
        new Uint8Array(20).fill(9),
        provider,
      ),
    ).resolves.toBe(true);
    expect(provider.deriveIdentity).toHaveBeenCalledOnce();
    expect(recovered.masterEntropy).toEqual(new Uint8Array(32));
    expect(recovered.signingSecretKey).toEqual(new Uint8Array(32));
  });

  it("rejects another valid identity and accepts the armored recovery code", async () => {
    const provider = {
      deriveIdentity: vi.fn().mockResolvedValue(recoveredIdentity()),
    } satisfies Pick<CryptoProvider, "deriveIdentity">;
    await expect(
      verifyRecoveryBytesForIdentity(
        recoveryBytes(),
        new Uint8Array(20).fill(8),
        provider,
      ),
    ).resolves.toBe(false);
    await expect(
      verifyRecoveryCodeForIdentity(
        `PPX1:RECOVERY:${encodeBase45Upper(recoveryBytes())}`,
        new Uint8Array(20).fill(9),
        provider,
      ),
    ).resolves.toBe(true);
  });
});
