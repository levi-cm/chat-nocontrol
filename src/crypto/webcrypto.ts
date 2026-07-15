import { gcm } from "@noble/ciphers/aes.js";
import { PPXError } from "../protocol/types";
import { zeroize } from "./zeroize";

function requireLength(bytes: Uint8Array, length: number): void {
  if (bytes.byteLength !== length) throw new PPXError("impossible-length");
}

function ownedBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes);
}

async function importAesKey(
  key: Uint8Array,
  subtle: SubtleCrypto,
): Promise<CryptoKey> {
  requireLength(key, 32);
  const ownedKey = ownedBytes(key);
  try {
    return await subtle.importKey("raw", ownedKey.buffer, "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]);
  } finally {
    zeroize(ownedKey);
  }
}

export async function encryptAesGcm(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  additionalData?: Uint8Array,
  subtle: SubtleCrypto | null = getWebCryptoSubtle(),
): Promise<Uint8Array> {
  requireLength(nonce, 12);
  const ownedNonce = ownedBytes(nonce);
  const ownedPlaintext = ownedBytes(plaintext);
  const ownedAdditionalData = additionalData
    ? ownedBytes(additionalData)
    : undefined;
  try {
    if (!subtle) {
      if (__CHAT_NOCONTROL_PRODUCTION_BUILD__) {
        throw new Error("webcrypto-unavailable");
      }
      const ownedKey = ownedBytes(key);
      try {
        return gcm(ownedKey, ownedNonce, ownedAdditionalData).encrypt(
          ownedPlaintext,
        );
      } finally {
        zeroize(ownedKey);
      }
    }
    const encrypted = await subtle.encrypt(
      {
        name: "AES-GCM",
        iv: ownedNonce.buffer,
        additionalData: ownedAdditionalData?.buffer,
        tagLength: 128,
      },
      await importAesKey(key, subtle),
      ownedPlaintext.buffer,
    );
    return new Uint8Array(encrypted);
  } finally {
    zeroize(ownedNonce);
    zeroize(ownedPlaintext);
    if (ownedAdditionalData) zeroize(ownedAdditionalData);
  }
}

export async function decryptAesGcm(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  additionalData?: Uint8Array,
  subtle: SubtleCrypto | null = getWebCryptoSubtle(),
): Promise<Uint8Array> {
  requireLength(nonce, 12);
  const ownedNonce = ownedBytes(nonce);
  const ownedCiphertext = ownedBytes(ciphertext);
  const ownedAdditionalData = additionalData
    ? ownedBytes(additionalData)
    : undefined;
  try {
    if (!subtle) {
      if (__CHAT_NOCONTROL_PRODUCTION_BUILD__) {
        throw new Error("webcrypto-unavailable");
      }
      const ownedKey = ownedBytes(key);
      try {
        return gcm(ownedKey, ownedNonce, ownedAdditionalData).decrypt(
          ownedCiphertext,
        );
      } finally {
        zeroize(ownedKey);
      }
    }
    const plaintext = await subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ownedNonce.buffer,
        additionalData: ownedAdditionalData?.buffer,
        tagLength: 128,
      },
      await importAesKey(key, subtle),
      ownedCiphertext.buffer,
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new PPXError("invalid-aead");
  } finally {
    zeroize(ownedNonce);
    zeroize(ownedCiphertext);
    if (ownedAdditionalData) zeroize(ownedAdditionalData);
  }
}

export function getWebCryptoSubtle(): SubtleCrypto | null {
  return globalThis.crypto?.subtle ?? null;
}
