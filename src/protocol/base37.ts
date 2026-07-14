import { PPXError } from "./types";

export const BASE37_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-";
const BASE = 37n;
const indexByCharacter = new Map(
  [...BASE37_ALPHABET].map((character, index) => [character, BigInt(index)]),
);

export function encodeBase37Upper(bytes: Uint8Array): string {
  if (bytes.byteLength === 0) return "";
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.byteLength && bytes[leadingZeroes] === 0) {
    leadingZeroes += 1;
  }
  let value = 0n;
  for (let index = leadingZeroes; index < bytes.byteLength; index += 1) {
    value = (value << 8n) | BigInt(bytes[index] as number);
  }
  let encoded = "";
  while (value > 0n) {
    encoded = BASE37_ALPHABET[Number(value % BASE)] + encoded;
    value /= BASE;
  }
  return "0".repeat(leadingZeroes) + encoded;
}

export function decodeBase37Upper(
  text: string,
  maximumBytes: number,
): Uint8Array {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
    throw new PPXError("impossible-length");
  }
  if (text === "") return new Uint8Array();
  if (![...text].every((character) => indexByCharacter.has(character))) {
    throw new PPXError("noncanonical-text");
  }
  let leadingZeroes = 0;
  while (leadingZeroes < text.length && text[leadingZeroes] === "0") {
    leadingZeroes += 1;
  }
  const numericDigits = text.length - leadingZeroes;
  const maximumNumericDigits = Math.ceil(
    Math.max(0, maximumBytes - leadingZeroes) * (8 / Math.log2(37)),
  );
  if (leadingZeroes > maximumBytes || numericDigits > maximumNumericDigits) {
    throw new PPXError("oversize-before-allocation");
  }
  let value = 0n;
  for (let index = leadingZeroes; index < text.length; index += 1) {
    value =
      value * BASE + (indexByCharacter.get(text[index] as string) as bigint);
  }
  const reversed: number[] = [];
  while (value > 0n) {
    reversed.push(Number(value & 0xffn));
    value >>= 8n;
    if (leadingZeroes + reversed.length > maximumBytes) {
      throw new PPXError("oversize-before-allocation");
    }
  }
  const output = new Uint8Array(leadingZeroes + reversed.length);
  for (let index = 0; index < reversed.length; index += 1) {
    output[output.length - 1 - index] = reversed[index] as number;
  }
  if (encodeBase37Upper(output) !== text)
    throw new PPXError("noncanonical-text");
  return output;
}
