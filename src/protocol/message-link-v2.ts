import { decodeBase64UrlNoPad, encodeBase64UrlNoPad } from "./base64url";
import {
  encodeEncryptedTextOuterV2,
  parseEncryptedTextOuterV2,
  PPX_TEXT_V2_MAXIMUM_OBJECT_SIZE,
} from "./text-v2-outer";
import { PPXError } from "./types";
import type { EncryptedTextObjectV2 } from "./types-v2";

export type MessageLinkObjectV2 =
  | { kind: "ppxt"; object: EncryptedTextObjectV2 }
  | { kind: "ppxm"; object: EncryptedTextObjectV2 };

export type IncomingMessageIntentV2 =
  (MessageLinkObjectV2 & { capturedAt: number }) | { kind: "invalid" };

export const MESSAGE_LINK_V2_HASH_PREFIX = "#/m/";
export const MESSAGE_LINK_V2_MAX_ENCODED_CHARS = Math.ceil(
  (PPX_TEXT_V2_MAXIMUM_OBJECT_SIZE * 4) / 3,
);

export interface MessageLinkLocationV2 {
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
  readonly username: string;
  readonly password: string;
}

export interface MessageLinkHistoryV2 {
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

function sameOriginAbsolutePath(pathname: string): string {
  return `/${pathname.replace(/^[\\/]+/u, "")}`;
}

export function encodeMessageLinkV2(
  value: MessageLinkObjectV2,
  appBase: string,
): string {
  const base = new URL(appBase);
  if (
    base.protocol !== "https:" ||
    base.username !== "" ||
    base.password !== "" ||
    base.search !== "" ||
    (value.kind === "ppxt" && value.object.magic !== "PPXT") ||
    (value.kind === "ppxm" && value.object.magic !== "PPXM")
  ) {
    throw new PPXError("noncanonical-text");
  }
  const bytes = encodeEncryptedTextOuterV2(value.object);
  base.hash = `${MESSAGE_LINK_V2_HASH_PREFIX}${encodeBase64UrlNoPad(bytes)}`;
  return base.toString();
}

export function parseMessageLinkHashV2(hash: string): MessageLinkObjectV2 {
  if (!hash.startsWith(MESSAGE_LINK_V2_HASH_PREFIX)) {
    throw new PPXError("noncanonical-text");
  }
  const encoded = hash.slice(MESSAGE_LINK_V2_HASH_PREFIX.length);
  if (
    encoded.length === 0 ||
    encoded.length > MESSAGE_LINK_V2_MAX_ENCODED_CHARS ||
    !/^[A-Za-z0-9_-]+$/u.test(encoded)
  ) {
    throw new PPXError("noncanonical-text");
  }
  const bytes = decodeBase64UrlNoPad(encoded);
  const magic = new TextDecoder().decode(bytes.slice(0, 4));
  if (magic !== "PPXT" && magic !== "PPXM") {
    throw new PPXError("noncanonical-text");
  }
  const object = parseEncryptedTextOuterV2(bytes, magic);
  return { kind: magic === "PPXT" ? "ppxt" : "ppxm", object };
}

export function captureIncomingMessageIntentV2(
  location: MessageLinkLocationV2,
  history: MessageLinkHistoryV2,
  capturedAt: number,
): IncomingMessageIntentV2 | null {
  const { pathname, search, hash, username, password } = location;
  if (!hash.startsWith(MESSAGE_LINK_V2_HASH_PREFIX)) return null;
  history.replaceState(
    null,
    "",
    `${sameOriginAbsolutePath(pathname)}#/decrypt`,
  );
  if (search !== "" || username !== "" || password !== "") {
    return { kind: "invalid" };
  }
  try {
    return { ...parseMessageLinkHashV2(hash), capturedAt };
  } catch {
    return { kind: "invalid" };
  }
}
