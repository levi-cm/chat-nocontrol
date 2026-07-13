import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import {
  createPublicContact,
  encodePublicContactQr,
  parsePublicContactQr,
} from "../../protocol/ppxc";

describe("QR degradation", () => {
  it("fails closed for damaged contact payload characters", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const canonical = encodePublicContactQr(
      createPublicContact(identity, "Alice", 1n),
    );
    for (const position of [14, 100, canonical.length - 1]) {
      const damaged = `${canonical.slice(0, position)}!${canonical.slice(position + 1)}`;
      expect(() => parsePublicContactQr(damaged)).toThrow();
    }
  });
});
