import { StrictByteReader, StrictByteWriter } from "./bytes";
import { checksum16, equalBytes } from "./checksum";
import { PPXError, type EncryptedTextObject } from "./types";

const encoder = new TextEncoder();
const MAGIC = encoder.encode("PPXT");
export const PPXT_HEADER_SIZE = 855;
export const PPXT_MAXIMUM_OBJECT_SIZE = 300_000;

export function encodeEncryptedTextHeader(
  object: Omit<EncryptedTextObject, "ciphertext" | "checksum">,
): Uint8Array {
  if (object.magic !== "PPXT") throw new PPXError("noncanonical-text");
  if (object.formatVersion !== 1) throw new PPXError("unknown-format-version");
  if (object.suite !== 1) throw new PPXError("unknown-suite");
  if (object.flags !== 0) throw new PPXError("unknown-flags");
  if (
    object.mlKemCiphertext.byteLength !== 768 ||
    object.ephemeralX25519PublicKey.byteLength !== 32 ||
    object.salt.byteLength !== 32 ||
    object.nonce.byteLength !== 12 ||
    !Number.isSafeInteger(object.ciphertextLength) ||
    object.ciphertextLength < 16 ||
    object.ciphertextLength > PPXT_MAXIMUM_OBJECT_SIZE - PPXT_HEADER_SIZE - 16
  ) {
    throw new PPXError("impossible-length");
  }
  const writer = new StrictByteWriter(PPXT_HEADER_SIZE);
  writer.writeBytes(MAGIC);
  writer.writeUint8(1);
  writer.writeUint8(1);
  writer.writeUint8(0);
  writer.writeBytes(object.mlKemCiphertext);
  writer.writeBytes(object.ephemeralX25519PublicKey);
  writer.writeBytes(object.salt);
  writer.writeBytes(object.nonce);
  writer.writeUint32BE(object.ciphertextLength);
  return writer.toBytes();
}

export function encodeEncryptedTextOuter(
  object: EncryptedTextObject,
): Uint8Array {
  if (object.ciphertext.byteLength !== object.ciphertextLength) {
    throw new PPXError("impossible-length");
  }
  const header = encodeEncryptedTextHeader(object);
  const payload = new Uint8Array(
    header.byteLength + object.ciphertext.byteLength,
  );
  payload.set(header);
  payload.set(object.ciphertext, header.byteLength);
  if (!equalBytes(checksum16(payload), object.checksum)) {
    throw new PPXError("checksum-mismatch");
  }
  const output = new Uint8Array(payload.byteLength + 16);
  output.set(payload);
  output.set(object.checksum, payload.byteLength);
  return output;
}

export function parseEncryptedTextOuter(
  bytes: Uint8Array,
): EncryptedTextObject {
  const reader = new StrictByteReader(bytes, PPXT_MAXIMUM_OBJECT_SIZE);
  const magic = reader.readBytes(4);
  const formatVersion = reader.readUint8();
  const suite = reader.readUint8();
  const flags = reader.readUint8();
  const mlKemCiphertext = reader.readBytes(768);
  const ephemeralX25519PublicKey = reader.readBytes(32);
  const salt = reader.readBytes(32);
  const nonce = reader.readBytes(12);
  const ciphertextLength = reader.readUint32BE();
  if (
    ciphertextLength < 16 ||
    ciphertextLength > PPXT_MAXIMUM_OBJECT_SIZE - PPXT_HEADER_SIZE - 16 ||
    ciphertextLength !== reader.remaining() - 16 ||
    bytes.byteLength !== PPXT_HEADER_SIZE + ciphertextLength + 16
  ) {
    throw new PPXError("impossible-length");
  }
  if (!equalBytes(magic, MAGIC)) throw new PPXError("noncanonical-text");
  if (formatVersion !== 1) throw new PPXError("unknown-format-version");
  if (suite !== 1) throw new PPXError("unknown-suite");
  if (flags !== 0) throw new PPXError("unknown-flags");
  const ciphertext = reader.readBytes(ciphertextLength);
  const checksum = reader.readBytes(16);
  reader.requireEnd();
  if (!equalBytes(checksum16(bytes.slice(0, -16)), checksum)) {
    throw new PPXError("checksum-mismatch");
  }
  return {
    magic: "PPXT",
    formatVersion: 1,
    suite: 1,
    flags,
    mlKemCiphertext,
    ephemeralX25519PublicKey,
    salt,
    nonce,
    ciphertextLength,
    ciphertext,
    checksum,
  };
}
