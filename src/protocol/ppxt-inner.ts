import { signEd25519, verifyEd25519 } from "../crypto/noble-provider";
import { StrictByteReader, StrictByteWriter } from "./bytes";
import { encodePublicContact, parsePublicContact } from "./ppxc";
import {
  PPXError,
  type DecryptedTextOutput,
  type PublicContact,
} from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const SIGNATURE_DOMAIN = encoder.encode("PPX/TEXT/V1/SIGNATURE");
const MAXIMUM_PLAINTEXT_SIZE = 262_144;
const MAXIMUM_INNER_SIZE = 264_000;

function readUint32At(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.byteLength) {
    throw new PPXError("impossible-length");
  }
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(
    0,
    false,
  );
}

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

export function encodeSignedTextInner(input: {
  senderContact: PublicContact;
  signingSecretKey: Uint8Array;
  recipientId: Uint8Array;
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
  plaintext: string;
}): Uint8Array {
  const sender = encodePublicContact(input.senderContact);
  const plaintext = encoder.encode(input.plaintext);
  if (
    input.recipientId.byteLength !== 20 ||
    input.messageId.byteLength < 1 ||
    input.messageId.byteLength > 64 ||
    plaintext.byteLength > MAXIMUM_PLAINTEXT_SIZE
  ) {
    throw new PPXError("impossible-length");
  }
  const unsignedLength =
    4 +
    sender.byteLength +
    20 +
    1 +
    input.messageId.byteLength +
    8 +
    8 +
    4 +
    plaintext.byteLength;
  const writer = new StrictByteWriter(unsignedLength + 64);
  writer.writeUint32BE(sender.byteLength);
  writer.writeBytes(sender);
  writer.writeBytes(input.recipientId);
  writer.writeUint8(input.messageId.byteLength);
  writer.writeBytes(input.messageId);
  writer.writeUint64BE(input.sentAt);
  writer.writeUint64BE(input.createdAt);
  writer.writeUint32BE(plaintext.byteLength);
  writer.writeBytes(plaintext);
  const unsigned = writer.toBytes();
  writer.writeBytes(
    signEd25519(
      concatBytes(SIGNATURE_DOMAIN, unsigned),
      input.signingSecretKey,
    ),
  );
  return writer.toBytes();
}

export function parseSignedTextInner(bytes: Uint8Array): DecryptedTextOutput {
  const reader = new StrictByteReader(bytes, MAXIMUM_INNER_SIZE);
  const senderLength = readUint32At(bytes, 0);
  if (senderLength < 961 || senderLength > 1008) {
    throw new PPXError("impossible-length");
  }
  const messageLengthOffset = 4 + senderLength + 20;
  if (messageLengthOffset >= bytes.byteLength) {
    throw new PPXError("impossible-length");
  }
  const messageIdLength = bytes[messageLengthOffset] as number;
  if (messageIdLength < 1 || messageIdLength > 64) {
    throw new PPXError("impossible-length");
  }
  const plaintextLengthOffset = messageLengthOffset + 1 + messageIdLength + 16;
  const plaintextLength = readUint32At(bytes, plaintextLengthOffset);
  if (
    plaintextLength > MAXIMUM_PLAINTEXT_SIZE ||
    bytes.byteLength !== plaintextLengthOffset + 4 + plaintextLength + 64
  ) {
    throw new PPXError("impossible-length");
  }
  if (reader.readUint32BE() !== senderLength) {
    throw new PPXError("impossible-length");
  }
  const senderContact = parsePublicContact(reader.readBytes(senderLength));
  const recipientId = reader.readBytes(20);
  if (reader.readUint8() !== messageIdLength) {
    throw new PPXError("impossible-length");
  }
  const messageId = reader.readBytes(messageIdLength);
  const sentAt = reader.readUint64BE();
  const createdAt = reader.readUint64BE();
  if (reader.readUint32BE() !== plaintextLength) {
    throw new PPXError("impossible-length");
  }
  if (
    plaintextLength > MAXIMUM_PLAINTEXT_SIZE ||
    plaintextLength > reader.remaining() - 64
  ) {
    throw new PPXError("impossible-length");
  }
  let plaintext: string;
  try {
    plaintext = decoder.decode(reader.readBytes(plaintextLength));
  } catch {
    throw new PPXError("noncanonical-text");
  }
  if (encoder.encode(plaintext).byteLength !== plaintextLength) {
    throw new PPXError("noncanonical-text");
  }
  const signatureOffset = bytes.byteLength - 64;
  const signature = reader.readBytes(64);
  reader.requireEnd();
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
    plaintext,
    signatureValid: true,
  };
}
