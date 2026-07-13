import { PPXError } from "./types";

const encoder = new TextEncoder();
const MIME = /^[\x21-\x7e]*$/u;

function containsForbiddenUnicode(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) as number;
    return (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      (codePoint >= 0x2028 && codePoint <= 0x202e) ||
      (codePoint >= 0x2066 && codePoint <= 0x2069)
    );
  });
}

function byteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

function requireByteRange(
  value: string,
  minimum: number,
  maximum: number,
): string {
  const length = byteLength(value);
  if (length < minimum || length > maximum)
    throw new PPXError("impossible-length");
  return value;
}

function normalizeVisibleText(input: string): string {
  const value = input.normalize("NFKC").trim();
  if (containsForbiddenUnicode(value)) throw new PPXError("noncanonical-text");
  return value;
}

export function normalizePseudonym(input: string): string {
  return requireByteRange(normalizeVisibleText(input), 1, 48);
}

export function normalizeFilename(input: string): string {
  const value = normalizeVisibleText(input).replaceAll(/[/\\]/gu, "_");
  return requireByteRange(value, 1, 255);
}

export function normalizeMimeHint(input: string): string {
  const value = input.trim();
  if (!MIME.test(value)) throw new PPXError("noncanonical-text");
  return requireByteRange(value, 0, 127);
}

export function normalizeCaption(input: string): string {
  const value = input.normalize("NFKC");
  if (containsForbiddenUnicode(value)) throw new PPXError("noncanonical-text");
  return requireByteRange(value, 0, 16_384);
}
