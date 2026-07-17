import { describe, expect, it, vi } from "vitest";
import type { CryptoProvider } from "../../crypto/provider";
import {
  verifyRecoveryBytesForIdentity,
  verifyRecoveryCodeForIdentity,
} from "../../flows/identity/recovery-practice";
import { encodeBase45Upper } from "../../protocol/base45";
import { encodeRecoveryObjectV2 } from "../../protocol/ppxr-v2";
import type { DerivedIdentityV2 } from "../../protocol/types-v2";

function recoveredIdentity(): DerivedIdentityV2 {
  return {
    suite: 2,
    creationTime: 1n,
    masterEntropy: new Uint8Array(32).fill(1),
    kemPublicKey: new Uint8Array(1568),
    kemSecretKey: new Uint8Array(3168).fill(2),
    signingPublicKey: new Uint8Array(2592),
    signingSecretKey: new Uint8Array(4896).fill(4),
    fingerprint: new Uint8Array(32).fill(9),
    identityId: new Uint8Array(20).fill(9),
    pseudonym: "Alice",
  };
}

function recoveryBytes() {
  return encodeRecoveryObjectV2({
    magic: "PPXR",
    formatVersion: 2,
    suite: 2,
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
    expect(recovered.signingSecretKey).toEqual(new Uint8Array(4896));
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
        `PPX2:RECOVERY:${encodeBase45Upper(recoveryBytes())}`,
        new Uint8Array(20).fill(9),
        provider,
      ),
    ).resolves.toBe(true);
  });
});
