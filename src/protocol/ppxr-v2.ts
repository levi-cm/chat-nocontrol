import { zeroize } from "../crypto/zeroize";
import { decodeBase45Upper, encodeBase45Upper } from "./base45";
import { StrictByteReader, StrictByteWriter } from "./bytes";
import { checksum16, equalBytes } from "./checksum";
import { normalizePseudonym } from "./text";
import { PPXError } from "./types";
import {
  PPX_PQ_5_SUITE,
  PPX_V2_FORMAT_VERSION,
  type RecoveryObjectV2,
} from "./types-v2";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const MAGIC = encoder.encode("PPXR");
export const PPXR_V2_MAXIMUM_SIZE = 112;
export const PPXR_V2_MAXIMUM_BASE45_CHARS = 168;
export const PPXR_V2_TEXT_PREFIX = "PPX2:RECOVERY:";

export function encodeRecoveryObjectV2(object: RecoveryObjectV2): Uint8Array {
  if (object.magic !== "PPXR") throw new PPXError("noncanonical-text");
  if (object.formatVersion !== PPX_V2_FORMAT_VERSION) {
    throw new PPXError("unknown-format-version");
  }
  if (object.suite !== PPX_PQ_5_SUITE) throw new PPXError("unknown-suite");
  if (object.flags !== 0) throw new PPXError("unknown-flags");
  if (object.masterEntropy.byteLength !== 32) {
    throw new PPXError("impossible-length");
  }
  const pseudonymBytes = encoder.encode(normalizePseudonym(object.pseudonym));
  const writer = new StrictByteWriter(64 + pseudonymBytes.byteLength);
  try {
    writer.writeBytes(MAGIC);
    writer.writeUint8(PPX_V2_FORMAT_VERSION);
    writer.writeUint8(PPX_PQ_5_SUITE);
    writer.writeUint8(0);
    writer.writeUint8(pseudonymBytes.byteLength);
    writer.writeUint64BE(object.creationTime);
    writer.writeBytes(object.masterEntropy);
    writer.writeBytes(pseudonymBytes);
    const payload = writer.toBytes();
    try {
      writer.writeBytes(checksum16(payload));
      return writer.toBytes();
    } finally {
      zeroize(payload);
    }
  } finally {
    zeroize(pseudonymBytes);
    writer.destroy();
  }
}

export function parseRecoveryObjectV2(bytes: Uint8Array): RecoveryObjectV2 {
  const reader = new StrictByteReader(bytes, PPXR_V2_MAXIMUM_SIZE);
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
  if (formatVersion !== PPX_V2_FORMAT_VERSION) {
    throw new PPXError("unknown-format-version");
  }
  if (suite !== PPX_PQ_5_SUITE) throw new PPXError("unknown-suite");
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
    if (!equalBytes(checksum16(bytes.subarray(0, -16)), checksum)) {
      throw new PPXError("checksum-mismatch");
    }
    const recovery: RecoveryObjectV2 = {
      magic: "PPXR",
      formatVersion: PPX_V2_FORMAT_VERSION,
      suite: PPX_PQ_5_SUITE,
      flags: 0,
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

export function encodeRecoveryObjectV2Text(object: RecoveryObjectV2): string {
  const bytes = encodeRecoveryObjectV2(object);
  try {
    return PPXR_V2_TEXT_PREFIX + encodeBase45Upper(bytes);
  } finally {
    zeroize(bytes);
  }
}

export function parseRecoveryObjectV2Text(text: string): RecoveryObjectV2 {
  if (!text.startsWith(PPXR_V2_TEXT_PREFIX)) {
    throw new PPXError("noncanonical-text");
  }
  const encoded = text.slice(PPXR_V2_TEXT_PREFIX.length);
  if (encoded.length > PPXR_V2_MAXIMUM_BASE45_CHARS) {
    throw new PPXError("oversize-before-allocation");
  }
  const bytes = decodeBase45Upper(encoded);
  try {
    return parseRecoveryObjectV2(bytes);
  } finally {
    zeroize(bytes);
  }
}
