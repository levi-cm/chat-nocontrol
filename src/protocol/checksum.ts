import { sha512 } from "@noble/hashes/sha2.js";

export function checksum16(bytes: Uint8Array): Uint8Array {
  return sha512(bytes).slice(0, 16);
}

export function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left[index] as number) ^ (right[index] as number);
  }
  return difference === 0;
}
