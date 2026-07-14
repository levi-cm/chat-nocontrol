import { describe, expect, it } from "vitest";

import { decodeBase37Upper, encodeBase37Upper } from "../../protocol/base37";

describe("canonical base37 QR codec", () => {
  it.each([
    new Uint8Array(),
    Uint8Array.of(0),
    Uint8Array.of(0, 0, 1),
    Uint8Array.from({ length: 256 }, (_, index) => index),
    Uint8Array.from({ length: 1_200 }, (_, index) => (index * 73) & 0xff),
  ])("round-trips bytes including leading zeroes", (bytes) => {
    const encoded = encodeBase37Upper(bytes);
    expect(decodeBase37Upper(encoded, 1_200)).toEqual(bytes);
    expect(encodeBase37Upper(decodeBase37Upper(encoded, 1_200))).toBe(encoded);
  });

  it.each(["a", "_", " ", "ABC/", "+1"])("rejects invalid text %s", (text) => {
    expect(() => decodeBase37Upper(text, 1_200)).toThrow();
  });

  it("rejects oversize before allocating decoded output", () => {
    expect(() => decodeBase37Upper("Z".repeat(10_000), 32)).toThrow(
      "oversize-before-allocation",
    );
  });
});
