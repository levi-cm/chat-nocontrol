import { describe, expect, it } from "vitest";
import { sha512 } from "@noble/hashes/sha2.js";
import fixture from "../../../fixtures/protocol/ppxf-v1.json";
import { StrictByteWriter } from "../../protocol/bytes";
import { checksum16 } from "../../protocol/checksum";
import { encodeFileHeader } from "../../protocol/ppxf-header";
import {
  calculateEncryptedFileChecksum,
  encodeEncryptedFileObject,
  parseEncryptedFileObject,
} from "../../protocol/ppxf";
import type {
  ChunkRecord,
  EncryptedFileObject,
  EncryptedManifestRecord,
  FileHeader,
} from "../../protocol/types";

function header(totalFileLength = 3n, declaredChunkCount = 1): FileHeader {
  return {
    magic: "PPXF",
    formatVersion: 1,
    suite: 1,
    flags: 0,
    recipientId: new Uint8Array(20).fill(1),
    mlKemCiphertext: new Uint8Array(768).fill(2),
    ephemeralX25519PublicKey: new Uint8Array(32).fill(3),
    noncePrefix: new Uint8Array(8).fill(4),
    salt: new Uint8Array(32).fill(5),
    declaredChunkCount,
    chunkSize: 1_048_576,
    totalFileLength,
  };
}

function object(): EncryptedFileObject {
  const chunks: ChunkRecord[] = [
    {
      chunkIndex: 0,
      plaintextLength: 3,
      ciphertext: new Uint8Array(19).fill(6),
    },
  ];
  const manifest: EncryptedManifestRecord = {
    chunkIndex: 0xffff_ffff,
    plaintextLength: 100,
    ciphertext: new Uint8Array(116).fill(7),
  };
  const base = { header: header(), chunks, manifest };
  return { ...base, checksum: calculateEncryptedFileChecksum(base) };
}

describe("PPXF outer codec", () => {
  it("encodes the exact fixed 884-byte header", () => {
    expect(encodeFileHeader(header())).toHaveLength(884);
  });

  it("round-trips ordered records and the encrypted terminal manifest", () => {
    const expected = object();
    expect(
      parseEncryptedFileObject(encodeEncryptedFileObject(expected)),
    ).toEqual(expected);
  });

  it("matches the digest-locked canonical complete transport fixture", () => {
    const encoded = encodeEncryptedFileObject(object());
    expect(encoded).toHaveLength(fixture.encodedLength);
    expect(
      [...sha512(encoded)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
    ).toBe(fixture.encodedSha512);
    expect(parseEncryptedFileObject(encoded)).toEqual(object());
  });

  it("checks all encrypted bytes before returning an object", () => {
    const bytes = encodeEncryptedFileObject(object());
    bytes[900] = (bytes[900] as number) ^ 1;
    expect(() => parseEncryptedFileObject(bytes)).toThrow("checksum-mismatch");
  });

  it("rejects an oversized terminal manifest before copying ciphertext", () => {
    const manifestLength = 18_001;
    const ciphertextLength = manifestLength + 16;
    const payloadWriter = new StrictByteWriter(884 + 12 + ciphertextLength);
    payloadWriter.writeBytes(encodeFileHeader(header(0n, 0)));
    payloadWriter.writeUint32BE(0xffff_ffff);
    payloadWriter.writeUint32BE(manifestLength);
    payloadWriter.writeUint32BE(ciphertextLength);
    payloadWriter.writeBytes(new Uint8Array(ciphertextLength));
    const payload = payloadWriter.toBytes();
    const writer = new StrictByteWriter(payload.byteLength + 16);
    writer.writeBytes(payload);
    writer.writeBytes(checksum16(payload));

    expect(() => parseEncryptedFileObject(writer.toBytes())).toThrow(
      "oversize-before-allocation",
    );
  });
});
