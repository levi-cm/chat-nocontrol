import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { sha512 } from "@noble/hashes/sha2.js";
import { ml_kem512 } from "@noble/post-quantum/ml-kem.js";

export function sha512Digest(input: Uint8Array): Uint8Array {
  return sha512(input);
}

export function deriveHkdfSha512(
  inputKeyMaterial: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Uint8Array {
  return hkdf(sha512, inputKeyMaterial, salt, info, length);
}

export async function deriveVaultKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  return scryptAsync(passphrase, salt, {
    N: 65_536,
    r: 8,
    p: 2,
    dkLen: 32,
    maxmem: 256 * 1024 * 1024,
  });
}

export function x25519PublicKey(secretKey: Uint8Array): Uint8Array {
  return x25519.getPublicKey(secretKey);
}

export function x25519SharedSecret(
  secretKey: Uint8Array,
  publicKey: Uint8Array,
): Uint8Array {
  return x25519.getSharedSecret(secretKey, publicKey);
}

export function ed25519PublicKey(secretKey: Uint8Array): Uint8Array {
  return ed25519.getPublicKey(secretKey);
}

export function signEd25519(
  message: Uint8Array,
  secretKey: Uint8Array,
): Uint8Array {
  return ed25519.sign(message, secretKey);
}

export function verifyEd25519(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  return ed25519.verify(signature, message, publicKey, { zip215: false });
}

export function mlKem512Keygen(seed?: Uint8Array) {
  return ml_kem512.keygen(seed);
}

export function mlKem512Encapsulate(
  publicKey: Uint8Array,
  randomness?: Uint8Array,
) {
  return ml_kem512.encapsulate(publicKey, randomness);
}

export function mlKem512Decapsulate(
  ciphertext: Uint8Array,
  secretKey: Uint8Array,
): Uint8Array {
  return ml_kem512.decapsulate(ciphertext, secretKey);
}
