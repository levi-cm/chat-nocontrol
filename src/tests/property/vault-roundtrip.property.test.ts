import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { lockVault, unlockVault } from "../../crypto/vault";
import { encodeLockedVault, parseLockedVault } from "../../protocol/ppxv";

describe("PPXV randomized vault round trips", () => {
  it("restores the same identity from serialized encrypted vaults", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(19),
      "Vault owner",
    );
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[A-Za-z0-9]{12,24}$/u),
        async (passphrase) => {
          const vault = await lockVault({ identity, passphrase });
          const unlocked = await unlockVault({
            vault: parseLockedVault(encodeLockedVault(vault)),
            passphrase,
          });
          expect(unlocked.fingerprint).toEqual(identity.fingerprint);
          expect(unlocked.pseudonym).toBe(identity.pseudonym);
        },
      ),
      { numRuns: 3 },
    );
  });
});
