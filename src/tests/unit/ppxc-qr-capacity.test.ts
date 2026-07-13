import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import {
  createPublicContact,
  encodePublicContact,
  encodePublicContactQr,
  parsePublicContactQr,
} from "../../protocol/ppxc";

describe("PPXC QR capacity", () => {
  it("fits maximum pseudonym in QR version 40-H envelope", async () => {
    const identity = await deriveIdentityFromEntropy(new Uint8Array(32), "A");
    const contact = createPublicContact(identity, "A".repeat(48), 1n);
    const bytes = encodePublicContact(contact);
    const qr = encodePublicContactQr(contact);

    expect(bytes).toHaveLength(1008);
    expect(qr.startsWith("PPX1:CONTACT:")).toBe(true);
    expect(qr).toHaveLength(13 + 1512);
    expect(qr.length).toBeLessThanOrEqual(1852);
    expect(parsePublicContactQr(qr).fingerprint).toEqual(identity.fingerprint);
  });
});
