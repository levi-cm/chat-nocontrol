import { sha512 } from "@noble/hashes/sha2.js";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { deriveMlKemKeyV2 } from "../../crypto/kem-v2";
import {
  createPublicContactV2,
  encodePublicContactV2,
} from "../../protocol/ppxc-v2";
import { ObjectFamilyV2 } from "../../protocol/types-v2";

const hex = (value: Uint8Array) =>
  [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export const cat5GoldenInputs = {
  masterEntropy: Uint8Array.from({ length: 32 }, (_, index) => index),
  recipientFingerprint: Uint8Array.from(
    { length: 32 },
    (_, index) => 0x20 + index,
  ),
  salt: Uint8Array.from({ length: 32 }, (_, index) => 0x60 + index),
  mlKemSharedSecret: Uint8Array.from(
    { length: 32 },
    (_, index) => 0xc0 + index,
  ),
  mlKemCiphertext: Uint8Array.from(
    { length: 1568 },
    (_, index) => (index * 29 + 7) & 0xff,
  ),
  signatureEntropy: Uint8Array.from({ length: 32 }, (_, index) => 0xa0 + index),
  pseudonym: "Cat5 Golden",
  creationTime: 0x0102_0304_0506_0708n,
} as const;

async function canonicalIdentityAndContact() {
  const identity = await deriveIdentityV2FromEntropy(
    cat5GoldenInputs.masterEntropy,
    cat5GoldenInputs.pseudonym,
    cat5GoldenInputs.creationTime,
  );
  const contact = createPublicContactV2(
    identity,
    cat5GoldenInputs.pseudonym,
    cat5GoldenInputs.creationTime,
    cat5GoldenInputs.signatureEntropy,
  );
  return { identity, contact, encoded: encodePublicContactV2(contact) };
}

export async function canonicalCat5ContactBytes(): Promise<Uint8Array> {
  return (await canonicalIdentityAndContact()).encoded;
}

export async function canonicalCat5Foundation() {
  const { identity, contact, encoded } = await canonicalIdentityAndContact();
  const aes256Key = deriveMlKemKeyV2({
    objectFamily: ObjectFamilyV2.CompactText,
    recipientFingerprint: cat5GoldenInputs.recipientFingerprint,
    salt: cat5GoldenInputs.salt,
    mlKemCiphertext: cat5GoldenInputs.mlKemCiphertext,
    mlKemSharedSecret: cat5GoldenInputs.mlKemSharedSecret,
  });
  return {
    schemaVersion: 1,
    description:
      "Deterministic PPX-PQ-5 identity, ML-KEM HKDF, and PPXC V2 foundation golden.",
    suite: 0x02,
    formatVersion: 0x02,
    identity: {
      masterEntropy: hex(cat5GoldenInputs.masterEntropy),
      kemPublicKeySha512: hex(sha512(identity.kemPublicKey)),
      signingPublicKeySha512: hex(sha512(identity.signingPublicKey)),
      fingerprint: hex(identity.fingerprint),
      identityId: hex(identity.identityId),
    },
    kem: {
      objectFamily: ObjectFamilyV2.CompactText,
      salt: hex(cat5GoldenInputs.salt),
      recipientFingerprint: hex(cat5GoldenInputs.recipientFingerprint),
      ciphertextSha512: hex(sha512(cat5GoldenInputs.mlKemCiphertext)),
      sharedSecret: hex(cat5GoldenInputs.mlKemSharedSecret),
      aes256Key: hex(aes256Key),
    },
    contact: {
      pseudonym: contact.pseudonym,
      creationTime: contact.creationTime.toString(),
      signatureEntropy: hex(cat5GoldenInputs.signatureEntropy),
      signatureSha512: hex(sha512(contact.selfSignature)),
      encodedLength: encoded.byteLength,
      encodedSha512: hex(sha512(encoded)),
    },
  };
}
