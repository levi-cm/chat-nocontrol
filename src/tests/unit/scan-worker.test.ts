import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import {
  createPublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import { classifyScannedText } from "../../workers/scan-runner";

describe("scan worker runner", () => {
  it("strictly classifies a canonical contact and rejects damaged input", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32),
      "Worker Alice",
    );
    const qr = encodePublicContactQr(
      createPublicContact(identity, "Worker Alice", 1n),
    );
    expect(classifyScannedText(qr)).toBe("public-contact");
    expect(() => classifyScannedText(`${qr.slice(0, -1)}!`)).toThrow();
  });
});
