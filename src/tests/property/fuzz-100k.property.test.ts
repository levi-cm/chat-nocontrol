import { describe, expect, it } from "vitest";
import { PPXError } from "../../protocol/types";
import {
  parseForCanonicalRoundTrip,
  protocolFamilies,
} from "../helpers/canonical-protocol";
import {
  cat5ProtocolFamilies,
  parseCat5ForCanonicalRoundTrip,
} from "../helpers/canonical-cat5-protocol";

function randomBytes(seed: number, length: number): Uint8Array {
  const output = new Uint8Array(length);
  let state = seed | 0;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    output[index] = state & 0xff;
  }
  return output;
}

describe("100k parser fuzz", () => {
  it("never crashes or accepts a non-round-trippable V1/CAT5 object", () => {
    const targets = [
      ...protocolFamilies.map((family) => ({
        label: `v1-${family}`,
        deepLength: 1_200,
        parse: (bytes: Uint8Array) => parseForCanonicalRoundTrip(family, bytes),
      })),
      ...cat5ProtocolFamilies.map((family) => ({
        label: `cat5-${family}`,
        deepLength:
          family === "ppxc"
            ? 8_867
            : family === "ppxt"
              ? 15_163
              : family === "ppxm"
                ? 6_370
                : family === "ppxf"
                  ? 1_696
                  : family === "ppxr"
                    ? 112
                    : 177,
        parse: (bytes: Uint8Array) =>
          parseCat5ForCanonicalRoundTrip(family, bytes),
      })),
    ];
    let safeRejections = 0;
    for (let index = 1; index <= 100_000; index += 1) {
      const target = targets[index % targets.length]!;
      const deepDelta = ((index >>> 6) % 3) - 1;
      const length =
        index % 64 === 0 ? target.deepLength + deepDelta : index % 384;
      const bytes = randomBytes(index, length);
      let reencode: (() => Uint8Array) | null = null;
      try {
        reencode = target.parse(bytes);
      } catch (error) {
        expect(error).toBeInstanceOf(PPXError);
        safeRejections += 1;
        continue;
      }
      expect(reencode(), target.label).toEqual(bytes);
    }
    expect(safeRejections).toBeGreaterThan(99_900);
  }, 30_000);
});
