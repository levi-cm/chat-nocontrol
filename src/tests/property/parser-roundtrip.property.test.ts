import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  canonicalProtocolBytes,
  parseForCanonicalRoundTrip,
  protocolFamilies,
} from "../helpers/canonical-protocol";

describe("all PPX parser round trips", () => {
  it("round-trips canonical PPXC, PPXV, PPXR, PPXT, and PPXF values", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        fc.stringMatching(/^[A-Za-z0-9]{1,20}$/u),
        async (entropy, pseudonym) => {
          const fixtures = await canonicalProtocolBytes(entropy, pseudonym);
          for (const family of protocolFamilies) {
            const encoded = fixtures[family];
            expect(parseForCanonicalRoundTrip(family, encoded)()).toEqual(
              encoded,
            );
          }
        },
      ),
      { numRuns: 10 },
    );
  });
});
