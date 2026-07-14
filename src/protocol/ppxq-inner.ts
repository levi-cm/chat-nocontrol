import { signEd25519, verifyEd25519 } from "../crypto/noble-provider";
import { StrictByteReader, StrictByteWriter } from "./bytes";
import { equalBytes } from "./checksum";
import { PPXError, type PublicContact } from "./types";

const SIGNATURE_DOMAIN = new TextEncoder().encode("PPX/QR-TEXT/V1/SIGNATURE");
export const PPXQ_MAXIMUM_ORIGINAL_UTF8_SIZE = 262_144;
export const PPXQ_MAXIMUM_STORED_PAYLOAD_SIZE = 65_365;
export const PPXQ_FIXED_INNER_SIZE = 154;

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

export interface ParsedSignedQrTextInner {
  senderContact: PublicContact;
  recipientId: Uint8Array;
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
  originalUtf8Length: number;
  storedPayload: Uint8Array;
}

export function encodeSignedQrTextInner(input: {
  senderFingerprint: Uint8Array;
  signingSecretKey: Uint8Array;
  recipientId: Uint8Array;
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
  originalUtf8Length: number;
  storedPayload: Uint8Array;
}): Uint8Array {
  if (
    input.senderFingerprint.byteLength !== 32 ||
    input.recipientId.byteLength !== 20 ||
    input.messageId.byteLength !== 16 ||
    !Number.isSafeInteger(input.originalUtf8Length) ||
    input.originalUtf8Length < 0 ||
    input.originalUtf8Length > PPXQ_MAXIMUM_ORIGINAL_UTF8_SIZE ||
    input.storedPayload.byteLength > PPXQ_MAXIMUM_STORED_PAYLOAD_SIZE
  ) {
    throw new PPXError("impossible-length");
  }
  const writer = new StrictByteWriter(
    PPXQ_FIXED_INNER_SIZE + input.storedPayload.byteLength,
  );
  writer.writeBytes(input.senderFingerprint);
  writer.writeBytes(input.recipientId);
  writer.writeBytes(input.messageId);
  writer.writeUint64BE(input.sentAt);
  writer.writeUint64BE(input.createdAt);
  writer.writeUint32BE(input.originalUtf8Length);
  writer.writeUint16BE(input.storedPayload.byteLength);
  writer.writeBytes(input.storedPayload);
  const unsigned = writer.toBytes();
  writer.writeBytes(
    signEd25519(
      concatBytes(SIGNATURE_DOMAIN, unsigned),
      input.signingSecretKey,
    ),
  );
  return writer.toBytes();
}

export function parseSignedQrTextInner(
  bytes: Uint8Array,
  knownSenders: readonly PublicContact[],
): ParsedSignedQrTextInner {
  const reader = new StrictByteReader(
    bytes,
    PPXQ_FIXED_INNER_SIZE + PPXQ_MAXIMUM_STORED_PAYLOAD_SIZE,
  );
  if (bytes.byteLength < PPXQ_FIXED_INNER_SIZE)
    throw new PPXError("impossible-length");
  const senderFingerprint = reader.readBytes(32);
  const recipientId = reader.readBytes(20);
  const messageId = reader.readBytes(16);
  const sentAt = reader.readUint64BE();
  const createdAt = reader.readUint64BE();
  const originalUtf8Length = reader.readUint32BE();
  const storedPayloadLength = reader.readUint16BE();
  if (
    originalUtf8Length > PPXQ_MAXIMUM_ORIGINAL_UTF8_SIZE ||
    storedPayloadLength > PPXQ_MAXIMUM_STORED_PAYLOAD_SIZE ||
    reader.remaining() !== storedPayloadLength + 64
  ) {
    throw new PPXError("impossible-length");
  }
  const storedPayload = reader.readBytes(storedPayloadLength);
  const signatureOffset = bytes.byteLength - 64;
  const signature = reader.readBytes(64);
  reader.requireEnd();
  const senderContact = knownSenders.find((contact) =>
    equalBytes(contact.fingerprint, senderFingerprint),
  );
  if (!senderContact) throw new PPXError("unknown-sender-contact");
  if (
    !verifyEd25519(
      signature,
      concatBytes(SIGNATURE_DOMAIN, bytes.slice(0, signatureOffset)),
      senderContact.signingPublicKey,
    )
  ) {
    throw new PPXError("invalid-signature");
  }
  return {
    senderContact,
    recipientId,
    messageId,
    sentAt,
    createdAt,
    originalUtf8Length,
    storedPayload,
  };
}
