import { StrictByteReader, StrictByteWriter } from "./bytes";
import { checksum16, equalBytes } from "./checksum";
import { normalizePseudonym } from "./text";
import { PPXError, type RecoveryObject } from "./types";
import { zeroize } from "../crypto/zeroize";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const MAGIC = encoder.encode("PPXR");
export const PPXR_MAXIMUM_SIZE = 112;
export const PPXR_MAXIMUM_BASE45_CHARS = 168;

export function encodeRecoveryObject(object: RecoveryObject): Uint8Array {
  if (object.magic !== "PPXR") throw new PPXError("noncanonical-text");
  if (object.formatVersion !== 1) throw new PPXError("unknown-format-version");
  if (object.suite !== 1) throw new PPXError("unknown-suite");
  if (object.flags !== 0) throw new PPXError("unknown-flags");
  if (object.masterEntropy.byteLength !== 32) {
    throw new PPXError("impossible-length");
  }
  const pseudonym = normalizePseudonym(object.pseudonym);
  const pseudonymBytes = encoder.encode(pseudonym);
  const writer = new StrictByteWriter(64 + pseudonymBytes.byteLength);
  writer.writeBytes(MAGIC);
  writer.writeUint8(1);
  writer.writeUint8(1);
  writer.writeUint8(0);
  writer.writeUint8(pseudonymBytes.byteLength);
  writer.writeUint64BE(object.creationTime);
  writer.writeBytes(object.masterEntropy);
  writer.writeBytes(pseudonymBytes);
  const payload = writer.toBytes();
  writer.writeBytes(checksum16(payload));
  return writer.toBytes();
}

export function parseRecoveryObject(bytes: Uint8Array): RecoveryObject {
  const reader = new StrictByteReader(bytes, PPXR_MAXIMUM_SIZE);
  const magic = reader.readBytes(4);
  const formatVersion = reader.readUint8();
  const suite = reader.readUint8();
  const flags = reader.readUint8();
  const pseudonymLength = reader.readUint8();
  if (
    pseudonymLength < 1 ||
    pseudonymLength > 48 ||
    bytes.byteLength !== 64 + pseudonymLength
  ) {
    throw new PPXError("impossible-length");
  }
  if (!equalBytes(magic, MAGIC)) throw new PPXError("noncanonical-text");
  if (formatVersion !== 1) throw new PPXError("unknown-format-version");
  if (suite !== 1) throw new PPXError("unknown-suite");
  if (flags !== 0) throw new PPXError("unknown-flags");
  const creationTime = reader.readUint64BE();
  let masterEntropy: Uint8Array | undefined;
  let transferred = false;
  try {
    masterEntropy = reader.readBytes(32);
    let pseudonym: string;
    try {
      pseudonym = decoder.decode(reader.readBytes(pseudonymLength));
    } catch {
      throw new PPXError("noncanonical-text");
    }
    if (normalizePseudonym(pseudonym) !== pseudonym) {
      throw new PPXError("noncanonical-text");
    }
    const checksum = reader.readBytes(16);
    reader.requireEnd();
    if (!equalBytes(checksum16(bytes.slice(0, -16)), checksum)) {
      throw new PPXError("checksum-mismatch");
    }
    const recovery: RecoveryObject = {
      magic: "PPXR",
      formatVersion: 1,
      suite: 1,
      flags,
      masterEntropy,
      creationTime,
      pseudonym,
      checksum,
    };
    transferred = true;
    return recovery;
  } finally {
    if (!transferred && masterEntropy) zeroize(masterEntropy);
  }
}
