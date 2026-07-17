import { describe, expect, it } from "vitest";
import { checksum16 } from "../../protocol/checksum";
import {
  calculateEncryptedFileChecksumV2,
  encodeEncryptedFileObjectV2,
  parseEncryptedFileObjectV2,
} from "../../protocol/ppxf-v2";
import {
  encodeFileHeaderV2,
  PPXF_V2_CHUNK_BYTES,
  PPXF_V2_HEADER_BYTES,
  requiredFileChunkCountV2,
} from "../../protocol/ppxf-header-v2";
import type {
  EncryptedFileObjectV2,
  FileHeaderV2,
} from "../../protocol/types-v2";

const fill = (length: number, value: number) =>
  new Uint8Array(length).fill(value);

function header(totalFileLength = 3n): FileHeaderV2 {
  return {
    magic: "PPXF",
    formatVersion: 2,
    suite: 2,
    flags: 0,
    recipientId: fill(20, 1),
    mlKemCiphertext: fill(1568, 2),
    noncePrefix: fill(8, 3),
    salt: fill(32, 4),
    declaredChunkCount: requiredFileChunkCountV2(totalFileLength),
    chunkSize: PPXF_V2_CHUNK_BYTES,
    totalFileLength,
  };
}

function object(): EncryptedFileObjectV2 {
  const base = {
    header: header(),
    chunks: [
      {
        chunkIndex: 0,
        plaintextLength: 3,
        ciphertext: fill(19, 5),
      },
    ],
    manifest: {
      chunkIndex: 0xffff_ffff as const,
      plaintextLength: 13_563,
      ciphertext: fill(13_579, 6),
    },
  };
  return { ...base, checksum: calculateEncryptedFileChecksumV2(base) };
}

describe("PPXF Cat-5 V2 outer codec", () => {
  it("uses exact 1651-byte suite-2 header without X25519", () => {
    const value = header();
    expect(encodeFileHeaderV2(value)).toHaveLength(PPXF_V2_HEADER_BYTES);
    expect(PPXF_V2_HEADER_BYTES).toBe(1651);
    expect("ephemeralX25519PublicKey" in value).toBe(false);
  });

  it("round-trips strictly ordered chunks and terminal manifest", () => {
    const expected = object();
    expect(
      parseEncryptedFileObjectV2(encodeEncryptedFileObjectV2(expected)),
    ).toEqual(expected);
  });

  it("rejects v1, reordering, truncation, mutation, and trailing bytes", () => {
    const canonical = encodeEncryptedFileObjectV2(object());
    const v1 = Uint8Array.from(canonical);
    v1[4] = 1;
    v1.set(checksum16(v1.slice(0, -16)), v1.length - 16);
    expect(() => parseEncryptedFileObjectV2(v1)).toThrow(
      "unknown-format-version",
    );

    const reordered = Uint8Array.from(canonical);
    const recordIndex = PPXF_V2_HEADER_BYTES;
    reordered[recordIndex + 3] = 1;
    reordered.set(checksum16(reordered.slice(0, -16)), reordered.length - 16);
    expect(() => parseEncryptedFileObjectV2(reordered)).toThrow(
      "impossible-length",
    );

    expect(() => parseEncryptedFileObjectV2(canonical.slice(0, -1))).toThrow();
    const mutated = Uint8Array.from(canonical);
    mutated[PPXF_V2_HEADER_BYTES + 12] =
      (mutated[PPXF_V2_HEADER_BYTES + 12] as number) ^ 1;
    expect(() => parseEncryptedFileObjectV2(mutated)).toThrow(
      "checksum-mismatch",
    );
    const trailing = new Uint8Array(canonical.length + 1);
    trailing.set(canonical);
    expect(() => parseEncryptedFileObjectV2(trailing)).toThrow();
  });

  it("enforces 1 MiB chunks and 100 MiB allocation bound", () => {
    expect(requiredFileChunkCountV2(0n)).toBe(0);
    expect(requiredFileChunkCountV2(1n)).toBe(1);
    expect(requiredFileChunkCountV2(1_048_576n)).toBe(1);
    expect(requiredFileChunkCountV2(1_048_577n)).toBe(2);
    expect(() => requiredFileChunkCountV2(104_857_601n)).toThrow(
      "oversize-before-allocation",
    );
  });
});
