import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import {
  createPublicContact,
  encodePublicContact,
  encodePublicContactQr,
  parsePublicContactQr,
} from "../../protocol/ppxc";
import { qrRenderOptions } from "../../components/qr/generate";
import QRCode from "qrcode";

describe("PPXC QR capacity", () => {
  it("fits maximum pseudonym in level-M version-26 envelope", async () => {
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

  it("renders public contacts as crisp level-M QR codes", async () => {
    const identity = await deriveIdentityFromEntropy(new Uint8Array(32), "A");
    const text = encodePublicContactQr(
      createPublicContact(identity, "A".repeat(48), 1n),
    );
    const options = qrRenderOptions(text);
    const qr = QRCode.create(text, {
      errorCorrectionLevel: options.errorCorrectionLevel,
    });

    expect(options).toMatchObject({
      errorCorrectionLevel: "M",
      margin: 4,
      width: 2_048,
      color: { dark: "#000000", light: "#ffffff" },
    });
    expect(qr.version).toBe(26);
  });
});
