import type { DerivedIdentity, HybridEncapsulation } from "../protocol/types";
import { PPXError } from "../protocol/types";
import {
  deriveHkdfSha512,
  mlKem512Decapsulate,
  mlKem512Encapsulate,
  sha512Digest,
  x25519PublicKey,
  x25519SharedSecret,
} from "./noble-provider";
import { zeroize } from "./zeroize";

const encoder = new TextEncoder();

export interface HybridEncapsulationPrimitives {
  publicKey: typeof x25519PublicKey;
  encapsulate: typeof mlKem512Encapsulate;
  sharedSecret: typeof x25519SharedSecret;
  deriveKey: typeof deriveHybridKey;
}

const defaultHybridEncapsulationPrimitives: HybridEncapsulationPrimitives = {
  publicKey: x25519PublicKey,
  encapsulate: mlKem512Encapsulate,
  sharedSecret: x25519SharedSecret,
  deriveKey: deriveHybridKey,
};

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

export function deriveHybridKey(input: {
  recipientFingerprint: Uint8Array;
  salt: Uint8Array;
  ephemeralX25519PublicKey: Uint8Array;
  mlKemCiphertext: Uint8Array;
  x25519SharedSecret: Uint8Array;
  mlKemSharedSecret: Uint8Array;
}): Uint8Array {
  if (
    input.recipientFingerprint.byteLength !== 32 ||
    input.salt.byteLength !== 32 ||
    input.ephemeralX25519PublicKey.byteLength !== 32 ||
    input.mlKemCiphertext.byteLength !== 768 ||
    input.x25519SharedSecret.byteLength !== 32 ||
    input.mlKemSharedSecret.byteLength !== 32
  ) {
    throw new PPXError("invalid-hybrid-encapsulation");
  }
  const transcript = concatBytes(
    input.mlKemCiphertext,
    input.ephemeralX25519PublicKey,
  );
  const transcriptDigest = sha512Digest(transcript);
  const info = concatBytes(
    encoder.encode("PPX/ENCRYPT/V1/HYBRID"),
    Uint8Array.of(1),
    input.recipientFingerprint,
    transcriptDigest,
  );
  const ikm = concatBytes(input.mlKemSharedSecret, input.x25519SharedSecret);
  try {
    return deriveHkdfSha512(ikm, input.salt, info, 32);
  } finally {
    zeroize(ikm, transcript, transcriptDigest, info);
  }
}

export function encapsulateHybrid(
  recipient: {
    recipientFingerprint: Uint8Array;
    recipientKemPublicKey: Uint8Array;
    recipientX25519PublicKey: Uint8Array;
  },
  primitives: HybridEncapsulationPrimitives = defaultHybridEncapsulationPrimitives,
): HybridEncapsulation {
  if (
    recipient.recipientFingerprint.byteLength !== 32 ||
    recipient.recipientKemPublicKey.byteLength !== 800 ||
    recipient.recipientX25519PublicKey.byteLength !== 32
  ) {
    throw new PPXError("invalid-hybrid-encapsulation");
  }
  let ephemeralSecret: Uint8Array | undefined;
  let salt: Uint8Array | undefined;
  let mlKemSharedSecret: Uint8Array | undefined;
  let xShared: Uint8Array | undefined;
  let aes256Key: Uint8Array | undefined;
  let transferred = false;
  try {
    ephemeralSecret = crypto.getRandomValues(new Uint8Array(32));
    salt = crypto.getRandomValues(new Uint8Array(32));
    const ephemeralX25519PublicKey = primitives.publicKey(ephemeralSecret);
    const kem = primitives.encapsulate(recipient.recipientKemPublicKey);
    mlKemSharedSecret = kem.sharedSecret;
    xShared = primitives.sharedSecret(
      ephemeralSecret,
      recipient.recipientX25519PublicKey,
    );
    aes256Key = primitives.deriveKey({
      recipientFingerprint: recipient.recipientFingerprint,
      salt,
      ephemeralX25519PublicKey,
      mlKemCiphertext: kem.cipherText,
      x25519SharedSecret: xShared,
      mlKemSharedSecret,
    });
    const output: HybridEncapsulation = {
      suite: 1,
      recipientFingerprint: recipient.recipientFingerprint,
      salt,
      ephemeralX25519PublicKey,
      mlKemCiphertext: kem.cipherText,
      x25519SharedSecret: xShared,
      mlKemSharedSecret,
      aes256Key,
    };
    transferred = true;
    return output;
  } catch {
    throw new PPXError("invalid-hybrid-encapsulation");
  } finally {
    if (ephemeralSecret) zeroize(ephemeralSecret);
    if (!transferred) {
      if (salt) zeroize(salt);
      if (mlKemSharedSecret) zeroize(mlKemSharedSecret);
      if (xShared) zeroize(xShared);
      if (aes256Key) zeroize(aes256Key);
    }
  }
}

export function decapsulateHybrid(input: {
  activeIdentity: DerivedIdentity;
  mlKemCiphertext: Uint8Array;
  ephemeralX25519PublicKey: Uint8Array;
  salt: Uint8Array;
}): Uint8Array {
  let mlKemSharedSecret: Uint8Array | undefined;
  let xShared: Uint8Array | undefined;
  try {
    mlKemSharedSecret = mlKem512Decapsulate(
      input.mlKemCiphertext,
      input.activeIdentity.kemSecretKey,
    );
    xShared = x25519SharedSecret(
      input.activeIdentity.x25519SecretKey,
      input.ephemeralX25519PublicKey,
    );
    return deriveHybridKey({
      recipientFingerprint: input.activeIdentity.fingerprint,
      salt: input.salt,
      ephemeralX25519PublicKey: input.ephemeralX25519PublicKey,
      mlKemCiphertext: input.mlKemCiphertext,
      x25519SharedSecret: xShared,
      mlKemSharedSecret,
    });
  } catch {
    throw new PPXError("invalid-hybrid-encapsulation");
  } finally {
    if (mlKemSharedSecret) zeroize(mlKemSharedSecret);
    if (xShared) zeroize(xShared);
  }
}
