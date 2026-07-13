import { StrictByteReader, StrictByteWriter } from "./bytes";
import { checksum16, equalBytes } from "./checksum";
import { PPXError, type LockedVaultObject } from "./types";

const encoder = new TextEncoder();
const MAGIC = encoder.encode("PPXV");
const HEADER_SIZE = 56;
export const PPXV_MINIMUM_CIPHERTEXT_SIZE = 58;
export const PPXV_MAXIMUM_CIPHERTEXT_SIZE = 105;
export const PPXV_MAXIMUM_SIZE = 177;
export const PPXV_MAXIMUM_BASE45_CHARS = 266;

export function encodeLockedVaultHeader(
  vault: Omit<LockedVaultObject, "ciphertext" | "checksum">,
): Uint8Array {
  if (vault.magic !== "PPXV") throw new PPXError("noncanonical-text");
  if (vault.formatVersion !== 1) throw new PPXError("unknown-format-version");
  if (vault.suite !== 1) throw new PPXError("unknown-suite");
  if (vault.flags !== 1) throw new PPXError("unknown-flags");
  if (
    vault.kdfId !== 1 ||
    vault.scryptN !== 65_536 ||
    vault.scryptR !== 8 ||
    vault.scryptP !== 2
  ) {
    throw new PPXError("noncanonical-text");
  }
  if (
    vault.salt.byteLength !== 16 ||
    vault.nonce.byteLength !== 12 ||
    !Number.isSafeInteger(vault.ciphertextLength) ||
    vault.ciphertextLength < PPXV_MINIMUM_CIPHERTEXT_SIZE ||
    vault.ciphertextLength > PPXV_MAXIMUM_CIPHERTEXT_SIZE
  ) {
    throw new PPXError("impossible-length");
  }
  const writer = new StrictByteWriter(HEADER_SIZE);
  writer.writeBytes(MAGIC);
  writer.writeUint8(1);
  writer.writeUint8(1);
  writer.writeUint8(1);
  writer.writeUint8(1);
  writer.writeUint64BE(65_536n);
  writer.writeUint32BE(8);
  writer.writeUint32BE(2);
  writer.writeBytes(vault.salt);
  writer.writeBytes(vault.nonce);
  writer.writeUint32BE(vault.ciphertextLength);
  return writer.toBytes();
}

export function encodeLockedVault(vault: LockedVaultObject): Uint8Array {
  if (vault.ciphertext.byteLength !== vault.ciphertextLength) {
    throw new PPXError("impossible-length");
  }
  const header = encodeLockedVaultHeader(vault);
  const writer = new StrictByteWriter(
    HEADER_SIZE + vault.ciphertextLength + 16,
  );
  writer.writeBytes(header);
  writer.writeBytes(vault.ciphertext);
  const payload = writer.toBytes();
  const expectedChecksum = checksum16(payload);
  if (!equalBytes(expectedChecksum, vault.checksum)) {
    throw new PPXError("checksum-mismatch");
  }
  writer.writeBytes(vault.checksum);
  return writer.toBytes();
}

export function parseLockedVault(bytes: Uint8Array): LockedVaultObject {
  const reader = new StrictByteReader(bytes, PPXV_MAXIMUM_SIZE);
  const magic = reader.readBytes(4);
  const formatVersion = reader.readUint8();
  const suite = reader.readUint8();
  const flags = reader.readUint8();
  const kdfId = reader.readUint8();
  const scryptN = reader.readUint64BE();
  const scryptR = reader.readUint32BE();
  const scryptP = reader.readUint32BE();
  const salt = reader.readBytes(16);
  const nonce = reader.readBytes(12);
  const ciphertextLength = reader.readUint32BE();
  if (
    ciphertextLength < PPXV_MINIMUM_CIPHERTEXT_SIZE ||
    ciphertextLength > PPXV_MAXIMUM_CIPHERTEXT_SIZE ||
    ciphertextLength !== reader.remaining() - 16 ||
    bytes.byteLength !== HEADER_SIZE + ciphertextLength + 16
  ) {
    throw new PPXError("impossible-length");
  }
  if (!equalBytes(magic, MAGIC)) throw new PPXError("noncanonical-text");
  if (formatVersion !== 1) throw new PPXError("unknown-format-version");
  if (suite !== 1) throw new PPXError("unknown-suite");
  if (flags !== 1) throw new PPXError("unknown-flags");
  if (kdfId !== 1 || scryptN !== 65_536n || scryptR !== 8 || scryptP !== 2) {
    throw new PPXError("noncanonical-text");
  }
  const ciphertext = reader.readBytes(ciphertextLength);
  const checksum = reader.readBytes(16);
  reader.requireEnd();
  if (!equalBytes(checksum16(bytes.slice(0, -16)), checksum)) {
    throw new PPXError("checksum-mismatch");
  }
  return {
    magic: "PPXV",
    formatVersion: 1,
    suite: 1,
    flags,
    kdfId,
    scryptN: 65_536,
    scryptR: 8,
    scryptP: 2,
    salt,
    nonce,
    ciphertextLength,
    ciphertext,
    checksum,
  };
}
