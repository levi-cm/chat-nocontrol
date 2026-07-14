import { describe, expect, it } from "vitest";

import { captureQrMessageLink, routeFromHash } from "../../app/routes";
import { encodeBase37Upper } from "../../protocol/base37";
import { extractQrMessageBytes } from "../../protocol/ppxq";
import { canonicalQrTextBytes } from "../helpers/canonical-protocol";

describe("transient message QR links", () => {
  it("routes exact payload fragments to decrypt without query transport", () => {
    expect(routeFromHash("#/decrypt/qr/ABC-123")).toBe("decrypt");
    const location = {
      origin: "https://example.test",
      pathname: "/app/",
      search: "",
      hash: "#/decrypt/qr/ABC-123",
    } as Location;
    expect(captureQrMessageLink(location)).toBe(
      "https://example.test/app/#/decrypt/qr/ABC-123",
    );
  });

  it("rejects malformed and oversized fragments before retention", () => {
    for (const hash of [
      "#/decrypt/qr/",
      "#/decrypt/qr/lower",
      `#/decrypt/qr/${"A".repeat(120_001)}`,
    ]) {
      expect(captureQrMessageLink({ hash } as Location)).toBeNull();
    }
  });

  it("extracts canonical app text and cross-host HTTPS links without navigation", () => {
    const bytes = canonicalQrTextBytes();
    const encoded = encodeBase37Upper(bytes);
    expect(extractQrMessageBytes(`PPX1:MESSAGE:${encoded}`)).toEqual(bytes);
    expect(
      extractQrMessageBytes(`https://foreign.example/path/#/decrypt/qr/${encoded}`),
    ).toEqual(bytes);
    expect(() =>
      extractQrMessageBytes(`http://foreign.example/#/decrypt/qr/${encoded}`),
    ).toThrow();
  });
});
