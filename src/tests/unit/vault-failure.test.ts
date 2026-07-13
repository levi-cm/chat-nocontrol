import { describe, expect, it, vi } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { decodeVaultInner, lockVault, unlockVault } from "../../crypto/vault";

describe("vault failure collapse", () => {
  it("wipes copied entropy when malformed inner text decoding fails", () => {
    const malformed = new Uint8Array(42);
    malformed.fill(19, 0, 32);
    malformed[40] = 1;
    malformed[41] = 0xff;
    let ownedEntropy: Uint8Array | undefined;
    // Preserve the generic receiver so the spy remains behaviorally exact.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalSlice = Uint8Array.prototype.slice;
    const slice = vi
      .spyOn(Uint8Array.prototype, "slice")
      .mockImplementation(function (
        this: Uint8Array,
        start?: number,
        end?: number,
      ) {
        const output = originalSlice.call(this, start, end);
        if (this === malformed && start === 0 && end === 32) {
          ownedEntropy = output;
        }
        return output;
      });
    try {
      expect(() => decodeVaultInner(malformed)).toThrow();
      expect(ownedEntropy).toEqual(new Uint8Array(32));
    } finally {
      slice.mockRestore();
    }
  });

  it("wipes its plaintext when key derivation fails", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const plaintext = new Uint8Array(42).fill(7);

    await expect(
      lockVault(
        { identity, passphrase: "five random words make safer vaults" },
        {
          encodePlaintext: () => plaintext,
          deriveKey: () => Promise.reject(new Error("injected KDF failure")),
        },
      ),
    ).rejects.toThrow("injected KDF failure");
    expect(plaintext).toEqual(new Uint8Array(42));
  });

  it("uses one error for wrong passphrase and corruption", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const vault = await lockVault({
      identity,
      passphrase: "five random words make safer vaults",
    });

    await expect(
      unlockVault({ vault, passphrase: "wrong passphrase is still long" }),
    ).rejects.toThrow("wrong-passphrase-or-corruption");

    const corrupted = {
      ...vault,
      ciphertext: vault.ciphertext.slice(),
    };
    corrupted.ciphertext[0] = (corrupted.ciphertext[0] as number) ^ 1;
    await expect(
      unlockVault({
        vault: corrupted,
        passphrase: "five random words make safer vaults",
      }),
    ).rejects.toThrow("wrong-passphrase-or-corruption");
  });
});
