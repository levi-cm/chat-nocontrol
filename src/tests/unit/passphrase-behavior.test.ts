import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import * as vault from "../../crypto/vault";

type PassphraseModule = typeof vault & {
  estimatePassphraseBits(value: string): number;
  passphraseStrengthBand(bits: number): "weak" | "medium" | "strong";
};

const passphrases = vault as PassphraseModule;

describe("vault passphrase freedom and feedback", () => {
  it("accepts a simple non-empty passphrase while keeping it visibly weak", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(23),
      "Simple passphrase owner",
    );
    await expect(
      vault.lockVault({ identity, passphrase: "1234" }),
    ).resolves.toMatchObject({ magic: "PPXV" });
    expect(passphrases.passphraseStrengthBand(49)).toBe("weak");
  });

  it("uses the approved 50-bit and 100-bit color thresholds", () => {
    expect(passphrases.passphraseStrengthBand(50)).toBe("medium");
    expect(passphrases.passphraseStrengthBand(99)).toBe("medium");
    expect(passphrases.passphraseStrengthBand(100)).toBe("strong");
  });

  it("estimates obvious sequences below a long varied passphrase", () => {
    expect(passphrases.estimatePassphraseBits("1234")).toBeLessThan(50);
    expect(
      passphrases.estimatePassphraseBits(
        "copper meadow orbit lantern violet harbor",
      ),
    ).toBeGreaterThanOrEqual(100);
  });
});
