import { deriveFingerprintV2 } from "../crypto/identity-v2";
import { mlDsa87Sign, mlDsa87Verify } from "../crypto/pq-provider-v2";
import { zeroize } from "../crypto/zeroize";
import { decodeBase45Upper, encodeBase45Upper } from "./base45";
import { StrictByteReader, StrictByteWriter } from "./bytes";
import { checksum16, equalBytes } from "./checksum";
import { normalizePseudonym } from "./text";
import { PPXError } from "./types";
import {
  PPX_PQ_5_SUITE,
  PPX_V2_FORMAT_VERSION,
  type DerivedIdentityV2,
  type PublicContactV2,
} from "./types-v2";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const MAGIC = encoder.encode("PPXC");
export const PPXC_V2_SIGNATURE_CONTEXT = "PPX/CONTACT/V2";
const SIGNATURE_CONTEXT_BYTES = encoder.encode(PPXC_V2_SIGNATURE_CONTEXT);
export const PPXC_V2_TEXT_PREFIX = "PPX2:CONTACT:";
const UNSIGNED_FIXED_SIZE = 4176;
const SIGNATURE_SIZE = 4627;
const CHECKSUM_SIZE = 16;
const MINIMUM_SIZE = 8819;
export const PPXC_V2_MAXIMUM_SIZE = 8867;
export const PPXC_V2_MAXIMUM_BASE45_CHARS = 13301;

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    parts.reduce((length, part) => length + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function requireLength(bytes: Uint8Array, length: number): void {
  if (bytes.byteLength !== length) throw new PPXError("impossible-length");
}

function unsignedContactBytes(input: {
  creationTime: bigint;
  pseudonym: string;
  kemPublicKey: Uint8Array;
  signingPublicKey: Uint8Array;
}): Uint8Array {
  const pseudonym = normalizePseudonym(input.pseudonym);
  const pseudonymBytes = encoder.encode(pseudonym);
  requireLength(input.kemPublicKey, 1568);
  requireLength(input.signingPublicKey, 2592);
  const writer = new StrictByteWriter(
    UNSIGNED_FIXED_SIZE + pseudonymBytes.byteLength,
  );
  writer.writeBytes(MAGIC);
  writer.writeUint8(PPX_V2_FORMAT_VERSION);
  writer.writeUint8(PPX_PQ_5_SUITE);
  writer.writeUint8(0);
  writer.writeUint8(pseudonymBytes.byteLength);
  writer.writeUint64BE(input.creationTime);
  writer.writeBytes(input.kemPublicKey);
  writer.writeBytes(input.signingPublicKey);
  writer.writeBytes(pseudonymBytes);
  return writer.toBytes();
}

export function createPublicContactV2(
  identity: DerivedIdentityV2,
  pseudonym: string,
  creationTime: bigint,
  extraEntropy: Uint8Array = crypto.getRandomValues(new Uint8Array(32)),
): PublicContactV2 {
  if (identity.suite !== PPX_PQ_5_SUITE) throw new PPXError("unknown-suite");
  requireLength(extraEntropy, 32);
  const normalizedPseudonym = normalizePseudonym(pseudonym);
  const unsigned = unsignedContactBytes({
    creationTime,
    pseudonym: normalizedPseudonym,
    kemPublicKey: identity.kemPublicKey,
    signingPublicKey: identity.signingPublicKey,
  });
  const signingEntropy = Uint8Array.from(extraEntropy);
  let signed: Uint8Array | undefined;
  try {
    const selfSignature = mlDsa87Sign(
      unsigned,
      identity.signingSecretKey,
      SIGNATURE_CONTEXT_BYTES,
      signingEntropy,
    );
    signed = concatBytes(unsigned, selfSignature);
    const checksum = checksum16(signed);
    const fingerprint = deriveFingerprintV2({
      suite: PPX_PQ_5_SUITE,
      kemPublicKey: identity.kemPublicKey,
      signingPublicKey: identity.signingPublicKey,
    });
    if (
      !equalBytes(fingerprint, identity.fingerprint) ||
      !equalBytes(fingerprint.slice(0, 20), identity.identityId)
    ) {
      throw new PPXError("invalid-signature");
    }
    return {
      magic: "PPXC",
      formatVersion: PPX_V2_FORMAT_VERSION,
      suite: PPX_PQ_5_SUITE,
      creationTime,
      pseudonym: normalizedPseudonym,
      kemPublicKey: Uint8Array.from(identity.kemPublicKey),
      signingPublicKey: Uint8Array.from(identity.signingPublicKey),
      selfSignature,
      checksum,
      fingerprint,
      identityId: fingerprint.slice(0, 20),
    };
  } finally {
    zeroize(unsigned, signingEntropy);
    if (signed) zeroize(signed);
  }
}

export function encodePublicContactV2(contact: PublicContactV2): Uint8Array {
  if (contact.magic !== "PPXC") throw new PPXError("noncanonical-text");
  if (contact.formatVersion !== PPX_V2_FORMAT_VERSION) {
    throw new PPXError("unknown-format-version");
  }
  if (contact.suite !== PPX_PQ_5_SUITE) throw new PPXError("unknown-suite");
  requireLength(contact.selfSignature, SIGNATURE_SIZE);
  requireLength(contact.checksum, CHECKSUM_SIZE);
  const unsigned = unsignedContactBytes(contact);
  const signed = concatBytes(unsigned, contact.selfSignature);
  try {
    if (
      !mlDsa87Verify(
        contact.selfSignature,
        unsigned,
        contact.signingPublicKey,
        SIGNATURE_CONTEXT_BYTES,
      )
    ) {
      throw new PPXError("invalid-signature");
    }
    if (!equalBytes(checksum16(signed), contact.checksum)) {
      throw new PPXError("checksum-mismatch");
    }
    const fingerprint = deriveFingerprintV2(contact);
    if (
      !equalBytes(fingerprint, contact.fingerprint) ||
      !equalBytes(fingerprint.slice(0, 20), contact.identityId)
    ) {
      throw new PPXError("invalid-signature");
    }
    const encoded = concatBytes(signed, contact.checksum);
    if (encoded.byteLength > PPXC_V2_MAXIMUM_SIZE) {
      throw new PPXError("oversize-before-allocation");
    }
    return encoded;
  } finally {
    zeroize(unsigned, signed);
  }
}

export function parsePublicContactV2(bytes: Uint8Array): PublicContactV2 {
  const reader = new StrictByteReader(bytes, PPXC_V2_MAXIMUM_SIZE);
  const magic = reader.readBytes(4);
  const formatVersion = reader.readUint8();
  const suite = reader.readUint8();
  const flags = reader.readUint8();
  const pseudonymLength = reader.readUint8();
  if (
    pseudonymLength < 1 ||
    pseudonymLength > 48 ||
    bytes.byteLength !== MINIMUM_SIZE + pseudonymLength
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
  const kemPublicKey = reader.readBytes(1568);
  const signingPublicKey = reader.readBytes(2592);
  let pseudonym: string;
  try {
    pseudonym = decoder.decode(reader.readBytes(pseudonymLength));
  } catch {
    throw new PPXError("noncanonical-text");
  }
  if (normalizePseudonym(pseudonym) !== pseudonym) {
    throw new PPXError("noncanonical-text");
  }
  const selfSignature = reader.readBytes(SIGNATURE_SIZE);
  const checksum = reader.readBytes(CHECKSUM_SIZE);
  reader.requireEnd();
  const unsignedLength = UNSIGNED_FIXED_SIZE + pseudonymLength;
  const unsigned = bytes.slice(0, unsignedLength);
  const signed = bytes.slice(0, unsignedLength + SIGNATURE_SIZE);
  try {
    if (!equalBytes(checksum16(signed), checksum)) {
      throw new PPXError("checksum-mismatch");
    }
    if (
      !mlDsa87Verify(
        selfSignature,
        unsigned,
        signingPublicKey,
        SIGNATURE_CONTEXT_BYTES,
      )
    ) {
      throw new PPXError("invalid-signature");
    }
    const fingerprint = deriveFingerprintV2({
      suite: PPX_PQ_5_SUITE,
      kemPublicKey,
      signingPublicKey,
    });
    return {
      magic: "PPXC",
      formatVersion: PPX_V2_FORMAT_VERSION,
      suite: PPX_PQ_5_SUITE,
      creationTime,
      pseudonym,
      kemPublicKey,
      signingPublicKey,
      selfSignature,
      checksum,
      fingerprint,
      identityId: fingerprint.slice(0, 20),
    };
  } finally {
    zeroize(unsigned, signed);
  }
}

export function encodePublicContactV2Text(contact: PublicContactV2): string {
  return (
    PPXC_V2_TEXT_PREFIX + encodeBase45Upper(encodePublicContactV2(contact))
  );
}

export function parsePublicContactV2Text(text: string): PublicContactV2 {
  if (!text.startsWith(PPXC_V2_TEXT_PREFIX)) {
    throw new PPXError("noncanonical-text");
  }
  const encoded = text.slice(PPXC_V2_TEXT_PREFIX.length);
  if (encoded.length > PPXC_V2_MAXIMUM_BASE45_CHARS) {
    throw new PPXError("oversize-before-allocation");
  }
  return parsePublicContactV2(decodeBase45Upper(encoded));
}
