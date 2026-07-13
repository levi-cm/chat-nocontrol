import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { lockVault, unlockVault } from "../../crypto/vault";
import { encodeLockedVault, parseLockedVault } from "../../protocol/ppxv";

describe("PPXV vault", () => {
  it("locks and unlocks with exact PPX parameters", async () => {
    const identity = await deriveIdentityFromEntropy(
      Uint8Array.from({ length: 32 }, (_, index) => index),
      "Alice",
      1_717_171_717n,
    );
    const vault = await lockVault({
      identity,
      passphrase: "five random words make safer vaults",
    });
    const parsed = parseLockedVault(encodeLockedVault(vault));
    const unlocked = await unlockVault({
      vault: parsed,
      passphrase: "five random words make safer vaults",
    });

    expect(encodeLockedVault(vault).slice(0, 8)).toEqual(
      Uint8Array.of(0x50, 0x50, 0x58, 0x56, 0x01, 0x01, 0x01, 0x01),
    );
    expect(parsed).toMatchObject({
      magic: "PPXV",
      formatVersion: 1,
      suite: 1,
      flags: 1,
      kdfId: 1,
    });
    expect(parsed.scryptN).toBe(65_536);
    expect(parsed.scryptR).toBe(8);
    expect(parsed.scryptP).toBe(2);
    expect(parsed.salt).toHaveLength(16);
    expect(parsed.nonce).toHaveLength(12);
    expect(unlocked.masterEntropy).toEqual(identity.masterEntropy);
    expect(unlocked.fingerprint).toEqual(identity.fingerprint);
    expect(unlocked.pseudonym).toBe("Alice");
    expect(unlocked.creationTime).toBe(1_717_171_717n);
  });
});
