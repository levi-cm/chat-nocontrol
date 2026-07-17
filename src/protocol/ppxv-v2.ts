import { StrictByteReader, StrictByteWriter } from "./bytes";
import { checksum16, equalBytes } from "./checksum";
import { PPXError } from "./types";
import {
  PPX_PQ_5_SUITE,
  PPX_V2_FORMAT_VERSION,
  type LockedVaultObjectV2,
} from "./types-v2";

const MAGIC = new TextEncoder().encode("PPXV");
const HEADER_SIZE = 56;
export const PPXV_V2_MINIMUM_CIPHERTEXT_SIZE = 58;
export const PPXV_V2_MAXIMUM_CIPHERTEXT_SIZE = 105;
export const PPXV_V2_MAXIMUM_SIZE = 177;
export const PPXV_V2_MAXIMUM_BASE45_CHARS = 266;

export function encodeLockedVaultHeaderV2(
  vault: Omit<LockedVaultObjectV2, "ciphertext" | "checksum">,
): Uint8Array {
  if (vault.magic !== "PPXV") throw new PPXError("noncanonical-text");
  if (vault.formatVersion !== PPX_V2_FORMAT_VERSION) {
    throw new PPXError("unknown-format-version");
  }
  if (vault.suite !== PPX_PQ_5_SUITE) throw new PPXError("unknown-suite");
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
    vault.ciphertextLength < PPXV_V2_MINIMUM_CIPHERTEXT_SIZE ||
    vault.ciphertextLength > PPXV_V2_MAXIMUM_CIPHERTEXT_SIZE
  ) {
    throw new PPXError("impossible-length");
  }
  const writer = new StrictByteWriter(HEADER_SIZE);
  try {
    writer.writeBytes(MAGIC);
    writer.writeUint8(PPX_V2_FORMAT_VERSION);
    writer.writeUint8(PPX_PQ_5_SUITE);
    writer.writeUint8(1);
    writer.writeUint8(1);
    writer.writeUint64BE(65_536n);
    writer.writeUint32BE(8);
    writer.writeUint32BE(2);
    writer.writeBytes(vault.salt);
    writer.writeBytes(vault.nonce);
    writer.writeUint32BE(vault.ciphertextLength);
    return writer.toBytes();
  } finally {
    writer.destroy();
  }
}

export function encodeLockedVaultV2(vault: LockedVaultObjectV2): Uint8Array {
  if (vault.ciphertext.byteLength !== vault.ciphertextLength) {
    throw new PPXError("impossible-length");
  }
  const header = encodeLockedVaultHeaderV2(vault);
  const payloadWriter = new StrictByteWriter(
    HEADER_SIZE + vault.ciphertextLength,
  );
  const outputWriter = new StrictByteWriter(
    HEADER_SIZE + vault.ciphertextLength + 16,
  );
  try {
    payloadWriter.writeBytes(header);
    payloadWriter.writeBytes(vault.ciphertext);
    const payload = payloadWriter.toBytes();
    try {
      if (!equalBytes(checksum16(payload), vault.checksum)) {
        throw new PPXError("checksum-mismatch");
      }
      outputWriter.writeBytes(payload);
      outputWriter.writeBytes(vault.checksum);
      return outputWriter.toBytes();
    } finally {
      payload.fill(0);
    }
  } finally {
    header.fill(0);
    payloadWriter.destroy();
    outputWriter.destroy();
  }
}

export function parseLockedVaultV2(bytes: Uint8Array): LockedVaultObjectV2 {
  const reader = new StrictByteReader(bytes, PPXV_V2_MAXIMUM_SIZE);
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
    ciphertextLength < PPXV_V2_MINIMUM_CIPHERTEXT_SIZE ||
    ciphertextLength > PPXV_V2_MAXIMUM_CIPHERTEXT_SIZE ||
    ciphertextLength !== reader.remaining() - 16 ||
    bytes.byteLength !== HEADER_SIZE + ciphertextLength + 16
  ) {
    throw new PPXError("impossible-length");
  }
  if (!equalBytes(magic, MAGIC)) throw new PPXError("noncanonical-text");
  if (formatVersion !== PPX_V2_FORMAT_VERSION) {
    throw new PPXError("unknown-format-version");
  }
  if (suite !== PPX_PQ_5_SUITE) throw new PPXError("unknown-suite");
  if (flags !== 1) throw new PPXError("unknown-flags");
  if (kdfId !== 1 || scryptN !== 65_536n || scryptR !== 8 || scryptP !== 2) {
    throw new PPXError("noncanonical-text");
  }
  const ciphertext = reader.readBytes(ciphertextLength);
  const checksum = reader.readBytes(16);
  reader.requireEnd();
  if (!equalBytes(checksum16(bytes.subarray(0, -16)), checksum)) {
    throw new PPXError("checksum-mismatch");
  }
  return {
    magic: "PPXV",
    formatVersion: PPX_V2_FORMAT_VERSION,
    suite: PPX_PQ_5_SUITE,
    flags: 1,
    kdfId: 1,
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
