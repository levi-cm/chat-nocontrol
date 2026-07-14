import { describe, expect, it } from "vitest";

import { prepareMessageQr } from "../../components/qr/message";

describe("encrypted message QR capacity", () => {
  it.each(["app", "link"] as const)(
    "uses one H-capable QR or reports overflow: %s",
    (transport) => {
      const fitting = prepareMessageQr(
        new Uint8Array(1_039).fill(0x5a),
        transport,
        "https://example.test/app/",
      );
      expect(fitting.fits).toBe(true);
      if (fitting.fits) {
        expect(fitting.version).toBeGreaterThanOrEqual(1);
        expect(fitting.version).toBeLessThanOrEqual(40);
        expect(fitting.segments).toHaveLength(transport === "app" ? 1 : 2);
        expect(fitting.text).toContain(
          transport === "app" ? "PPX1:MESSAGE:" : "#/decrypt/qr/",
        );
      }

      const oversized = prepareMessageQr(
        new Uint8Array(2_000).fill(0xa5),
        transport,
        "https://example.test/app/",
      );
      expect(oversized.fits).toBe(false);
      if (!oversized.fits)
        expect(oversized.encodedBytesOver).toBeGreaterThan(0);
    },
  );

  it("rejects non-HTTPS normal-camera links", () => {
    expect(() =>
      prepareMessageQr(new Uint8Array(10), "link", "http://example.test/"),
    ).toThrow();
  });
});
