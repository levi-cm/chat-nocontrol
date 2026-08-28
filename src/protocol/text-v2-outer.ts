import { StrictByteReader, StrictByteWriter } from "./bytes";
import { checksum16, equalBytes } from "./checksum";
import { PPXError } from "./types";
import {
  PPX_PQ_5_SUITE,
  PPX_V2_FORMAT_VERSION,
  type EncryptedTextObjectV2,
  type TextMagicV2,
} from "./types-v2";

const encoder = new TextEncoder();
const MAGIC_BYTES = {
  PPXT: encoder.encode("PPXT"),
  PPXM: encoder.encode("PPXM"),
} as const;
export const PPX_TEXT_V2_HEADER_SIZE = 1623;
export const PPX_TEXT_V2_CHECKSUM_SIZE = 16;
export const PPXT_V2_EMPTY_OBJECT_MINIMUM_SIZE = 15_163;
export const PPXM_V2_EMPTY_OBJECT_SIZE = 6_370;
export const PPX_TEXT_V2_MAXIMUM_PLAINTEXT_SIZE = 262_144;
export const PPX_TEXT_V2_MAXIMUM_OBJECT_SIZE = 300_000;
const MINIMUM_CIPHERTEXT = { PPXT: 13_524, PPXM: 4_731 } as const;

function requireMagic(value: string): asserts value is TextMagicV2 {
  if (value !== "PPXT" && value !== "PPXM") {
    throw new PPXError("noncanonical-text");
  }
}

export function encodeEncryptedTextHeaderV2(
  object: Omit<EncryptedTextObjectV2, "ciphertext" | "checksum">,
): Uint8Array {
  requireMagic(object.magic);
  if (object.formatVersion !== PPX_V2_FORMAT_VERSION) {
    throw new PPXError("unknown-format-version");
  }
  if (object.suite !== PPX_PQ_5_SUITE) throw new PPXError("unknown-suite");
  if (object.flags !== 0 && object.flags !== 1) {
    throw new PPXError("unknown-flags");
  }
  if (
    object.mlKemCiphertext.byteLength !== 1568 ||
    object.salt.byteLength !== 32 ||
    object.nonce.byteLength !== 12 ||
    !Number.isSafeInteger(object.ciphertextLength) ||
    object.ciphertextLength < MINIMUM_CIPHERTEXT[object.magic] ||
    object.ciphertextLength >
      PPX_TEXT_V2_MAXIMUM_OBJECT_SIZE -
        PPX_TEXT_V2_HEADER_SIZE -
        PPX_TEXT_V2_CHECKSUM_SIZE
  ) {
    throw new PPXError("impossible-length");
  }
  const writer = new StrictByteWriter(PPX_TEXT_V2_HEADER_SIZE);
  writer.writeBytes(MAGIC_BYTES[object.magic]);
  writer.writeUint8(PPX_V2_FORMAT_VERSION);
  writer.writeUint8(PPX_PQ_5_SUITE);
  writer.writeUint8(object.flags);
  writer.writeBytes(object.mlKemCiphertext);
  writer.writeBytes(object.salt);
  writer.writeBytes(object.nonce);
  writer.writeUint32BE(object.ciphertextLength);
  return writer.toBytes();
}

export function encodeEncryptedTextOuterV2(
  object: EncryptedTextObjectV2,
): Uint8Array {
  if (
    object.ciphertext.byteLength !== object.ciphertextLength ||
    object.checksum.byteLength !== PPX_TEXT_V2_CHECKSUM_SIZE
  ) {
    throw new PPXError("impossible-length");
  }
  const header = encodeEncryptedTextHeaderV2(object);
  const payload = new Uint8Array(header.length + object.ciphertext.length);
  payload.set(header);
  payload.set(object.ciphertext, header.length);
  if (!equalBytes(checksum16(payload), object.checksum)) {
    throw new PPXError("checksum-mismatch");
  }
  const output = new Uint8Array(payload.length + object.checksum.length);
  output.set(payload);
  output.set(object.checksum, payload.length);
  return output;
}

export function parseEncryptedTextOuterV2(
  bytes: Uint8Array,
  expectedMagic?: TextMagicV2,
): EncryptedTextObjectV2 {
  const reader = new StrictByteReader(bytes, PPX_TEXT_V2_MAXIMUM_OBJECT_SIZE);
  const magicText = new TextDecoder().decode(reader.readBytes(4));
  requireMagic(magicText);
  if (expectedMagic && magicText !== expectedMagic) {
    throw new PPXError("noncanonical-text");
  }
  const formatVersion = reader.readUint8();
  const suite = reader.readUint8();
  const flags = reader.readUint8();
  if (formatVersion !== PPX_V2_FORMAT_VERSION) {
    throw new PPXError("unknown-format-version");
  }
  if (suite !== PPX_PQ_5_SUITE) throw new PPXError("unknown-suite");
  if (flags !== 0 && flags !== 1) throw new PPXError("unknown-flags");
  const mlKemCiphertext = reader.readBytes(1568);
  const salt = reader.readBytes(32);
  const nonce = reader.readBytes(12);
  const ciphertextLength = reader.readUint32BE();
  if (
    ciphertextLength < MINIMUM_CIPHERTEXT[magicText] ||
    ciphertextLength !== reader.remaining() - PPX_TEXT_V2_CHECKSUM_SIZE ||
    bytes.byteLength !==
      PPX_TEXT_V2_HEADER_SIZE + ciphertextLength + PPX_TEXT_V2_CHECKSUM_SIZE
  ) {
    throw new PPXError("impossible-length");
  }
  const ciphertext = reader.readBytes(ciphertextLength);
  const checksum = reader.readBytes(PPX_TEXT_V2_CHECKSUM_SIZE);
  reader.requireEnd();
  if (!equalBytes(checksum16(bytes.slice(0, -16)), checksum)) {
    throw new PPXError("checksum-mismatch");
  }
  return {
    magic: magicText,
    formatVersion: PPX_V2_FORMAT_VERSION,
    suite: PPX_PQ_5_SUITE,
    flags,
    mlKemCiphertext,
    salt,
    nonce,
    ciphertextLength,
    ciphertext,
    checksum,
  };
}
