import { sha512Digest } from "../crypto/noble-provider";
import { zeroize } from "../crypto/zeroize";
import { StrictByteReader, StrictByteWriter } from "./bytes";
import { equalBytes } from "./checksum";
import { PPXError } from "./types";
import {
  PPX_PQ_5_SUITE,
  PPX_V2_FORMAT_VERSION,
  type FileHeaderV2,
} from "./types-v2";

const MAGIC = new TextEncoder().encode("PPXF");
export const PPXF_V2_HEADER_BYTES = 1_651;
export const PPXF_V2_CHUNK_BYTES = 1_048_576 as const;
export const PPXF_V2_FILE_MAX_BYTES = 104_857_600n;

function requireLength(bytes: Uint8Array, length: number): void {
  if (bytes.byteLength !== length) throw new PPXError("impossible-length");
}

export function requiredFileChunkCountV2(fileLength: bigint): number {
  if (fileLength < 0n) throw new PPXError("impossible-length");
  if (fileLength > PPXF_V2_FILE_MAX_BYTES) {
    throw new PPXError("oversize-before-allocation");
  }
  if (fileLength === 0n) return 0;
  return Number(
    (fileLength + BigInt(PPXF_V2_CHUNK_BYTES) - 1n) /
      BigInt(PPXF_V2_CHUNK_BYTES),
  );
}

export function validateFileHeaderV2(header: FileHeaderV2): void {
  if (header.magic !== "PPXF") throw new PPXError("noncanonical-text");
  if (header.formatVersion !== PPX_V2_FORMAT_VERSION) {
    throw new PPXError("unknown-format-version");
  }
  if (header.suite !== PPX_PQ_5_SUITE) throw new PPXError("unknown-suite");
  if (header.flags !== 0) throw new PPXError("unknown-flags");
  requireLength(header.recipientId, 20);
  requireLength(header.mlKemCiphertext, 1568);
  requireLength(header.noncePrefix, 8);
  requireLength(header.salt, 32);
  if (header.chunkSize !== PPXF_V2_CHUNK_BYTES) {
    throw new PPXError("impossible-length");
  }
  if (
    !Number.isInteger(header.declaredChunkCount) ||
    header.declaredChunkCount !==
      requiredFileChunkCountV2(header.totalFileLength)
  ) {
    throw new PPXError("impossible-length");
  }
}

export function encodeFileHeaderV2(header: FileHeaderV2): Uint8Array {
  validateFileHeaderV2(header);
  const writer = new StrictByteWriter(PPXF_V2_HEADER_BYTES);
  try {
    writer.writeBytes(MAGIC);
    writer.writeUint8(header.formatVersion);
    writer.writeUint8(header.suite);
    writer.writeUint8(header.flags);
    writer.writeBytes(header.recipientId);
    writer.writeBytes(header.mlKemCiphertext);
    writer.writeBytes(header.noncePrefix);
    writer.writeBytes(header.salt);
    writer.writeUint32BE(header.declaredChunkCount);
    writer.writeUint32BE(header.chunkSize);
    writer.writeUint64BE(header.totalFileLength);
    const encoded = writer.toBytes();
    if (encoded.byteLength !== PPXF_V2_HEADER_BYTES) {
      zeroize(encoded);
      throw new PPXError("impossible-length");
    }
    return encoded;
  } finally {
    writer.destroy();
  }
}

export function parseFileHeaderV2(bytes: Uint8Array): FileHeaderV2 {
  if (bytes.byteLength !== PPXF_V2_HEADER_BYTES) {
    throw new PPXError("impossible-length");
  }
  const reader = new StrictByteReader(bytes, PPXF_V2_HEADER_BYTES);
  const magic = reader.readBytes(4);
  const formatVersion = reader.readUint8();
  const suite = reader.readUint8();
  const flags = reader.readUint8();
  if (!equalBytes(magic, MAGIC)) throw new PPXError("noncanonical-text");
  if (formatVersion !== PPX_V2_FORMAT_VERSION) {
    throw new PPXError("unknown-format-version");
  }
  if (suite !== PPX_PQ_5_SUITE) throw new PPXError("unknown-suite");
  if (flags !== 0) throw new PPXError("unknown-flags");
  const header: FileHeaderV2 = {
    magic: "PPXF",
    formatVersion: PPX_V2_FORMAT_VERSION,
    suite: PPX_PQ_5_SUITE,
    flags: 0,
    recipientId: reader.readBytes(20),
    mlKemCiphertext: reader.readBytes(1568),
    noncePrefix: reader.readBytes(8),
    salt: reader.readBytes(32),
    declaredChunkCount: reader.readUint32BE(),
    chunkSize: reader.readUint32BE() as 1_048_576,
    totalFileLength: reader.readUint64BE(),
  };
  reader.requireEnd();
  validateFileHeaderV2(header);
  return header;
}

export function hashFileHeaderV2(header: FileHeaderV2): Uint8Array {
  const encoded = encodeFileHeaderV2(header);
  try {
    return sha512Digest(encoded);
  } finally {
    zeroize(encoded);
  }
}
