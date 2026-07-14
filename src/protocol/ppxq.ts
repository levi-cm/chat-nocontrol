import { decodeBase37Upper, encodeBase37Upper } from "./base37";
import {
  encodeEncryptedQrText,
  parseEncryptedQrText,
  PPXQ_MAXIMUM_OBJECT_SIZE,
} from "./ppxq-outer";
import { PPXError, type EncryptedQrTextObject } from "./types";

export const PPXQ_MESSAGE_PREFIX = "PPX1:MESSAGE:";
export const PPXQ_LINK_HASH_PREFIX = "#/decrypt/qr/";

export function encodeQrMessageText(object: EncryptedQrTextObject): string {
  return PPXQ_MESSAGE_PREFIX + encodeBase37Upper(encodeEncryptedQrText(object));
}

export function encodeQrMessageLink(
  object: EncryptedQrTextObject,
  appBase: string,
): string {
  const base = new URL(appBase);
  if (base.protocol !== "https:") throw new PPXError("noncanonical-text");
  base.hash = `${PPXQ_LINK_HASH_PREFIX}${encodeBase37Upper(encodeEncryptedQrText(object))}`;
  return base.toString();
}

export function extractQrMessageBytes(text: string): Uint8Array {
  let encoded: string;
  if (text.startsWith(PPXQ_MESSAGE_PREFIX)) {
    encoded = text.slice(PPXQ_MESSAGE_PREFIX.length);
  } else {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      throw new PPXError("noncanonical-text");
    }
    if (
      url.protocol !== "https:" ||
      !url.hash.startsWith(PPXQ_LINK_HASH_PREFIX)
    ) {
      throw new PPXError("noncanonical-text");
    }
    encoded = url.hash.slice(PPXQ_LINK_HASH_PREFIX.length);
    if (
      !encoded ||
      encoded.includes("/") ||
      encoded.includes("?") ||
      encoded.includes("#")
    ) {
      throw new PPXError("noncanonical-text");
    }
  }
  const bytes = decodeBase37Upper(encoded, PPXQ_MAXIMUM_OBJECT_SIZE);
  parseEncryptedQrText(bytes);
  return bytes;
}

export function parseQrMessageText(text: string): EncryptedQrTextObject {
  return parseEncryptedQrText(extractQrMessageBytes(text));
}

export * from "./ppxq-inner";
export * from "./ppxq-outer";
