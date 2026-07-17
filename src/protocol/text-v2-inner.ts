import {
  mlDsa87PublicKeyFromSecret,
  mlDsa87Sign,
  mlDsa87Verify,
} from "../crypto/pq-provider-v2";
import { zeroize } from "../crypto/zeroize";
import { StrictByteReader, StrictByteWriter } from "./bytes";
import { equalBytes } from "./checksum";
import { encodePublicContactV2, parsePublicContactV2 } from "./ppxc-v2";
import { PPXError } from "./types";
import type { PublicContactV2 } from "./types-v2";

const encoder = new TextEncoder();
export const PPXT_V2_FULL_SIGNATURE_CONTEXT = "PPX/TEXT/FULL/V2";
export const PPXT_V2_COMPACT_SIGNATURE_CONTEXT = "PPX/TEXT/COMPACT/V2";
const FULL_CONTEXT = encoder.encode(PPXT_V2_FULL_SIGNATURE_CONTEXT);
const COMPACT_CONTEXT = encoder.encode(PPXT_V2_COMPACT_SIGNATURE_CONTEXT);
export const PPXT_V2_EMPTY_INNER_MINIMUM_SIZE = 13_508;
export const PPXM_V2_EMPTY_INNER_SIZE = 4_715;
export const PPX_TEXT_V2_SIGNATURE_SIZE = 4_627;
export const PPX_TEXT_V2_MAXIMUM_ORIGINAL_UTF8_SIZE = 262_144;
export const PPX_TEXT_V2_MAXIMUM_STORED_PAYLOAD_SIZE = 262_144;
export const PPX_TEXT_V2_MAXIMUM_INNER_SIZE = 275_700;

export interface ParsedSignedTextInnerV2 {
  senderContact: PublicContactV2;
  recipientId: Uint8Array;
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
  originalUtf8Length: number;
  storedPayload: Uint8Array;
}

interface CommonSignedTextInputV2 {
  signingSecretKey: Uint8Array;
  recipientId: Uint8Array;
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
  originalUtf8Length: number;
  storedPayload: Uint8Array;
  signatureEntropy: Uint8Array;
}

function validateCommon(input: CommonSignedTextInputV2): void {
  if (
    input.signingSecretKey.byteLength !== 4896 ||
    input.recipientId.byteLength !== 20 ||
    input.messageId.byteLength !== 16 ||
    input.signatureEntropy.byteLength !== 32 ||
    !Number.isSafeInteger(input.originalUtf8Length) ||
    input.originalUtf8Length < 0 ||
    input.originalUtf8Length > PPX_TEXT_V2_MAXIMUM_ORIGINAL_UTF8_SIZE ||
    input.storedPayload.byteLength > PPX_TEXT_V2_MAXIMUM_STORED_PAYLOAD_SIZE
  ) {
    throw new PPXError("impossible-length");
  }
}

function writeCommon(
  writer: StrictByteWriter,
  input: CommonSignedTextInputV2,
): void {
  writer.writeBytes(input.recipientId);
  writer.writeBytes(input.messageId);
  writer.writeUint64BE(input.sentAt);
  writer.writeUint64BE(input.createdAt);
  writer.writeUint32BE(input.originalUtf8Length);
  writer.writeBytes(input.storedPayload);
}

function appendSignature(
  writer: StrictByteWriter,
  input: CommonSignedTextInputV2,
  context: Uint8Array,
): Uint8Array {
  const unsigned = writer.toBytes();
  const entropy = Uint8Array.from(input.signatureEntropy);
  try {
    writer.writeBytes(
      mlDsa87Sign(unsigned, input.signingSecretKey, context, entropy),
    );
    return writer.toBytes();
  } finally {
    zeroize(unsigned, entropy, input.signatureEntropy, input.signingSecretKey);
  }
}

export function encodeSignedFullTextInnerV2(
  input: CommonSignedTextInputV2 & { senderContact: PublicContactV2 },
): Uint8Array {
  let sender: Uint8Array | undefined;
  try {
    validateCommon(input);
    sender = encodePublicContactV2(input.senderContact);
    if (
      !equalBytes(
        mlDsa87PublicKeyFromSecret(input.signingSecretKey),
        input.senderContact.signingPublicKey,
      )
    ) {
      throw new PPXError("invalid-signature");
    }
    const writer = new StrictByteWriter(
      4 +
        sender.byteLength +
        20 +
        1 +
        16 +
        8 +
        8 +
        4 +
        input.storedPayload.byteLength +
        PPX_TEXT_V2_SIGNATURE_SIZE,
    );
    writer.writeUint32BE(sender.byteLength);
    writer.writeBytes(sender);
    writer.writeBytes(input.recipientId);
    writer.writeUint8(16);
    writer.writeBytes(input.messageId);
    writer.writeUint64BE(input.sentAt);
    writer.writeUint64BE(input.createdAt);
    writer.writeUint32BE(input.originalUtf8Length);
    writer.writeBytes(input.storedPayload);
    return appendSignature(writer, input, FULL_CONTEXT);
  } finally {
    if (sender) zeroize(sender);
    zeroize(input.signingSecretKey);
  }
}

