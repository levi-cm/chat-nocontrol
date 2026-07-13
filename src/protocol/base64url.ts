import { PPXError } from "./types";

const CANONICAL_BASE64URL = /^[A-Za-z0-9_-]*$/u;

export function encodeBase64UrlNoPad(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function decodeBase64UrlNoPad(text: string): Uint8Array {
  if (!CANONICAL_BASE64URL.test(text) || text.length % 4 === 1) {
    throw new PPXError("noncanonical-text");
  }
  const padded = text
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(text.length + ((4 - (text.length % 4)) % 4), "=");
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new PPXError("noncanonical-text");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (encodeBase64UrlNoPad(bytes) !== text)
    throw new PPXError("noncanonical-text");
  return bytes;
}

export function wrapBase64Url(text: string, width = 72): string {
  if (
    !Number.isSafeInteger(width) ||
    width <= 0 ||
    !CANONICAL_BASE64URL.test(text)
  ) {
    throw new PPXError("noncanonical-text");
  }
  return text.match(new RegExp(`.{1,${width}}`, "gu"))?.join("\n") ?? "";
}
