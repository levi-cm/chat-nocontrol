import { sha512 } from "@noble/hashes/sha2.js";
import { zeroize } from "../crypto/zeroize";
import { StrictByteReader, StrictByteWriter } from "./bytes";
import { checksum16, equalBytes } from "./checksum";
import {
  encodeFileHeaderV2,
  parseFileHeaderV2,
  PPXF_V2_CHUNK_BYTES,
  PPXF_V2_FILE_MAX_BYTES,
  PPXF_V2_HEADER_BYTES,
  validateFileHeaderV2,
} from "./ppxf-header-v2";
import { PPXF_V2_MANIFEST_MAX_BYTES } from "./ppxf-manifest-v2";
import { PPXError } from "./types";
import type {
  EncryptedFileManifestRecordV2,
  EncryptedFileObjectV2,
  FileChunkRecordV2,
  FileHeaderV2,
} from "./types-v2";

const RECORD_PREFIX_BYTES = 12;
const TAG_BYTES = 16;
const CHECKSUM_BYTES = 16;
const MAX_DATA_CHUNKS = Number(
  PPXF_V2_FILE_MAX_BYTES / BigInt(PPXF_V2_CHUNK_BYTES),
);
export const PPXF_V2_ENCODED_MAX_BYTES =
  Number(PPXF_V2_FILE_MAX_BYTES) +
  MAX_DATA_CHUNKS * (RECORD_PREFIX_BYTES + TAG_BYTES) +
  PPXF_V2_HEADER_BYTES +
  RECORD_PREFIX_BYTES +
  PPXF_V2_MANIFEST_MAX_BYTES +
  TAG_BYTES +
  CHECKSUM_BYTES;

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((length, part) => length + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function expectedChunkLength(header: FileHeaderV2, index: number): number {
  const consumed = BigInt(index) * BigInt(PPXF_V2_CHUNK_BYTES);
  const remaining = header.totalFileLength - consumed;
  return Number(
    remaining > BigInt(PPXF_V2_CHUNK_BYTES)
      ? BigInt(PPXF_V2_CHUNK_BYTES)
      : remaining,
  );
}

function validateChunk(
  header: FileHeaderV2,
  chunk: FileChunkRecordV2,
  index: number,
): void {
  const expected = expectedChunkLength(header, index);
  if (
    chunk.chunkIndex !== index ||
    chunk.plaintextLength !== expected ||
    chunk.ciphertext.byteLength !== expected + TAG_BYTES
  ) {
    throw new PPXError("impossible-length");
  }
}

function validateManifest(manifest: EncryptedFileManifestRecordV2): void {
  if (manifest.plaintextLength > PPXF_V2_MANIFEST_MAX_BYTES) {
    throw new PPXError("oversize-before-allocation");
  }
  if (
    manifest.chunkIndex !== 0xffff_ffff ||
    !Number.isInteger(manifest.plaintextLength) ||
    manifest.plaintextLength < 1 ||
    manifest.ciphertext.byteLength !== manifest.plaintextLength + TAG_BYTES
  ) {
    throw new PPXError("impossible-length");
  }
}

function encodeRecord(
  record: FileChunkRecordV2 | EncryptedFileManifestRecordV2,
): Uint8Array {
  const writer = new StrictByteWriter(
    RECORD_PREFIX_BYTES + record.ciphertext.byteLength,
  );
  try {
    writer.writeUint32BE(record.chunkIndex);
    writer.writeUint32BE(record.plaintextLength);
    writer.writeUint32BE(record.ciphertext.byteLength);
    writer.writeBytes(record.ciphertext);
    return writer.toBytes();
  } finally {
    writer.destroy();
  }
}

function validateStructure(input: {
  header: FileHeaderV2;
  chunks: FileChunkRecordV2[];
  manifest: EncryptedFileManifestRecordV2;
}): void {
  validateFileHeaderV2(input.header);
  if (input.chunks.length !== input.header.declaredChunkCount) {
    throw new PPXError("impossible-length");
  }
  input.chunks.forEach((chunk, index) =>
    validateChunk(input.header, chunk, index),
  );
  validateManifest(input.manifest);
}

function encodeRecordPrefix(record: {
  chunkIndex: number;
  plaintextLength: number;
  ciphertext: Uint8Array;
}): Uint8Array {
  const writer = new StrictByteWriter(RECORD_PREFIX_BYTES);
  try {
    writer.writeUint32BE(record.chunkIndex);
    writer.writeUint32BE(record.plaintextLength);
    writer.writeUint32BE(record.ciphertext.byteLength);
    return writer.toBytes();
  } finally {
    writer.destroy();
  }
}

function encodePayload(input: {
  header: FileHeaderV2;
  chunks: FileChunkRecordV2[];
  manifest: EncryptedFileManifestRecordV2;
}): Uint8Array {
  validateStructure(input);
  const parts: Uint8Array[] = [];
  try {
    parts.push(encodeFileHeaderV2(input.header));
    for (const chunk of input.chunks) parts.push(encodeRecord(chunk));
    parts.push(encodeRecord(input.manifest));
    return concatBytes(...parts);
  } finally {
    for (const part of parts) zeroize(part);
  }
}

export function calculateEncryptedFileChecksumV2(input: {
  header: FileHeaderV2;
  chunks: FileChunkRecordV2[];
  manifest: EncryptedFileManifestRecordV2;
}): Uint8Array {
  validateStructure(input);
  const digest = sha512.create();
  const header = encodeFileHeaderV2(input.header);
  let fullDigest: Uint8Array | undefined;
  try {
    digest.update(header);
    for (const record of [...input.chunks, input.manifest]) {
      const prefix = encodeRecordPrefix(record);
      try {
        digest.update(prefix);
        digest.update(record.ciphertext);
      } finally {
        zeroize(prefix);
      }
    }
    fullDigest = digest.digest();
    return fullDigest.slice(0, CHECKSUM_BYTES);
  } finally {
    zeroize(header);
    if (fullDigest) zeroize(fullDigest);
  }
}

export function validateEncryptedFileObjectV2(
  object: EncryptedFileObjectV2,
): void {
  if (object.checksum.byteLength !== CHECKSUM_BYTES) {
    throw new PPXError("impossible-length");
  }
  const expected = calculateEncryptedFileChecksumV2(object);
  try {
    if (!equalBytes(expected, object.checksum)) {
      throw new PPXError("checksum-mismatch");
    }
  } finally {
    zeroize(expected);
  }
}

export function encodeEncryptedFileObjectV2(
  object: EncryptedFileObjectV2,
): Uint8Array {
  validateEncryptedFileObjectV2(object);
  const payload = encodePayload(object);
  try {
    return concatBytes(payload, object.checksum);
  } finally {
    zeroize(payload);
  }
}

function parseRecord(
  reader: StrictByteReader,
  checksumBytesRemaining: number,
  expectedIndex: number,
  expectedPlaintextLength?: number,
): FileChunkRecordV2 | EncryptedFileManifestRecordV2 {
  const chunkIndex = reader.readUint32BE();
  const plaintextLength = reader.readUint32BE();
  const ciphertextLength = reader.readUint32BE();
  if (chunkIndex !== expectedIndex) throw new PPXError("impossible-length");
  if (
    expectedPlaintextLength !== undefined &&
    plaintextLength !== expectedPlaintextLength
  ) {
    throw new PPXError("impossible-length");
  }
  if (
    expectedIndex === 0xffff_ffff &&
    plaintextLength > PPXF_V2_MANIFEST_MAX_BYTES
  ) {
    throw new PPXError("oversize-before-allocation");
  }
  if (
    plaintextLength < (expectedIndex === 0xffff_ffff ? 1 : 0) ||
    ciphertextLength !== plaintextLength + TAG_BYTES ||
    ciphertextLength > reader.remaining() - checksumBytesRemaining
  ) {
    throw new PPXError("impossible-length");
  }
  const ciphertext = reader.readBytes(ciphertextLength);
  return expectedIndex === 0xffff_ffff
    ? { chunkIndex: 0xffff_ffff, plaintextLength, ciphertext }
    : { chunkIndex, plaintextLength, ciphertext };
}

export function parseEncryptedFileObjectV2(
  bytes: Uint8Array,
): EncryptedFileObjectV2 {
  if (bytes.byteLength > PPXF_V2_ENCODED_MAX_BYTES) {
    throw new PPXError("oversize-before-allocation");
  }
  if (
    bytes.byteLength <
    PPXF_V2_HEADER_BYTES + RECORD_PREFIX_BYTES + 1 + TAG_BYTES + CHECKSUM_BYTES
  ) {
    throw new PPXError("impossible-length");
  }
  const checksumOffset = bytes.byteLength - CHECKSUM_BYTES;
  const checksum = bytes.slice(checksumOffset);
  const expected = checksum16(bytes.subarray(0, checksumOffset));
  try {
    if (!equalBytes(expected, checksum)) {
      throw new PPXError("checksum-mismatch");
    }
  } finally {
    zeroize(expected);
  }
  const reader = new StrictByteReader(bytes, PPXF_V2_ENCODED_MAX_BYTES);
  const header = parseFileHeaderV2(reader.readBytes(PPXF_V2_HEADER_BYTES));
  const chunks: FileChunkRecordV2[] = [];
  for (let index = 0; index < header.declaredChunkCount; index += 1) {
    const record = parseRecord(
      reader,
      CHECKSUM_BYTES,
      index,
      expectedChunkLength(header, index),
    );
    chunks.push(record);
  }
  const terminal = parseRecord(
    reader,
    CHECKSUM_BYTES,
    0xffff_ffff,
  ) as EncryptedFileManifestRecordV2;
  const parsedChecksum = reader.readBytes(CHECKSUM_BYTES);
  reader.requireEnd();
  const output = {
    header,
    chunks,
    manifest: terminal,
    checksum: parsedChecksum,
  };
  validateStructure(output);
  return output;
}
