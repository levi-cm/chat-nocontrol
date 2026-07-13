import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checksum16 } from "../../protocol/checksum";
import {
  encodeEncryptedTextHeader,
  encodeEncryptedTextOuter,
  parseEncryptedTextOuter,
} from "../../protocol/ppxt-outer";
import type { EncryptedTextObject } from "../../protocol/types";

describe("PPXT encrypted outer round trips", () => {
  it("preserves randomized valid ciphertext records", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 16, maxLength: 4096 }),
        (ciphertext) => {
          const base = {
            magic: "PPXT" as const,
            formatVersion: 1 as const,
            suite: 1 as const,
            flags: 0,
            mlKemCiphertext: new Uint8Array(768).fill(1),
            ephemeralX25519PublicKey: new Uint8Array(32).fill(2),
            salt: new Uint8Array(32).fill(3),
            nonce: new Uint8Array(12).fill(4),
            ciphertextLength: ciphertext.byteLength,
          };
          const payload = new Uint8Array(
            encodeEncryptedTextHeader(base).byteLength + ciphertext.byteLength,
          );
          payload.set(encodeEncryptedTextHeader(base));
          payload.set(ciphertext, encodeEncryptedTextHeader(base).byteLength);
          const object: EncryptedTextObject = {
            ...base,
            ciphertext,
            checksum: checksum16(payload),
          };
          expect(
            encodeEncryptedTextOuter(
              parseEncryptedTextOuter(encodeEncryptedTextOuter(object)),
            ),
          ).toEqual(encodeEncryptedTextOuter(object));
        },
      ),
      { numRuns: 25 },
    );
  });
});
