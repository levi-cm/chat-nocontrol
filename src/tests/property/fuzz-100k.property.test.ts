import { describe, expect, it } from "vitest";
import { PPXError } from "../../protocol/types";
import {
  parseForCanonicalRoundTrip,
  protocolFamilies,
} from "../helpers/canonical-protocol";

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
  it("never crashes or accepts a non-round-trippable object", () => {
    let safeRejections = 0;
    for (let index = 1; index <= 100_000; index += 1) {
      const bytes = randomBytes(index, index % 1_200);
      let reencode: (() => Uint8Array) | null = null;
      try {
        reencode = parseForCanonicalRoundTrip(
          protocolFamilies[index % protocolFamilies.length]!,
          bytes,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(PPXError);
        safeRejections += 1;
        continue;
      }
      expect(reencode()).toEqual(bytes);
    }
    expect(safeRejections).toBeGreaterThan(99_900);
  });
});
