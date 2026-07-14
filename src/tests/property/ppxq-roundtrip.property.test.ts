import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { decodeBase37Upper, encodeBase37Upper } from "../../protocol/base37";

describe("PPXQ transport properties", () => {
  it("round-trips arbitrary bounded bytes canonically", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 1_200 }), (bytes) => {
        const text = encodeBase37Upper(bytes);
        expect(decodeBase37Upper(text, 1_200)).toEqual(bytes);
        expect(encodeBase37Upper(decodeBase37Upper(text, 1_200))).toBe(text);
      }),
    );
  });
});
