import { describe, expect, it } from "vitest";
import {
  canonicalProtocolBytes,
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
});