export function encodeSignedCompactTextInnerV2(
  input: CommonSignedTextInputV2 & { senderFingerprint: Uint8Array },
): Uint8Array {
  try {
    validateCommon(input);
    if (input.senderFingerprint.byteLength !== 32) {
      throw new PPXError("impossible-length");
    }
    const writer = new StrictByteWriter(
      PPXM_V2_EMPTY_INNER_SIZE + input.storedPayload.byteLength,
    );
    writer.writeBytes(input.senderFingerprint);
    writeCommon(writer, input);
    return appendSignature(writer, input, COMPACT_CONTEXT);
  } finally {
    zeroize(input.signingSecretKey);
  }
}

function readPayloadAndVerify(
  bytes: Uint8Array,
  reader: StrictByteReader,
  senderContact: PublicContactV2,
  recipientId: Uint8Array,
  messageId: Uint8Array,
  sentAt: bigint,
  createdAt: bigint,
  originalUtf8Length: number,
  context: Uint8Array,
): ParsedSignedTextInnerV2 {
  if (originalUtf8Length > PPX_TEXT_V2_MAXIMUM_ORIGINAL_UTF8_SIZE) {
    throw new PPXError("impossible-length");
  }
  const storedLength = reader.remaining() - PPX_TEXT_V2_SIGNATURE_SIZE;
  if (
    storedLength < 0 ||
    storedLength > PPX_TEXT_V2_MAXIMUM_STORED_PAYLOAD_SIZE
  ) {
    throw new PPXError("impossible-length");
  }
  const storedPayload = reader.readBytes(storedLength);
  const signatureOffset = bytes.byteLength - PPX_TEXT_V2_SIGNATURE_SIZE;
  const signature = reader.readBytes(PPX_TEXT_V2_SIGNATURE_SIZE);
  reader.requireEnd();
  const unsigned = bytes.slice(0, signatureOffset);
  try {
    if (
      !mlDsa87Verify(
        signature,
        unsigned,
        senderContact.signingPublicKey,
        context,
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
  } finally {
    zeroize(unsigned);
  }
}

export function parseSignedFullTextInnerV2(
  bytes: Uint8Array,
): ParsedSignedTextInnerV2 {
  const reader = new StrictByteReader(bytes, PPX_TEXT_V2_MAXIMUM_INNER_SIZE);
  if (bytes.byteLength < PPXT_V2_EMPTY_INNER_MINIMUM_SIZE) {
    throw new PPXError("impossible-length");
  }
  const senderLength = reader.readUint32BE();
  if (senderLength < 8820 || senderLength > 8867) {
    throw new PPXError("impossible-length");
  }
  const senderContact = parsePublicContactV2(reader.readBytes(senderLength));
  const recipientId = reader.readBytes(20);
  if (reader.readUint8() !== 16) throw new PPXError("impossible-length");
  const messageId = reader.readBytes(16);
  const sentAt = reader.readUint64BE();
  const createdAt = reader.readUint64BE();
  const originalUtf8Length = reader.readUint32BE();
  return readPayloadAndVerify(
    bytes,
    reader,
    senderContact,
    recipientId,
    messageId,
    sentAt,
    createdAt,
    originalUtf8Length,
    FULL_CONTEXT,
  );
}

export function parseSignedCompactTextInnerV2(
  bytes: Uint8Array,
  knownSenders: readonly PublicContactV2[],
): ParsedSignedTextInnerV2 {
  const reader = new StrictByteReader(bytes, PPX_TEXT_V2_MAXIMUM_INNER_SIZE);
  if (bytes.byteLength < PPXM_V2_EMPTY_INNER_SIZE) {
    throw new PPXError("impossible-length");
  }
  const senderFingerprint = reader.readBytes(32);
  const candidate = knownSenders.find((contact) =>
    equalBytes(contact.fingerprint, senderFingerprint),
  );
  if (!candidate) throw new PPXError("unknown-sender-contact");
  const senderContact = parsePublicContactV2(encodePublicContactV2(candidate));
  if (!equalBytes(senderContact.fingerprint, senderFingerprint)) {
    throw new PPXError("unknown-sender-contact");
  }
  const recipientId = reader.readBytes(20);
  const messageId = reader.readBytes(16);
  const sentAt = reader.readUint64BE();
  const createdAt = reader.readUint64BE();
  const originalUtf8Length = reader.readUint32BE();
  return readPayloadAndVerify(
    bytes,
    reader,
    senderContact,
    recipientId,
    messageId,
    sentAt,
    createdAt,
    originalUtf8Length,
    COMPACT_CONTEXT,
  );
}
