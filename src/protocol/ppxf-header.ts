import { sha512Digest } from "../crypto/noble-provider";
import { StrictByteReader, StrictByteWriter } from "./bytes";
import { equalBytes } from "./checksum";
import { PPXError, type FileHeader } from "./types";

const encoder = new TextEncoder();
const MAGIC = encoder.encode("PPXF");

export const PPXF_HEADER_BYTES = 884;
export const PPXF_CHUNK_BYTES = 1_048_576 as const;
export const PPXF_FILE_MAX_BYTES = 104_857_600n;

function requireLength(bytes: Uint8Array, length: number): void {
  if (bytes.byteLength !== length) throw new PPXError("impossible-length");
}

export function requiredFileChunkCount(fileLength: bigint): number {
  if (fileLength < 0n) throw new PPXError("impossible-length");
  if (fileLength > PPXF_FILE_MAX_BYTES) {
    throw new PPXError("oversize-before-allocation");
  }
  if (fileLength === 0n) return 0;
  return Number(
    (fileLength + BigInt(PPXF_CHUNK_BYTES) - 1n) / BigInt(PPXF_CHUNK_BYTES),
  );
}

export function validateFileHeader(header: FileHeader): void {
  if (header.magic !== "PPXF") throw new PPXError("noncanonical-text");
  if (header.formatVersion !== 1) {
    throw new PPXError("unknown-format-version");
  }
  if (header.suite !== 1) throw new PPXError("unknown-suite");
  if (header.flags !== 0) throw new PPXError("unknown-flags");
  requireLength(header.recipientId, 20);
  requireLength(header.mlKemCiphertext, 768);
  requireLength(header.ephemeralX25519PublicKey, 32);
  requireLength(header.noncePrefix, 8);
  requireLength(header.salt, 32);
  if (header.chunkSize !== PPXF_CHUNK_BYTES) {
    throw new PPXError("impossible-length");
  }
  const required = requiredFileChunkCount(header.totalFileLength);
  if (
    !Number.isInteger(header.declaredChunkCount) ||
    header.declaredChunkCount !== required
  ) {
    throw new PPXError("impossible-length");
  }
}

export function encodeFileHeader(header: FileHeader): Uint8Array {
  validateFileHeader(header);
  const writer = new StrictByteWriter(PPXF_HEADER_BYTES);
  writer.writeBytes(MAGIC);
  writer.writeUint8(header.formatVersion);
  writer.writeUint8(header.suite);
  writer.writeUint16BE(header.flags);
  writer.writeBytes(header.recipientId);
  writer.writeBytes(header.mlKemCiphertext);
  writer.writeBytes(header.ephemeralX25519PublicKey);
  writer.writeBytes(header.noncePrefix);
  writer.writeBytes(header.salt);
  writer.writeUint32BE(header.declaredChunkCount);
  writer.writeUint32BE(header.chunkSize);
  writer.writeUint64BE(header.totalFileLength);
  const encoded = writer.toBytes();
  if (encoded.byteLength !== PPXF_HEADER_BYTES) {
    throw new PPXError("impossible-length");
  }
  return encoded;
}

export function parseFileHeader(bytes: Uint8Array): FileHeader {
  const reader = new StrictByteReader(bytes, PPXF_HEADER_BYTES);
  if (bytes.byteLength !== PPXF_HEADER_BYTES) {
    throw new PPXError("impossible-length");
  }
  const magic = reader.readBytes(4);
  const formatVersion = reader.readUint8();
  const suite = reader.readUint8();
  const flags = reader.readUint16BE();
  const recipientId = reader.readBytes(20);
  const mlKemCiphertext = reader.readBytes(768);
  const ephemeralX25519PublicKey = reader.readBytes(32);
  const noncePrefix = reader.readBytes(8);
  const salt = reader.readBytes(32);
  const declaredChunkCount = reader.readUint32BE();
  const chunkSize = reader.readUint32BE();
  const totalFileLength = reader.readUint64BE();
  reader.requireEnd();
  const required = requiredFileChunkCount(totalFileLength);
  if (chunkSize !== PPXF_CHUNK_BYTES || declaredChunkCount !== required) {
    throw new PPXError("impossible-length");
  }
  if (!equalBytes(magic, MAGIC)) throw new PPXError("noncanonical-text");
  if (formatVersion !== 1) throw new PPXError("unknown-format-version");
  if (suite !== 1) throw new PPXError("unknown-suite");
  if (flags !== 0) throw new PPXError("unknown-flags");
  return {
    magic: "PPXF",
    formatVersion: 1,
    suite: 1,
    flags: 0,
    recipientId,
    mlKemCiphertext,
    ephemeralX25519PublicKey,
    noncePrefix,
    salt,
    declaredChunkCount,
    chunkSize: PPXF_CHUNK_BYTES,
    totalFileLength,
  };
}

export function hashFileHeader(header: FileHeader): Uint8Array {
  return sha512Digest(encodeFileHeader(header));
}
