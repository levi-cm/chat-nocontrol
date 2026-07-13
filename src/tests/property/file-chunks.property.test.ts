import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  calculateEncryptedFileChecksum,
  encodeEncryptedFileObject,
  parseEncryptedFileObject,
} from "../../protocol/ppxf";
import { equalBytes } from "../../protocol/checksum";
import type {
  ChunkRecord,
  EncryptedManifestRecord,
  FileHeader,
} from "../../protocol/types";

const CHUNK = 1_048_576;

function expectCanonicalRoundTrip(length: number): void {
  const count = Math.ceil(length / CHUNK);
  const header: FileHeader = {
    magic: "PPXF",
    formatVersion: 1,
    suite: 1,
    flags: 0,
    recipientId: new Uint8Array(20),
    mlKemCiphertext: new Uint8Array(768),
    ephemeralX25519PublicKey: new Uint8Array(32),
    noncePrefix: new Uint8Array(8),
    salt: new Uint8Array(32),
    declaredChunkCount: count,
    chunkSize: CHUNK,
    totalFileLength: BigInt(length),
  };
  const chunks: ChunkRecord[] = Array.from({ length: count }, (_, index) => {
    const plaintextLength = Math.min(CHUNK, length - index * CHUNK);
    return {
      chunkIndex: index,
      plaintextLength,
      ciphertext: new Uint8Array(plaintextLength + 16),
    };
  });
  const manifest: EncryptedManifestRecord = {
    chunkIndex: 0xffff_ffff,
    plaintextLength: 1,
    ciphertext: new Uint8Array(17),
  };
  const base = { header, chunks, manifest };
  const object = {
    ...base,
    checksum: calculateEncryptedFileChecksum(base),
  };
  const parsed = parseEncryptedFileObject(encodeEncryptedFileObject(object));

  expect(parsed.header).toEqual(object.header);
  expect(parsed.chunks).toHaveLength(object.chunks.length);
  for (const [index, expected] of object.chunks.entries()) {
    const actual = parsed.chunks[index] as ChunkRecord;
    expect({
      chunkIndex: actual.chunkIndex,
      plaintextLength: actual.plaintextLength,
    }).toEqual({
      chunkIndex: expected.chunkIndex,
      plaintextLength: expected.plaintextLength,
    });
    expect(equalBytes(actual.ciphertext, expected.ciphertext)).toBe(true);
  }
  expect({
    chunkIndex: parsed.manifest.chunkIndex,
    plaintextLength: parsed.manifest.plaintextLength,
  }).toEqual({
    chunkIndex: object.manifest.chunkIndex,
    plaintextLength: object.manifest.plaintextLength,
  });
  expect(
    equalBytes(parsed.manifest.ciphertext, object.manifest.ciphertext),
  ).toBe(true);
  expect(equalBytes(parsed.checksum, object.checksum)).toBe(true);
}

describe("PPXF chunk properties", () => {
  it("round-trips canonical chunk partitions", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: CHUNK * 2 + 17 }), (length) =>
        expectCanonicalRoundTrip(length),
      ),
      { numRuns: 12 },
    );
  }, 60_000);

  it("replays the third-chunk failure boundary", () => {
    expectCanonicalRoundTrip(CHUNK * 2 + 15);
  });
});
