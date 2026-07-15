import { describe, expect, it } from "vitest";
import { messages } from "../../i18n";

describe("warning translation parity", () => {
  it("keeps every safety-critical warning present in both locales", () => {
    for (const key of [
      "privateBody",
      "recoveryWarning",
      "recoveryWordsWarning",
      "wrongIdentityOrDamaged",
      "unknownSenderText",
      "weakVaultPasswordBody",
      "vaultCreationErrorBody",
    ] as const) {
      expect(messages.en[key].length).toBeGreaterThan(20);
      expect(messages.de[key].length).toBeGreaterThan(20);
    }
  });
});
