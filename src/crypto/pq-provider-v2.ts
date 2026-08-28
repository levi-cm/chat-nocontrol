import { ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import { PPXError } from "../protocol/types";

export const ML_KEM_1024_PUBLIC_KEY_BYTES = 1568;
export const ML_KEM_1024_SECRET_KEY_BYTES = 3168;
export const ML_KEM_1024_CIPHERTEXT_BYTES = 1568;
export const ML_KEM_SHARED_SECRET_BYTES = 32;
export const ML_DSA_87_PUBLIC_KEY_BYTES = 2592;
export const ML_DSA_87_SECRET_KEY_BYTES = 4896;
export const ML_DSA_87_SIGNATURE_BYTES = 4627;
export const ML_DSA_87_ENTROPY_BYTES = 32;

function requireLength(bytes: Uint8Array, length: number): void {
  if (bytes.byteLength !== length) throw new PPXError("impossible-length");
}

function requireContext(context: Uint8Array): void {
  if (context.byteLength > 255) throw new PPXError("impossible-length");
}

export function mlKem1024Keygen(seed?: Uint8Array) {
  if (seed) requireLength(seed, 64);
  const keys = ml_kem1024.keygen(seed);
  requireLength(keys.publicKey, ML_KEM_1024_PUBLIC_KEY_BYTES);
  requireLength(keys.secretKey, ML_KEM_1024_SECRET_KEY_BYTES);
  return keys;
}

export function mlKem1024Encapsulate(
  publicKey: Uint8Array,
  randomness?: Uint8Array,
) {
  requireLength(publicKey, ML_KEM_1024_PUBLIC_KEY_BYTES);
  if (randomness) requireLength(randomness, 32);
  const result = ml_kem1024.encapsulate(publicKey, randomness);
  requireLength(result.cipherText, ML_KEM_1024_CIPHERTEXT_BYTES);
  requireLength(result.sharedSecret, ML_KEM_SHARED_SECRET_BYTES);
  return result;
}

export function mlKem1024Decapsulate(
  ciphertext: Uint8Array,
  secretKey: Uint8Array,
): Uint8Array {
  requireLength(ciphertext, ML_KEM_1024_CIPHERTEXT_BYTES);
  requireLength(secretKey, ML_KEM_1024_SECRET_KEY_BYTES);
  const sharedSecret = ml_kem1024.decapsulate(ciphertext, secretKey);
  requireLength(sharedSecret, ML_KEM_SHARED_SECRET_BYTES);
  return sharedSecret;
}

export function mlDsa87Keygen(seed?: Uint8Array) {
  if (seed) requireLength(seed, 32);
  const keys = ml_dsa87.keygen(seed);
  requireLength(keys.publicKey, ML_DSA_87_PUBLIC_KEY_BYTES);
  requireLength(keys.secretKey, ML_DSA_87_SECRET_KEY_BYTES);
  return keys;
}

export function mlDsa87PublicKeyFromSecret(secretKey: Uint8Array): Uint8Array {
  requireLength(secretKey, ML_DSA_87_SECRET_KEY_BYTES);
  const publicKey = ml_dsa87.getPublicKey(secretKey);
  requireLength(publicKey, ML_DSA_87_PUBLIC_KEY_BYTES);
  return publicKey;
}

export function mlDsa87Sign(
  message: Uint8Array,
  secretKey: Uint8Array,
  context: Uint8Array,
  extraEntropy: Uint8Array,
): Uint8Array {
  requireLength(secretKey, ML_DSA_87_SECRET_KEY_BYTES);
  requireContext(context);
  requireLength(extraEntropy, ML_DSA_87_ENTROPY_BYTES);
  const signature = ml_dsa87.sign(message, secretKey, {
    context,
    extraEntropy,
  });
  requireLength(signature, ML_DSA_87_SIGNATURE_BYTES);
  return signature;
}

export function mlDsa87Verify(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
  context: Uint8Array,
): boolean {
  requireLength(signature, ML_DSA_87_SIGNATURE_BYTES);
  requireLength(publicKey, ML_DSA_87_PUBLIC_KEY_BYTES);
  requireContext(context);
  return ml_dsa87.verify(signature, message, publicKey, { context });
}
