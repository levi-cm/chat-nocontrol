import { StrictByteReader, StrictByteWriter } from "./bytes";
import { checksum16, equalBytes } from "./checksum";
import {
  encodeFileHeader,
  parseFileHeader,
  PPXF_CHUNK_BYTES,
  PPXF_FILE_MAX_BYTES,
  PPXF_HEADER_BYTES,
  validateFileHeader,
} from "./ppxf-header";
import { PPXF_MANIFEST_MAX_BYTES } from "./ppxf-manifest";
import {
  PPXError,
  type ChunkRecord,
  type EncryptedFileObject,
  type EncryptedManifestRecord,
  type FileHeader,
} from "./types";

const MAX_DATA_CHUNKS = Number(PPXF_FILE_MAX_BYTES / BigInt(PPXF_CHUNK_BYTES));
export const PPXF_ENCODED_MAX_BYTES =
  Number(PPXF_FILE_MAX_BYTES) +
  MAX_DATA_CHUNKS * (12 + 16) +
  PPXF_HEADER_BYTES +
  12 +
  PPXF_MANIFEST_MAX_BYTES +
  16 +
  16;

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function expectedChunkLength(header: FileHeader, index: number): number {
  const consumed = BigInt(index) * BigInt(PPXF_CHUNK_BYTES);
  const remaining = header.totalFileLength - consumed;
  return Number(
    remaining > BigInt(PPXF_CHUNK_BYTES) ? BigInt(PPXF_CHUNK_BYTES) : remaining,
  );
}

function validateChunk(
  header: FileHeader,
  chunk: ChunkRecord,
  index: number,
): void {
  const expected = expectedChunkLength(header, index);
  if (
    chunk.chunkIndex !== index ||
    chunk.plaintextLength !== expected ||
    chunk.ciphertext.byteLength !== expected + 16
  ) {
    throw new PPXError("impossible-length");
  }
}

function validateManifest(manifest: EncryptedManifestRecord): void {
  if (manifest.plaintextLength > PPXF_MANIFEST_MAX_BYTES) {
    throw new PPXError("oversize-before-allocation");
  }
  if (
    manifest.chunkIndex !== 0xffff_ffff ||
    !Number.isInteger(manifest.plaintextLength) ||
    manifest.plaintextLength < 1 ||
    manifest.ciphertext.byteLength !== manifest.plaintextLength + 16
  ) {
    throw new PPXError("impossible-length");
  }
}

function encodeRecord(
  record: ChunkRecord | EncryptedManifestRecord,
): Uint8Array {
  const writer = new StrictByteWriter(12 + record.ciphertext.byteLength);
  writer.writeUint32BE(record.chunkIndex);
  writer.writeUint32BE(record.plaintextLength);
  writer.writeUint32BE(record.ciphertext.byteLength);
  writer.writeBytes(record.ciphertext);
  return writer.toBytes();
}

function validateStructure(input: {
  header: FileHeader;
  chunks: ChunkRecord[];
  manifest: EncryptedManifestRecord;
}): void {
  validateFileHeader(input.header);
  if (input.chunks.length !== input.header.declaredChunkCount) {
    throw new PPXError("impossible-length");
  }
  for (let index = 0; index < input.chunks.length; index += 1) {
    validateChunk(input.header, input.chunks[index] as ChunkRecord, index);
  }
  validateManifest(input.manifest);
}

function encodePayload(input: {
  header: FileHeader;
  chunks: ChunkRecord[];
  manifest: EncryptedManifestRecord;
}): Uint8Array {
  validateStructure(input);
  return concatBytes(
    encodeFileHeader(input.header),
    ...input.chunks.map(encodeRecord),
    encodeRecord(input.manifest),
  );
}

export function calculateEncryptedFileChecksum(input: {
  header: FileHeader;
  chunks: ChunkRecord[];
  manifest: EncryptedManifestRecord;
}): Uint8Array {
  return checksum16(encodePayload(input));
}

export function encodeEncryptedFileObject(
  object: EncryptedFileObject,
): Uint8Array {
  if (object.checksum.byteLength !== 16) {
    throw new PPXError("impossible-length");
  }
  const payload = encodePayload(object);
  if (!equalBytes(checksum16(payload), object.checksum)) {
    throw new PPXError("checksum-mismatch");
  }
  return concatBytes(payload, object.checksum);
}

function parseRecord(
  reader: StrictByteReader,
  constraints: {
    expectedChunkIndex: number;
    expectedPlaintextLength?: number;
    maximumPlaintextLength?: number;
  },
): ChunkRecord | EncryptedManifestRecord {
  const chunkIndex = reader.readUint32BE();
  const plaintextLength = reader.readUint32BE();
  const ciphertextLength = reader.readUint32BE();
  if (chunkIndex !== constraints.expectedChunkIndex) {
    throw new PPXError("impossible-length");
  }
  if (
    constraints.maximumPlaintextLength !== undefined &&
    plaintextLength > constraints.maximumPlaintextLength
  ) {
    throw new PPXError("oversize-before-allocation");
  }
  if (
    constraints.expectedPlaintextLength !== undefined &&
    plaintextLength !== constraints.expectedPlaintextLength
  ) {
    throw new PPXError("impossible-length");
  }
  if (ciphertextLength !== plaintextLength + 16) {
    throw new PPXError("impossible-length");
  }
  if (ciphertextLength > reader.remaining() - 16) {
    throw new PPXError("impossible-length");
  }
  const ciphertext = reader.readBytes(ciphertextLength);
  return chunkIndex === 0xffff_ffff
    ? { chunkIndex, plaintextLength, ciphertext }
    : { chunkIndex, plaintextLength, ciphertext };
}

export function parseEncryptedFileObject(
  bytes: Uint8Array,
): EncryptedFileObject {
  const reader = new StrictByteReader(bytes, PPXF_ENCODED_MAX_BYTES);
  if (bytes.byteLength < PPXF_HEADER_BYTES + 12 + 17 + 16) {
    throw new PPXError("impossible-length");
  }
  const checksumOffset = bytes.byteLength - 16;
  const header = parseFileHeader(reader.readBytes(PPXF_HEADER_BYTES));
  const chunks: ChunkRecord[] = [];
  for (let index = 0; index < header.declaredChunkCount; index += 1) {
    const record = parseRecord(reader, {
      expectedChunkIndex: index,
      expectedPlaintextLength: expectedChunkLength(header, index),
    });
    validateChunk(header, record, index);
    chunks.push(record);
  }
  const terminal = parseRecord(reader, {
    expectedChunkIndex: 0xffff_ffff,
    maximumPlaintextLength: PPXF_MANIFEST_MAX_BYTES,
  });
  const manifest: EncryptedManifestRecord = {
    chunkIndex: 0xffff_ffff,
    plaintextLength: terminal.plaintextLength,
    ciphertext: terminal.ciphertext,
  };
  validateManifest(manifest);
  const checksum = reader.readBytes(16);
  reader.requireEnd();
  if (!equalBytes(checksum16(bytes.subarray(0, checksumOffset)), checksum)) {
    throw new PPXError("checksum-mismatch");
  }
  return { header, chunks, manifest, checksum };
}
