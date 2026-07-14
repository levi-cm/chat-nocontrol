import { describe, expect, it } from "vitest";

import { checksum16 } from "../../protocol/checksum";
import {
  encodeEncryptedQrText,
  encodeEncryptedQrTextHeader,
  parseEncryptedQrText,
  PPXQ_HEADER_SIZE,
} from "../../protocol/ppxq-outer";

function fixture(flags: 0 | 1 = 0) {
  const base = {
    magic: "PPXQ" as const,
    formatVersion: 1 as const,
    suite: 1 as const,
    flags,
    mlKemCiphertext: new Uint8Array(768).fill(0x11),
    ephemeralX25519PublicKey: new Uint8Array(32).fill(0x22),
    salt: new Uint8Array(32).fill(0x33),
    nonce: new Uint8Array(12).fill(0x44),
    ciphertextLength: 170,
    ciphertext: new Uint8Array(170).fill(0x55),
  };
  const header = encodeEncryptedQrTextHeader(base);
  const payload = new Uint8Array(
    header.byteLength + base.ciphertext.byteLength,
  );
  payload.set(header);
  payload.set(base.ciphertext, header.byteLength);
  return { ...base, checksum: checksum16(payload) };
}

describe("PPXQ outer protocol", () => {
  it("locks the 853-byte header and 1039-byte empty-message envelope", () => {
    expect(PPXQ_HEADER_SIZE).toBe(853);
    const encoded = encodeEncryptedQrText(fixture());
    expect(encoded).toHaveLength(1_039);
    expect(encodeEncryptedQrText(parseEncryptedQrText(encoded))).toEqual(
      encoded,
    );
  });

  it.each([0, 1] as const)("accepts canonical flag %s", (flags) => {
    expect(
      parseEncryptedQrText(encodeEncryptedQrText(fixture(flags))).flags,
    ).toBe(flags);
  });

  it("fails closed on flags, truncation, mutation, and trailing bytes", () => {
    const encoded = encodeEncryptedQrText(fixture());
    for (const changed of [
      Uint8Array.from(encoded, (byte, index) => (index === 6 ? 2 : byte)),
      encoded.slice(0, -1),
      Uint8Array.from([...encoded, 0]),
      Uint8Array.from(encoded, (byte, index) =>
        index === 900 ? byte ^ 1 : byte,
      ),
    ]) {
      expect(() => parseEncryptedQrText(changed)).toThrow();
    }
  });
});
