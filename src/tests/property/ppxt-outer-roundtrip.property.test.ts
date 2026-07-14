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
            flags: 0 as const,
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

  it("accepts only canonical version and flag pairs", () => {
    const ciphertext = new Uint8Array(16).fill(9);
    const makeBytes = (formatVersion: number, flags: number) => {
      const base = {
        magic: "PPXT" as const,
        formatVersion: 1 as const,
        suite: 1 as const,
        flags: 0 as const,
        mlKemCiphertext: new Uint8Array(768).fill(1),
        ephemeralX25519PublicKey: new Uint8Array(32).fill(2),
        salt: new Uint8Array(32).fill(3),
        nonce: new Uint8Array(12).fill(4),
        ciphertextLength: ciphertext.byteLength,
      };
      const header = encodeEncryptedTextHeader(base);
      const payload = new Uint8Array(header.byteLength + ciphertext.byteLength);
      payload.set(header);
      payload.set(ciphertext, header.byteLength);
      payload[4] = formatVersion;
      payload[6] = flags;
      const bytes = new Uint8Array(payload.byteLength + 16);
      bytes.set(payload);
      bytes.set(checksum16(payload), payload.byteLength);
      return bytes;
    };

    expect(parseEncryptedTextOuter(makeBytes(1, 0))).toMatchObject({
      formatVersion: 1,
      flags: 0,
    });
    expect(parseEncryptedTextOuter(makeBytes(2, 1))).toMatchObject({
      formatVersion: 2,
      flags: 1,
    });
    for (const pair of [
      [1, 1],
      [2, 0],
      [2, 3],
      [3, 0],
    ] as const) {
      expect(() =>
        parseEncryptedTextOuter(makeBytes(pair[0], pair[1])),
      ).toThrow();
    }
  });
});
