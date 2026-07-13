import { describe, expect, it } from "vitest";
import {
  calculateEncryptedFileChecksum,
  encodeEncryptedFileObject,
} from "../../protocol/ppxf";
import type {
  ChunkRecord,
  EncryptedManifestRecord,
  FileHeader,
} from "../../protocol/types";

function header(): FileHeader {
  return {
    magic: "PPXF",
    formatVersion: 1,
    suite: 1,
    flags: 0,
    recipientId: new Uint8Array(20),
    mlKemCiphertext: new Uint8Array(768),
    ephemeralX25519PublicKey: new Uint8Array(32),
    noncePrefix: new Uint8Array(8),
    salt: new Uint8Array(32),
    declaredChunkCount: 2,
    chunkSize: 1_048_576,
    totalFileLength: 1_048_577n,
  };
}

const manifest: EncryptedManifestRecord = {
  chunkIndex: 0xffff_ffff,
  plaintextLength: 1,
  ciphertext: new Uint8Array(17),
};

function chunk(chunkIndex: number, plaintextLength: number): ChunkRecord {
  return {
    chunkIndex,
    plaintextLength,
    ciphertext: new Uint8Array(plaintextLength + 16),
  };
}

describe("PPXF record order", () => {
  it.each([
    [chunk(1, 1), chunk(0, 1_048_576)],
    [chunk(0, 1), chunk(1, 1_048_576)],
    [chunk(0, 1_048_576)],
  ])("rejects reordered, wrongly-sized, or missing records", (...chunks) => {
    const base = { header: header(), chunks, manifest };
    expect(() =>
      encodeEncryptedFileObject({
        ...base,
        checksum: calculateEncryptedFileChecksum(base),
      }),
    ).toThrow("impossible-length");
  });
});
