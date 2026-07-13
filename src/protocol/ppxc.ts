import { signEd25519, verifyEd25519 } from "../crypto/noble-provider";
import { deriveFingerprint } from "../crypto/identity";
import { decodeBase45Upper, encodeBase45Upper } from "./base45";
import { StrictByteReader, StrictByteWriter } from "./bytes";
import { checksum16, equalBytes } from "./checksum";
import { normalizePseudonym } from "./text";
import { PPXError, type DerivedIdentity, type PublicContact } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const MAGIC = encoder.encode("PPXC");
const SIGNATURE_DOMAIN = encoder.encode("PPX/CONTACT/V1/SIGNATURE");
const QR_PREFIX = "PPX1:CONTACT:";
export const PPXC_MAXIMUM_SIZE = 1008;
export const PPXC_MAXIMUM_BASE45_CHARS = 1512;

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    parts.reduce((size, part) => size + part.byteLength, 0),
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
  x25519PublicKey: Uint8Array;
  signingPublicKey: Uint8Array;
}): Uint8Array {
  const pseudonym = normalizePseudonym(input.pseudonym);
  const pseudonymBytes = encoder.encode(pseudonym);
  requireLength(input.kemPublicKey, 800);
  requireLength(input.x25519PublicKey, 32);
  requireLength(input.signingPublicKey, 32);
  const writer = new StrictByteWriter(880 + pseudonymBytes.byteLength);
  writer.writeBytes(MAGIC);
  writer.writeUint8(0x01);
  writer.writeUint8(0x01);
  writer.writeUint8(0);
  writer.writeUint8(pseudonymBytes.byteLength);
  writer.writeUint64BE(input.creationTime);
  writer.writeBytes(input.kemPublicKey);
  writer.writeBytes(input.x25519PublicKey);
  writer.writeBytes(input.signingPublicKey);
  writer.writeBytes(pseudonymBytes);
  return writer.toBytes();
}

export function createPublicContact(
  identity: DerivedIdentity,
  pseudonym: string,
  creationTime: bigint,
): PublicContact {
  const normalizedPseudonym = normalizePseudonym(pseudonym);
  const unsigned = unsignedContactBytes({
    creationTime,
    pseudonym: normalizedPseudonym,
    kemPublicKey: identity.kemPublicKey,
    x25519PublicKey: identity.x25519PublicKey,
    signingPublicKey: identity.signingPublicKey,
  });
  const selfSignature = signEd25519(
    concatBytes(SIGNATURE_DOMAIN, unsigned),
    identity.signingSecretKey,
  );
  const checksum = checksum16(concatBytes(unsigned, selfSignature));
  const fingerprint = deriveFingerprint({
    suite: 0x01,
    kemPublicKey: identity.kemPublicKey,
    x25519PublicKey: identity.x25519PublicKey,
    signingPublicKey: identity.signingPublicKey,
  });
  return {
    magic: "PPXC",
    formatVersion: 0x01,
    suite: 0x01,
    creationTime,
    pseudonym: normalizedPseudonym,
    kemPublicKey: identity.kemPublicKey,
    x25519PublicKey: identity.x25519PublicKey,
    signingPublicKey: identity.signingPublicKey,
    selfSignature,
    checksum,
    fingerprint,
    identityId: fingerprint.slice(0, 20),
  };
}

