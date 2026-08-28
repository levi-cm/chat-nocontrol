import { describe, expect, it } from "vitest";
import {
  canonicalCompressedTextBytes,
  canonicalProtocolBytes,
  canonicalQrTextBytes,
  parseForCanonicalRoundTrip,
  protocolFamilies,
} from "../helpers/canonical-protocol";
import {
  canonicalCat5ProtocolBytes,
  cat5ProtocolFamilies,
  parseCat5ForCanonicalRoundTrip,
} from "../helpers/canonical-cat5-protocol";

function deterministicMutationOffsets(
  length: number,
  seed: number,
): readonly number[] {
  const offsets = new Set([
    0,
    3,
    4,
    5,
    6,
    7,
    Math.floor(length / 2),
    length - 17,
    length - 16,
    length - 1,
  ]);
  let state = seed | 0;
  while (offsets.size < 32) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    offsets.add((state >>> 0) % length);
  }
  return [...offsets].filter((offset) => offset >= 0 && offset < length);
}

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

  it("rejects every single-byte mutation in canonical PPXQ", async () => {
    const { parseEncryptedQrText } = await import("../../protocol/ppxq-outer");
    const canonical = canonicalQrTextBytes();
    for (let index = 0; index < canonical.length; index += 1) {
      const mutated = canonical.slice();
      mutated[index] = (mutated[index] as number) ^ 1;
      expect(() => parseEncryptedQrText(mutated)).toThrow();
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

  it("rejects bounded seeded mutations across every CAT5 family", async () => {
    const fixtures = await canonicalCat5ProtocolBytes();
    for (const [familyIndex, family] of cat5ProtocolFamilies.entries()) {
      const canonical = fixtures[family];
      const offsets = deterministicMutationOffsets(
        canonical.byteLength,
        0x5ca1_0000 | familyIndex,
      );
      for (const offset of offsets) {
        const mutated = Uint8Array.from(canonical);
        mutated[offset] = (mutated[offset] as number) ^ 1;
        expect(
          () => parseCat5ForCanonicalRoundTrip(family, mutated),
          `${family} offset ${offset}`,
        ).toThrow();
      }
    }
  }, 30_000);
});
