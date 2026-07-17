import { PPXError } from "../protocol/types";
import {
  PPX_PQ_5_SUITE,
  PPX_V2_FORMAT_VERSION,
  type DecapsulationCapabilityV2,
  isObjectFamilyV2,
  type MlKemEncapsulationV2,
  type ObjectFamilyV2,
} from "../protocol/types-v2";
import { deriveHkdfSha512, sha512Digest } from "./noble-provider";
import { mlKem1024Decapsulate, mlKem1024Encapsulate } from "./pq-provider-v2";
import { zeroize } from "./zeroize";

const encoder = new TextEncoder();
export const V2_ML_KEM_KEY_DOMAIN = "PPX/ENCRYPT/V2/ML-KEM-1024";

export interface MlKemV2EncapsulationPrimitives {
  encapsulate: typeof mlKem1024Encapsulate;
  randomBytes: (length: number) => Uint8Array;
}

const defaultEncapsulationPrimitives: MlKemV2EncapsulationPrimitives = {
  encapsulate: mlKem1024Encapsulate,
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
};

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    parts.reduce((length, part) => length + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function validateMetadata(input: {
  objectFamily: ObjectFamilyV2;
  recipientFingerprint: Uint8Array;
  salt: Uint8Array;
  mlKemCiphertext: Uint8Array;
}): void {
  if (
    !isObjectFamilyV2(input.objectFamily) ||
    input.recipientFingerprint.byteLength !== 32 ||
    input.salt.byteLength !== 32 ||
    input.mlKemCiphertext.byteLength !== 1568
  ) {
    throw new PPXError("invalid-hybrid-encapsulation");
  }
}

export function deriveMlKemKeyV2(input: {
  objectFamily: ObjectFamilyV2;
  recipientFingerprint: Uint8Array;
  salt: Uint8Array;
  mlKemCiphertext: Uint8Array;
  mlKemSharedSecret: Uint8Array;
}): Uint8Array {
  validateMetadata(input);
  if (input.mlKemSharedSecret.byteLength !== 32) {
    throw new PPXError("invalid-hybrid-encapsulation");
  }
  let transcriptDigest: Uint8Array | undefined;
  let info: Uint8Array | undefined;
  try {
    transcriptDigest = sha512Digest(input.mlKemCiphertext);
    info = concatBytes(
      encoder.encode(V2_ML_KEM_KEY_DOMAIN),
      Uint8Array.of(input.objectFamily, PPX_V2_FORMAT_VERSION, PPX_PQ_5_SUITE),
      input.recipientFingerprint,
      transcriptDigest,
    );
    return deriveHkdfSha512(input.mlKemSharedSecret, input.salt, info, 32);
  } finally {
    if (transcriptDigest) zeroize(transcriptDigest);
    if (info) zeroize(info);
  }
}

export function encapsulateMlKemV2(
  recipient: {
    objectFamily: ObjectFamilyV2;
    recipientFingerprint: Uint8Array;
    recipientKemPublicKey: Uint8Array;
  },
  primitives: MlKemV2EncapsulationPrimitives = defaultEncapsulationPrimitives,
): MlKemEncapsulationV2 {
  if (
    recipient.recipientFingerprint.byteLength !== 32 ||
    recipient.recipientKemPublicKey.byteLength !== 1568
  ) {
    throw new PPXError("invalid-hybrid-encapsulation");
  }
  let salt: Uint8Array | undefined;
  let sharedSecret: Uint8Array | undefined;
  let aes256Key: Uint8Array | undefined;
  let transferred = false;
  try {
    salt = primitives.randomBytes(32);
    if (salt.byteLength !== 32) {
      throw new PPXError("invalid-hybrid-encapsulation");
    }
    const kem = primitives.encapsulate(recipient.recipientKemPublicKey);
    sharedSecret = kem.sharedSecret;
    aes256Key = deriveMlKemKeyV2({
      objectFamily: recipient.objectFamily,
      recipientFingerprint: recipient.recipientFingerprint,
      salt,
      mlKemCiphertext: kem.cipherText,
      mlKemSharedSecret: sharedSecret,
    });
    const output: MlKemEncapsulationV2 = {
      formatVersion: PPX_V2_FORMAT_VERSION,
      suite: PPX_PQ_5_SUITE,
      objectFamily: recipient.objectFamily,
      recipientFingerprint: Uint8Array.from(recipient.recipientFingerprint),
      salt: Uint8Array.from(salt),
      mlKemCiphertext: kem.cipherText,
      aes256Key,
    };
    transferred = true;
    return output;
  } catch {
    throw new PPXError("invalid-hybrid-encapsulation");
  } finally {
    if (salt) zeroize(salt);
    if (sharedSecret) zeroize(sharedSecret);
    if (!transferred && aes256Key) zeroize(aes256Key);
  }
}

export function decapsulateMlKemV2(input: {
  objectFamily: ObjectFamilyV2;
  activeIdentity: DecapsulationCapabilityV2;
  mlKemCiphertext: Uint8Array;
  salt: Uint8Array;
}): Uint8Array {
  validateMetadata({
    objectFamily: input.objectFamily,
    recipientFingerprint: input.activeIdentity.fingerprint,
    salt: input.salt,
    mlKemCiphertext: input.mlKemCiphertext,
  });
  if (
    input.activeIdentity.suite !== PPX_PQ_5_SUITE ||
    input.activeIdentity.kemSecretKey.byteLength !== 3168
  ) {
    throw new PPXError("invalid-hybrid-encapsulation");
  }
  let sharedSecret: Uint8Array | undefined;
  try {
    sharedSecret = mlKem1024Decapsulate(
      input.mlKemCiphertext,
      input.activeIdentity.kemSecretKey,
    );
    return deriveMlKemKeyV2({
      objectFamily: input.objectFamily,
      recipientFingerprint: input.activeIdentity.fingerprint,
      salt: input.salt,
      mlKemCiphertext: input.mlKemCiphertext,
      mlKemSharedSecret: sharedSecret,
    });
  } catch {
    throw new PPXError("invalid-hybrid-encapsulation");
  } finally {
    if (sharedSecret) zeroize(sharedSecret);
  }
}