export function encodePublicContact(contact: PublicContact): Uint8Array {
  if (contact.magic !== "PPXC") throw new PPXError("noncanonical-text");
  if (contact.formatVersion !== 0x01) {
    throw new PPXError("unknown-format-version");
  }
  if (contact.suite !== 0x01) throw new PPXError("unknown-suite");
  requireLength(contact.selfSignature, 64);
  requireLength(contact.checksum, 16);
  const unsigned = unsignedContactBytes(contact);
  const signed = concatBytes(unsigned, contact.selfSignature);
  if (
    !verifyEd25519(
      contact.selfSignature,
      concatBytes(SIGNATURE_DOMAIN, unsigned),
      contact.signingPublicKey,
    )
  ) {
    throw new PPXError("invalid-signature");
  }
  if (!equalBytes(checksum16(signed), contact.checksum)) {
    throw new PPXError("checksum-mismatch");
  }
  const fingerprint = deriveFingerprint(contact);
  if (
    !equalBytes(fingerprint, contact.fingerprint) ||
    !equalBytes(fingerprint.slice(0, 20), contact.identityId)
  ) {
    throw new PPXError("invalid-signature");
  }
  const encoded = concatBytes(signed, contact.checksum);
  if (encoded.byteLength > PPXC_MAXIMUM_SIZE) {
    throw new PPXError("oversize-before-allocation");
  }
  return encoded;
}

export function parsePublicContact(bytes: Uint8Array): PublicContact {
  const reader = new StrictByteReader(bytes, PPXC_MAXIMUM_SIZE);
  const magic = reader.readBytes(4);
  const formatVersion = reader.readUint8();
  const suite = reader.readUint8();
  const flags = reader.readUint8();
  const pseudonymLength = reader.readUint8();
  if (
    pseudonymLength < 1 ||
    pseudonymLength > 48 ||
    bytes.byteLength !== 960 + pseudonymLength
  ) {
    throw new PPXError("impossible-length");
  }
  if (!equalBytes(magic, MAGIC)) throw new PPXError("noncanonical-text");
  if (formatVersion !== 0x01) throw new PPXError("unknown-format-version");
  if (suite !== 0x01) throw new PPXError("unknown-suite");
  if (flags !== 0) throw new PPXError("unknown-flags");
  const creationTime = reader.readUint64BE();
  const kemPublicKey = reader.readBytes(800);
  const x25519PublicKey = reader.readBytes(32);
  const signingPublicKey = reader.readBytes(32);
  let pseudonym: string;
  try {
    pseudonym = decoder.decode(reader.readBytes(pseudonymLength));
  } catch {
    throw new PPXError("noncanonical-text");
  }
  if (normalizePseudonym(pseudonym) !== pseudonym) {
    throw new PPXError("noncanonical-text");
  }
  const selfSignature = reader.readBytes(64);
  const checksum = reader.readBytes(16);
  reader.requireEnd();
  const unsignedLength = 880 + pseudonymLength;
  const unsigned = bytes.slice(0, unsignedLength);
  const signed = bytes.slice(0, unsignedLength + 64);
  if (!equalBytes(checksum16(signed), checksum)) {
    throw new PPXError("checksum-mismatch");
  }
  if (
    !verifyEd25519(
      selfSignature,
      concatBytes(SIGNATURE_DOMAIN, unsigned),
      signingPublicKey,
    )
  ) {
    throw new PPXError("invalid-signature");
  }
  const fingerprint = deriveFingerprint({
    suite: 0x01,
    kemPublicKey,
    x25519PublicKey,
    signingPublicKey,
  });
  return {
    magic: "PPXC",
    formatVersion: 0x01,
    suite: 0x01,
    creationTime,
    pseudonym,
    kemPublicKey,
    x25519PublicKey,
    signingPublicKey,
    selfSignature,
    checksum,
    fingerprint,
    identityId: fingerprint.slice(0, 20),
  };
}

export function encodePublicContactQr(contact: PublicContact): string {
  return QR_PREFIX + encodeBase45Upper(encodePublicContact(contact));
}

export function parsePublicContactQr(text: string): PublicContact {
  if (!text.startsWith(QR_PREFIX)) throw new PPXError("noncanonical-text");
  if (text.length > QR_PREFIX.length + PPXC_MAXIMUM_BASE45_CHARS) {
    throw new PPXError("oversize-before-allocation");
  }
  return parsePublicContact(decodeBase45Upper(text.slice(QR_PREFIX.length)));
}
