import { signEd25519, verifyEd25519 } from "../crypto/noble-provider";
import { zeroize } from "../crypto/zeroize";
import { StrictByteReader, StrictByteWriter } from "./bytes";
import { equalBytes } from "./checksum";
import { encodePublicContact, parsePublicContact } from "./ppxc";
import { normalizeCaption, normalizeFilename, normalizeMimeHint } from "./text";
import { PPXError, type FileManifest } from "./types";
import { PPXF_FILE_MAX_BYTES, requiredFileChunkCount } from "./ppxf-header";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const MAGIC = encoder.encode("PPXF");
const SIGNATURE_DOMAIN = encoder.encode("PPX/FILE/V1/MANIFEST-SIGNATURE");

export const PPXF_MANIFEST_MAX_BYTES = 18_000;

function requireRange(bytes: Uint8Array, offset: number, length: number): void {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset + length > bytes.byteLength
  ) {
    throw new PPXError("impossible-length");
  }
}

function readUint16At(bytes: Uint8Array, offset: number): number {
  requireRange(bytes, offset, 2);
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(
    0,
    false,
  );
}

function readUint32At(bytes: Uint8Array, offset: number): number {
  requireRange(bytes, offset, 4);
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(
    0,
    false,
  );
}

function readUint64At(bytes: Uint8Array, offset: number): bigint {
  requireRange(bytes, offset, 8);
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getBigUint64(
    0,
    false,
  );
}

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

function canonicalText(
  bytes: Uint8Array,
  normalize: (value: string) => string,
): string {
  let value: string;
  try {
    value = decoder.decode(bytes);
  } catch {
    throw new PPXError("noncanonical-text");
  }
  if (normalize(value) !== value) throw new PPXError("noncanonical-text");
  return value;
}

function encodeUnsignedManifest(
  manifest: Omit<FileManifest, "signature">,
): Uint8Array {
  if (manifest.magic !== "PPXF") throw new PPXError("noncanonical-text");
  if (manifest.formatVersion !== 1) {
    throw new PPXError("unknown-format-version");
  }
  if (manifest.suite !== 1) throw new PPXError("unknown-suite");
  if (manifest.chunkIndex !== 0xffff_ffff) {
    throw new PPXError("impossible-length");
  }
  if (manifest.recipientId.byteLength !== 20) {
    throw new PPXError("impossible-length");
  }
  if (manifest.fullPlaintextDigest.byteLength !== 64) {
    throw new PPXError("impossible-length");
  }
  if (manifest.fileLength < 0n || manifest.fileLength > PPXF_FILE_MAX_BYTES) {
    throw new PPXError("oversize-before-allocation");
  }
  if (manifest.chunkCount !== requiredFileChunkCount(manifest.fileLength)) {
    throw new PPXError("impossible-length");
  }
  const sender = encodePublicContact(manifest.senderContact);
  const filename = encoder.encode(normalizeFilename(manifest.filename));
  const mimeHint = encoder.encode(normalizeMimeHint(manifest.mimeHint));
  const caption = encoder.encode(normalizeCaption(manifest.caption));
  const length =
    4 +
    1 +
    1 +
    4 +
    2 +
    sender.byteLength +
    20 +
    2 +
    filename.byteLength +
    1 +
    mimeHint.byteLength +
    4 +
    caption.byteLength +
    8 +
    4 +
    64;
  if (length + 64 > PPXF_MANIFEST_MAX_BYTES) {
    throw new PPXError("oversize-before-allocation");
  }
  const writer = new StrictByteWriter(length);
  writer.writeBytes(MAGIC);
  writer.writeUint8(1);
  writer.writeUint8(1);
  writer.writeUint32BE(0xffff_ffff);
  writer.writeUint16BE(sender.byteLength);
  writer.writeBytes(sender);
  writer.writeBytes(manifest.recipientId);
  writer.writeUint16BE(filename.byteLength);
  writer.writeBytes(filename);
  writer.writeUint8(mimeHint.byteLength);
  writer.writeBytes(mimeHint);
  writer.writeUint32BE(caption.byteLength);
  writer.writeBytes(caption);
  writer.writeUint64BE(manifest.fileLength);
  writer.writeUint32BE(manifest.chunkCount);
  writer.writeBytes(manifest.fullPlaintextDigest);
  return writer.toBytes();
}

export function createFileManifest(input: {
  senderContact: FileManifest["senderContact"];
  signingSecretKey: Uint8Array;
  recipientId: Uint8Array;
  filename: string;
  mimeHint: string;
  caption: string;
  fileLength: bigint;
  chunkCount: number;
  fullPlaintextDigest: Uint8Array;
}): FileManifest {
  const unsigned: Omit<FileManifest, "signature"> = {
    magic: "PPXF",
    formatVersion: 1,
    suite: 1,
    chunkIndex: 0xffff_ffff,
    senderContact: input.senderContact,
    recipientId: Uint8Array.from(input.recipientId),
    filename: normalizeFilename(input.filename),
    mimeHint: normalizeMimeHint(input.mimeHint),
    caption: normalizeCaption(input.caption),
    fileLength: input.fileLength,
    chunkCount: input.chunkCount,
    fullPlaintextDigest: Uint8Array.from(input.fullPlaintextDigest),
  };
  const bytes = encodeUnsignedManifest(unsigned);
  const signingInput = concatBytes(SIGNATURE_DOMAIN, bytes);
  try {
    return {
      ...unsigned,
      signature: signEd25519(signingInput, input.signingSecretKey),
    };
  } catch (error) {
    zeroize(unsigned.fullPlaintextDigest, unsigned.recipientId);
    throw error;
  } finally {
    zeroize(bytes, signingInput);
  }
}

