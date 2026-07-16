import { decodeBase64UrlNoPad, encodeBase64UrlNoPad } from "./base64url";
import { decodeBase37Upper } from "./base37";
import { PPXQ_LINK_HASH_PREFIX } from "./ppxq";
import {
  encodeEncryptedQrText,
  parseEncryptedQrText,
  PPXQ_MAXIMUM_OBJECT_SIZE,
} from "./ppxq-outer";
import {
  encodeEncryptedTextOuter,
  parseEncryptedTextOuter,
  PPXT_MAXIMUM_OBJECT_SIZE,
} from "./ppxt-outer";
import type { EncryptedQrTextObject, EncryptedTextObject } from "./types";
import { PPXError } from "./types";

export type MessageLinkObject =
  | { kind: "ppxt"; object: EncryptedTextObject }
  | { kind: "ppxq"; object: EncryptedQrTextObject };

export type IncomingMessageIntent =
  (MessageLinkObject & { capturedAt: number }) | { kind: "invalid" };

export const MESSAGE_LINK_HASH_PREFIX = "#/m/";
export const MESSAGE_LINK_MAX_ENCODED_CHARS = Math.ceil(
  (PPXT_MAXIMUM_OBJECT_SIZE * 4) / 3,
);

export interface MessageLinkLocation {
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

export interface MessageLinkHistory {
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

export function encodeMessageLink(
  value: MessageLinkObject,
  appBase: string,
): string {
  const base = new URL(appBase);
  if (
    base.protocol !== "https:" ||
    base.username !== "" ||
    base.password !== "" ||
    base.search !== ""
  ) {
    throw new PPXError("noncanonical-text");
  }
  const bytes =
    value.kind === "ppxt"
      ? encodeEncryptedTextOuter(value.object)
      : encodeEncryptedQrText(value.object);
  base.hash = `${MESSAGE_LINK_HASH_PREFIX}${encodeBase64UrlNoPad(bytes)}`;
  return base.toString();
}

export function parseMessageLinkHash(hash: string): MessageLinkObject {
  if (!hash.startsWith(MESSAGE_LINK_HASH_PREFIX)) {
    throw new PPXError("noncanonical-text");
  }
  const encoded = hash.slice(MESSAGE_LINK_HASH_PREFIX.length);
  if (
    encoded.length === 0 ||
    encoded.length > MESSAGE_LINK_MAX_ENCODED_CHARS ||
    !/^[A-Za-z0-9_-]+$/u.test(encoded)
  ) {
    throw new PPXError("noncanonical-text");
  }
  const bytes = decodeBase64UrlNoPad(encoded);
  const magic = String.fromCharCode(...bytes.slice(0, 4));
  if (magic === "PPXT") {
    return { kind: "ppxt", object: parseEncryptedTextOuter(bytes) };
  }
  if (magic === "PPXQ") {
    return { kind: "ppxq", object: parseEncryptedQrText(bytes) };
  }
  throw new PPXError("noncanonical-text");
}

export function captureIncomingMessageIntent(
  location: MessageLinkLocation,
  history: MessageLinkHistory,
  capturedAt: number,
): IncomingMessageIntent | null {
  const { pathname, search, hash } = location;
  const isMessageLink = hash.startsWith(MESSAGE_LINK_HASH_PREFIX);
  const isLegacyQrLink = hash.startsWith(PPXQ_LINK_HASH_PREFIX);
  if (!isMessageLink && !isLegacyQrLink) return null;

  history.replaceState(null, "", `${pathname}#/decrypt`);
  if (search !== "") return { kind: "invalid" };

  try {
    if (isMessageLink) {
      return { ...parseMessageLinkHash(hash), capturedAt };
    }
    const encoded = hash.slice(PPXQ_LINK_HASH_PREFIX.length);
    const bytes = decodeBase37Upper(encoded, PPXQ_MAXIMUM_OBJECT_SIZE);
    return {
      kind: "ppxq",
      object: parseEncryptedQrText(bytes),
      capturedAt,
    };
  } catch {
    return { kind: "invalid" };
  }
}
