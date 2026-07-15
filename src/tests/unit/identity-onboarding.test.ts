import { describe, expect, it } from "vitest";
import {
  chooseRecoveryWordPositions,
  identityCreationProgress,
  normalizeRecoveryWordAnswer,
  validatePrintableVaultPassword,
} from "../../flows/identity/onboarding";

describe("identity onboarding policy", () => {
  it("uses the approved seven-step progress sequence", () => {
    expect(identityCreationProgress).toEqual([30, 42, 54, 66, 78, 90, 100]);
  });

  it("accepts printable ASCII and internal spaces", () => {
    expect(validatePrintableVaultPassword("correct horse battery staple")).toBe(
      null,
    );
    expect(validatePrintableVaultPassword("A~9![]{}")).toBe(null);
    expect(validatePrintableVaultPassword("x".repeat(256))).toBe(null);
  });

  it("rejects empty, surrounding-space, non-ASCII, and oversized passwords", () => {
    expect(validatePrintableVaultPassword("")).toBe("empty");
    expect(validatePrintableVaultPassword(" leading")).toBe(
      "surrounding-space",
    );
    expect(validatePrintableVaultPassword("trailing ")).toBe(
      "surrounding-space",
    );
    expect(validatePrintableVaultPassword("pässword")).toBe("non-ascii");
    expect(validatePrintableVaultPassword("x".repeat(257))).toBe("too-long");
  });

  it("chooses four unique sorted recovery positions", () => {
    expect(
      chooseRecoveryWordPositions(new Uint8Array([2, 2, 25, 49, 3, 27])),
    ).toEqual([0, 1, 2, 3]);
  });

  it("normalizes recovery answers without accepting multiple words", () => {
    expect(normalizeRecoveryWordAnswer("  ABANDON  ")).toBe("abandon");
    expect(normalizeRecoveryWordAnswer("two words")).toBe(null);
  });
});
