import { describe, expect, it } from "vitest";
import {
  canonicalCompressedTextBytes,
  canonicalProtocolBytes,
  canonicalQrTextBytes,
  parseForCanonicalRoundTrip,
  protocolFamilies,
} from "../helpers/canonical-protocol";

describe("canonical object truncations", () => {
  it("rejects every shortened canonical object in all five families", async () => {
    const fixtures = await canonicalProtocolBytes();
    for (const family of protocolFamilies) {
      const canonical = fixtures[family];
      for (let length = 0; length < canonical.length; length += 1) {
        expect(() =>
          parseForCanonicalRoundTrip(family, canonical.slice(0, length)),
        ).toThrow();
      }
    }
  });

  it("rejects every shortened canonical PPXQ object", async () => {
    const { parseEncryptedQrText } = await import("../../protocol/ppxq-outer");
    const canonical = canonicalQrTextBytes();
    for (let length = 0; length < canonical.length; length += 1) {
      expect(() => parseEncryptedQrText(canonical.slice(0, length))).toThrow();
    }
  });

  it("rejects every shortened canonical PPXT v2 object", () => {
    const canonical = canonicalCompressedTextBytes();
    for (let length = 0; length < canonical.length; length += 1) {
      expect(() =>
        parseForCanonicalRoundTrip("ppxt", canonical.slice(0, length)),
      ).toThrow();
    }
  });
});
