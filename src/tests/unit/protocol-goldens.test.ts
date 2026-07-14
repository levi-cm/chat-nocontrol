import { sha512 } from "@noble/hashes/sha2.js";
import { describe, expect, it } from "vitest";

import fixture from "../../../fixtures/protocol/golden-v1.json";
import compressedTextFixture from "../../../fixtures/protocol/golden-v2-ppxt.json";
import {
  canonicalCompressedTextBytes,
  canonicalProtocolBytes,
  parseForCanonicalRoundTrip,
  protocolFamilies,
} from "../helpers/canonical-protocol";

const hex = (value: Uint8Array) =>
  [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");

describe("all-family protocol goldens", () => {
  it("matches full fixed bytes and SHA-512 for every PPX v1 family", async () => {
    const generated = await canonicalProtocolBytes();
    for (const family of protocolFamilies) {
      const expected = fixture.fixtures[family];
      const committed = Uint8Array.from(
        Buffer.from(expected.encodedBase64, "base64"),
      );
      expect(generated[family]).toEqual(committed);
      expect(generated[family]).toHaveLength(expected.encodedLength);
      expect(hex(sha512(generated[family]))).toBe(expected.encodedSha512);
      expect(parseForCanonicalRoundTrip(family, committed)()).toEqual(
        committed,
      );
    }
  });

  it("locks the canonical PPXT v2 compressed envelope", () => {
    const generated = canonicalCompressedTextBytes();
    const expected = compressedTextFixture.fixture;
    expect(generated).toEqual(
      Uint8Array.from(Buffer.from(expected.encodedBase64, "base64")),
    );
    expect(generated).toHaveLength(expected.encodedLength);
    expect(hex(sha512(generated))).toBe(expected.encodedSha512);
    expect(parseForCanonicalRoundTrip("ppxt", generated)()).toEqual(generated);
  });
});
