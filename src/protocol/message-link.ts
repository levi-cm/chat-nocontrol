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
export const LEGACY_QR_LINK_MAX_ENCODED_CHARS = Math.ceil(
  PPXQ_MAXIMUM_OBJECT_SIZE * (8 / Math.log2(37)),
);
const MESSAGE_LINK_HASH_STEM = MESSAGE_LINK_HASH_PREFIX.slice(0, -1);
const LEGACY_QR_LINK_HASH_STEM = PPXQ_LINK_HASH_PREFIX.slice(0, -1);

export interface MessageLinkLocation {
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
  readonly username: string;
  readonly password: string;
}

export interface MessageLinkHistory {
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

function sameOriginAbsolutePath(pathname: string): string {
  return `/${pathname.replace(/^[\\/]+/u, "")}`;
}

function isReservedHashFamily(hash: string, stem: string): boolean {
  return hash === stem || hash.startsWith(`${stem}/`);
}

export function isReservedMessageLinkHash(hash: string): boolean {
  return (
    isReservedHashFamily(hash, MESSAGE_LINK_HASH_STEM) ||
    isReservedHashFamily(hash, LEGACY_QR_LINK_HASH_STEM)
  );
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
  const { pathname, search, hash, username, password } = location;
  const isMessageLink = isReservedHashFamily(hash, MESSAGE_LINK_HASH_STEM);
  if (!isReservedMessageLinkHash(hash)) return null;

  history.replaceState(
    null,
    "",
    `${sameOriginAbsolutePath(pathname)}#/decrypt`,
  );
  if (search !== "" || username !== "" || password !== "") {
    return { kind: "invalid" };
  }

  try {
    if (isMessageLink) {
      return { ...parseMessageLinkHash(hash), capturedAt };
    }
    const encodedLength = hash.length - PPXQ_LINK_HASH_PREFIX.length;
    if (
      encodedLength <= 0 ||
      encodedLength > LEGACY_QR_LINK_MAX_ENCODED_CHARS
    ) {
      return { kind: "invalid" };
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
