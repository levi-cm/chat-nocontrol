import { describe, expect, it } from "vitest";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { lockVaultV2, unlockVaultV2 } from "../../crypto/vault-v2";
import { checksum16 } from "../../protocol/checksum";
import {
  encodeLockedVaultV2,
  parseLockedVaultV2,
} from "../../protocol/ppxv-v2";

describe("Cat-5 PPXV vault", () => {
  it("round-trips one deterministic V2 identity", async () => {
    const identity = await deriveIdentityV2FromEntropy(
      Uint8Array.from({ length: 32 }, (_, index) => index),
      "Alice",
      1_717_171_717n,
    );
    const vault = await lockVaultV2({
      identity,
      passphrase: "five random words make safer vaults",
    });
    const encoded = encodeLockedVaultV2(vault);
    const unlocked = await unlockVaultV2({
      vault: parseLockedVaultV2(encoded),
      passphrase: "five random words make safer vaults",
    });

    expect(encoded.slice(0, 8)).toEqual(
      Uint8Array.of(0x50, 0x50, 0x58, 0x56, 0x02, 0x02, 0x01, 0x01),
    );
    expect(unlocked.masterEntropy).toEqual(identity.masterEntropy);
    expect(unlocked.fingerprint).toEqual(identity.fingerprint);
    expect(unlocked.pseudonym).toBe("Alice");
    expect(unlocked.creationTime).toBe(1_717_171_717n);
  });

  it("rejects V1 and checksum-valid KDF downgrades", async () => {
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(7),
      "Alice",
    );
    const encoded = encodeLockedVaultV2(
      await lockVaultV2({ identity, passphrase: "long migration passphrase" }),
    );
    const v1 = encoded.slice();
    v1[4] = 1;
    v1[5] = 1;
    v1.set(checksum16(v1.subarray(0, -16)), v1.length - 16);
    expect(() => parseLockedVaultV2(v1)).toThrow("unknown-format-version");

    encoded.fill(0, 8, 16);
    encoded[14] = 0x04;
    encoded.set(checksum16(encoded.subarray(0, -16)), encoded.length - 16);
    expect(() => parseLockedVaultV2(encoded)).toThrow("noncanonical-text");
  });
});
