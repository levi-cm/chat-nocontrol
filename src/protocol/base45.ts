import { PPXError } from "./types";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const VALUES = new Map(
  [...ALPHABET].map((character, value) => [character, value]),
);

export function encodeBase45Upper(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 2) {
    if (index + 1 < bytes.length) {
      let value = (bytes[index] as number) * 256 + (bytes[index + 1] as number);
      output += ALPHABET[value % 45];
      value = Math.floor(value / 45);
      output += ALPHABET[value % 45];
      output += ALPHABET[Math.floor(value / 45)];
    } else {
      const value = bytes[index] as number;
      output += ALPHABET[value % 45];
      output += ALPHABET[Math.floor(value / 45)];
    }
  }
  return output;
}

export function decodeBase45Upper(text: string): Uint8Array {
  if (text.length % 3 === 1) throw new PPXError("impossible-length");
  const output: number[] = [];
  for (let index = 0; index < text.length;) {
    const remaining = text.length - index;
    const width = remaining >= 3 ? 3 : 2;
    const c = VALUES.get(text[index] as string);
    const d = VALUES.get(text[index + 1] as string);
    const e = width === 3 ? VALUES.get(text[index + 2] as string) : 0;
    if (c === undefined || d === undefined || e === undefined) {
      throw new PPXError("noncanonical-text");
    }
    const value = c + d * 45 + e * 45 * 45;
    if ((width === 3 && value > 0xffff) || (width === 2 && value > 0xff)) {
      throw new PPXError("noncanonical-text");
    }
    if (width === 3) output.push(Math.floor(value / 256), value % 256);
    else output.push(value);
    index += width;
  }
  const bytes = Uint8Array.from(output);
  if (encodeBase45Upper(bytes) !== text)
    throw new PPXError("noncanonical-text");
  return bytes;
}
