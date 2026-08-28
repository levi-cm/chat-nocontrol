import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  canonicalProtocolBytes,
  parseForCanonicalRoundTrip,
  protocolFamilies,
} from "../helpers/canonical-protocol";
import {
  canonicalCat5ProtocolBytes,
  cat5ProtocolFamilies,
  parseCat5ForCanonicalRoundTrip,
} from "../helpers/canonical-cat5-protocol";

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

  it("round-trips seeded CAT5 PPXC/PPXT/PPXM/PPXF/PPXR/PPXV values", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 0x7fff_ffff }),
        fc.stringMatching(/^[A-Za-z0-9]{1,20}$/u),
        async (seed, pseudonym) => {
          const fixtures = await canonicalCat5ProtocolBytes(seed, pseudonym);
          for (const family of cat5ProtocolFamilies) {
            const encoded = fixtures[family];
            expect(parseCat5ForCanonicalRoundTrip(family, encoded)()).toEqual(
              encoded,
            );
          }
        },
      ),
      { numRuns: 8, seed: 0x5ca1_2026 },
    );
  }, 30_000);

  it("derives distinct canonical PPXC contacts from distinct seeds", async () => {
    const first = await canonicalCat5ProtocolBytes(1, "Alice");
    const second = await canonicalCat5ProtocolBytes(2, "Alice");
    expect(first.ppxc).not.toEqual(second.ppxc);
    expect(parseCat5ForCanonicalRoundTrip("ppxc", first.ppxc)()).toEqual(
      first.ppxc,
    );
    expect(parseCat5ForCanonicalRoundTrip("ppxc", second.ppxc)()).toEqual(
      second.ppxc,
    );
  });
});
