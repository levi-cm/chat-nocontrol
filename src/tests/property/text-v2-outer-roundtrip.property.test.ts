import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checksum16 } from "../../protocol/checksum";
import {
  encodeEncryptedTextHeaderV2,
  encodeEncryptedTextOuterV2,
  parseEncryptedTextOuterV2,
} from "../../protocol/text-v2-outer";

describe("Cat-5 text V2 outer property", () => {
  it("round-trips canonical PPXT/PPXM objects", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("PPXT" as const, "PPXM" as const),
        fc.constantFrom(0 as const, 1 as const),
        fc.uint8Array({ minLength: 0, maxLength: 256 }),
        (magic, flags, suffix) => {
          const minimum = magic === "PPXT" ? 13_524 : 4_731;
          const ciphertext = new Uint8Array(minimum + suffix.length);
          ciphertext.set(suffix, minimum);
          const base = {
            magic,
            formatVersion: 2 as const,
            suite: 2 as const,
            flags,
            mlKemCiphertext: new Uint8Array(1568),
            salt: new Uint8Array(32),
            nonce: new Uint8Array(12),
            ciphertextLength: ciphertext.length,
          };
          const header = encodeEncryptedTextHeaderV2(base);
          const payload = new Uint8Array(header.length + ciphertext.length);
          payload.set(header);
          payload.set(ciphertext, header.length);
          const object = {
            ...base,
            ciphertext,
            checksum: checksum16(payload),
          };
          expect(
            parseEncryptedTextOuterV2(encodeEncryptedTextOuterV2(object)),
          ).toEqual(object);
        },
      ),
      { numRuns: 100 },
    );
  });
});
