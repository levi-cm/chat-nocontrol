import { StrictByteReader, StrictByteWriter } from "./bytes";
import { checksum16, equalBytes } from "./checksum";
import { PPXError, type EncryptedQrTextObject } from "./types";

const MAGIC = new TextEncoder().encode("PPXQ");
export const PPXQ_HEADER_SIZE = 853;
export const PPXQ_CHECKSUM_SIZE = 16;
export const PPXQ_MAXIMUM_OBJECT_SIZE =
  65_535 + PPXQ_HEADER_SIZE + PPXQ_CHECKSUM_SIZE;

export function encodeEncryptedQrTextHeader(
  object: Omit<EncryptedQrTextObject, "ciphertext" | "checksum">,
): Uint8Array {
  if (object.magic !== "PPXQ") throw new PPXError("noncanonical-text");
  if (object.formatVersion !== 1) throw new PPXError("unknown-format-version");
  if (object.suite !== 1) throw new PPXError("unknown-suite");
  if (object.flags !== 0 && object.flags !== 1)
    throw new PPXError("unknown-flags");
  if (
    object.mlKemCiphertext.byteLength !== 768 ||
    object.ephemeralX25519PublicKey.byteLength !== 32 ||
    object.salt.byteLength !== 32 ||
    object.nonce.byteLength !== 12 ||
    !Number.isSafeInteger(object.ciphertextLength) ||
    object.ciphertextLength < 16 ||
    object.ciphertextLength > 65_535
  ) {
    throw new PPXError("impossible-length");
  }
  const writer = new StrictByteWriter(PPXQ_HEADER_SIZE);
  writer.writeBytes(MAGIC);
  writer.writeUint8(1);
  writer.writeUint8(1);
  writer.writeUint8(object.flags);
  writer.writeBytes(object.mlKemCiphertext);
  writer.writeBytes(object.ephemeralX25519PublicKey);
  writer.writeBytes(object.salt);
  writer.writeBytes(object.nonce);
  writer.writeUint16BE(object.ciphertextLength);
  return writer.toBytes();
}

export function encodeEncryptedQrText(
  object: EncryptedQrTextObject,
): Uint8Array {
  if (object.ciphertext.byteLength !== object.ciphertextLength) {
    throw new PPXError("impossible-length");
  }
  const header = encodeEncryptedQrTextHeader(object);
  const payload = new Uint8Array(
    header.byteLength + object.ciphertext.byteLength,
  );
  payload.set(header);
  payload.set(object.ciphertext, header.byteLength);
  if (!equalBytes(checksum16(payload), object.checksum)) {
    throw new PPXError("checksum-mismatch");
  }
  const output = new Uint8Array(payload.byteLength + PPXQ_CHECKSUM_SIZE);
  output.set(payload);
  output.set(object.checksum, payload.byteLength);
  return output;
}

export function parseEncryptedQrText(bytes: Uint8Array): EncryptedQrTextObject {
  const reader = new StrictByteReader(bytes, PPXQ_MAXIMUM_OBJECT_SIZE);
  const magic = reader.readBytes(4);
  const formatVersion = reader.readUint8();
  const suite = reader.readUint8();
  const flags = reader.readUint8();
  const mlKemCiphertext = reader.readBytes(768);
  const ephemeralX25519PublicKey = reader.readBytes(32);
  const salt = reader.readBytes(32);
  const nonce = reader.readBytes(12);
  const ciphertextLength = reader.readUint16BE();
  if (
    ciphertextLength < 16 ||
    ciphertextLength !== reader.remaining() - PPXQ_CHECKSUM_SIZE ||
    bytes.byteLength !==
      PPXQ_HEADER_SIZE + ciphertextLength + PPXQ_CHECKSUM_SIZE
  ) {
    throw new PPXError("impossible-length");
  }
  if (!equalBytes(magic, MAGIC)) throw new PPXError("noncanonical-text");
  if (formatVersion !== 1) throw new PPXError("unknown-format-version");
  if (suite !== 1) throw new PPXError("unknown-suite");
  if (flags !== 0 && flags !== 1) throw new PPXError("unknown-flags");
  const ciphertext = reader.readBytes(ciphertextLength);
  const checksum = reader.readBytes(PPXQ_CHECKSUM_SIZE);
  reader.requireEnd();
  if (!equalBytes(checksum16(bytes.slice(0, -PPXQ_CHECKSUM_SIZE)), checksum)) {
    throw new PPXError("checksum-mismatch");
  }
  return {
    magic: "PPXQ",
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
