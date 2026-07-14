import { describe, expect, it } from "vitest";
import {
  canonicalCompressedTextBytes,
  canonicalProtocolBytes,
  parseForCanonicalRoundTrip,
  protocolFamilies,
} from "../helpers/canonical-protocol";

describe("canonical object mutations", () => {
  it("rejects every single-byte mutation in all five families", async () => {
    const fixtures = await canonicalProtocolBytes();
    for (const family of protocolFamilies) {
      const canonical = fixtures[family];
      for (let index = 0; index < canonical.length; index += 1) {
        const mutated = canonical.slice();
        mutated[index] = (mutated[index] as number) ^ 1;
        expect(() => parseForCanonicalRoundTrip(family, mutated)).toThrow();
      }
    }
  });

  it("rejects every single-byte mutation in canonical PPXT v2", () => {
    const canonical = canonicalCompressedTextBytes();
    for (let index = 0; index < canonical.length; index += 1) {
      const mutated = canonical.slice();
      mutated[index] = (mutated[index] as number) ^ 1;
      expect(() => parseForCanonicalRoundTrip("ppxt", mutated)).toThrow();
    }
  });
});