export function encodeFileManifest(manifest: FileManifest): Uint8Array {
  if (manifest.signature.byteLength !== 64) {
    throw new PPXError("impossible-length");
  }
  const unsigned = encodeUnsignedManifest(manifest);
  const signingInput = concatBytes(SIGNATURE_DOMAIN, unsigned);
  try {
    if (
      !verifyEd25519(
        manifest.signature,
        signingInput,
        manifest.senderContact.signingPublicKey,
      )
    ) {
      throw new PPXError("invalid-signature");
    }
    return concatBytes(unsigned, manifest.signature);
  } finally {
    zeroize(unsigned, signingInput);
  }
}

export function parseFileManifest(bytes: Uint8Array): FileManifest {
  const reader = new StrictByteReader(bytes, PPXF_MANIFEST_MAX_BYTES);
  requireRange(bytes, 0, 12);
  const formatVersion = bytes[4] as number;
  const suite = bytes[5] as number;
  const chunkIndex = readUint32At(bytes, 6);
  const senderLength = readUint16At(bytes, 10);
  if (senderLength < 961 || senderLength > 1008) {
    throw new PPXError("impossible-length");
  }
  let offset = 12 + senderLength;
  requireRange(bytes, offset, 22);
  offset += 20;
  const filenameLength = readUint16At(bytes, offset);
  offset += 2;
  if (filenameLength < 1 || filenameLength > 255) {
    throw new PPXError("impossible-length");
  }
  requireRange(bytes, offset, filenameLength + 1);
  offset += filenameLength;
  const mimeLength = bytes[offset] as number;
  offset += 1;
  if (mimeLength > 127) throw new PPXError("impossible-length");
  requireRange(bytes, offset, mimeLength + 4);
  offset += mimeLength;
  const captionLength = readUint32At(bytes, offset);
  offset += 4;
  if (captionLength > 16_384) throw new PPXError("impossible-length");
  requireRange(bytes, offset, captionLength + 8 + 4 + 64 + 64);
  offset += captionLength;
  const fileLength = readUint64At(bytes, offset);
  offset += 8;
  const chunkCount = readUint32At(bytes, offset);
  offset += 4 + 64 + 64;
  if (offset !== bytes.byteLength) {
    throw new PPXError("impossible-length");
  }
  const requiredChunks = requiredFileChunkCount(fileLength);
  if (chunkCount !== requiredChunks) throw new PPXError("impossible-length");
  if (!equalBytes(bytes.subarray(0, 4), MAGIC)) {
    throw new PPXError("noncanonical-text");
  }
  if (formatVersion !== 1) throw new PPXError("unknown-format-version");
  if (suite !== 1) throw new PPXError("unknown-suite");
  if (chunkIndex !== 0xffff_ffff) throw new PPXError("impossible-length");

  reader.readBytes(4);
  reader.readUint8();
  reader.readUint8();
  reader.readUint32BE();
  reader.readUint16BE();
  const senderContact = parsePublicContact(reader.readBytes(senderLength));
  const recipientId = reader.readBytes(20);
  reader.readUint16BE();
  const filename = canonicalText(
    reader.readBytes(filenameLength),
    normalizeFilename,
  );
  reader.readUint8();
  const mimeHint = canonicalText(
    reader.readBytes(mimeLength),
    normalizeMimeHint,
  );
  reader.readUint32BE();
  const caption = canonicalText(
    reader.readBytes(captionLength),
    normalizeCaption,
  );
  reader.readUint64BE();
  reader.readUint32BE();
  const fullPlaintextDigest = reader.readBytes(64);
  const signatureOffset = bytes.byteLength - 64;
  const signature = reader.readBytes(64);
  reader.requireEnd();
  const unsigned = bytes.slice(0, signatureOffset);
  const signingInput = concatBytes(SIGNATURE_DOMAIN, unsigned);
  let verified = false;
  try {
    verified = verifyEd25519(
      signature,
      signingInput,
      senderContact.signingPublicKey,
    );
  } finally {
    zeroize(unsigned, signingInput);
    if (!verified) zeroize(fullPlaintextDigest, signature);
  }
  if (!verified) throw new PPXError("invalid-signature");
  return {
    magic: "PPXF",
    formatVersion: 1,
    suite: 1,
    chunkIndex: 0xffff_ffff,
    senderContact,
    recipientId,
    filename,
    mimeHint,
    caption,
    fileLength,
    chunkCount,
    fullPlaintextDigest,
    signature,
  };
}
