import { sha512 } from "@noble/hashes/sha2.js";
import {
  createSenderSigningCapabilityV2,
  deriveIdentityV2FromEntropy,
} from "../../crypto/identity-v2";
import { deriveMlKemKeyV2 } from "../../crypto/kem-v2";
import { mlKem1024Encapsulate } from "../../crypto/pq-provider-v2";
import { encryptTextV2 } from "../../crypto/text-v2";
import { encryptFileV2 } from "../../crypto/file-v2";
import {
  createPublicContactV2,
  encodePublicContactV2,
} from "../../protocol/ppxc-v2";
import { checksum16 } from "../../protocol/checksum";
import { encodeRecoveryObjectV2 } from "../../protocol/ppxr-v2";
import {
  encodeLockedVaultHeaderV2,
  encodeLockedVaultV2,
} from "../../protocol/ppxv-v2";
import { ObjectFamilyV2 } from "../../protocol/types-v2";
import { encodeEncryptedTextOuterV2 } from "../../protocol/text-v2-outer";
import { encodeEncryptedFileObjectV2 } from "../../protocol/ppxf-v2";

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

function concat(...parts: Uint8Array[]): Uint8Array {
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

export function canonicalCat5RecoveryBytes(): Uint8Array {
  return encodeRecoveryObjectV2({
    magic: "PPXR",
    formatVersion: 2,
    suite: 2,
    flags: 0,
    masterEntropy: cat5GoldenInputs.masterEntropy,
    creationTime: cat5GoldenInputs.creationTime,
    pseudonym: cat5GoldenInputs.pseudonym,
    checksum: new Uint8Array(16),
  });
}

export function canonicalCat5VaultBytes(): Uint8Array {
  const base = {
    magic: "PPXV" as const,
    formatVersion: 2 as const,
    suite: 2 as const,
    flags: 1 as const,
    kdfId: 1 as const,
    scryptN: 65_536 as const,
    scryptR: 8 as const,
    scryptP: 2 as const,
    salt: Uint8Array.from({ length: 16 }, (_, index) => 0x10 + index),
    nonce: Uint8Array.from({ length: 12 }, (_, index) => 0x30 + index),
    ciphertextLength: 68,
    ciphertext: Uint8Array.from(
      { length: 68 },
      (_, index) => (index * 17 + 0x50) & 0xff,
    ),
  };
  const payload = concat(encodeLockedVaultHeaderV2(base), base.ciphertext);
  return encodeLockedVaultV2({ ...base, checksum: checksum16(payload) });
}

export async function canonicalCat5Foundation() {
  const { identity, contact, encoded } = await canonicalIdentityAndContact();
  const recoveryBytes = canonicalCat5RecoveryBytes();
  const vaultBytes = canonicalCat5VaultBytes();
  const aes256Key = deriveMlKemKeyV2({
    objectFamily: ObjectFamilyV2.CompactText,
    recipientFingerprint: cat5GoldenInputs.recipientFingerprint,
    salt: cat5GoldenInputs.salt,
    mlKemCiphertext: cat5GoldenInputs.mlKemCiphertext,
    mlKemSharedSecret: cat5GoldenInputs.mlKemSharedSecret,
  });
  const textSenderContact = createPublicContactV2(
    identity,
    "A",
    cat5GoldenInputs.creationTime,
    Uint8Array.from({ length: 32 }, (_, index) => 0xb0 + index),
  );
  const recipientIdentity = await deriveIdentityV2FromEntropy(
    Uint8Array.from({ length: 32 }, (_, index) => 0x40 + index),
    "B",
    cat5GoldenInputs.creationTime + 1n,
  );
  const recipientContact = createPublicContactV2(
    recipientIdentity,
    "B",
    cat5GoldenInputs.creationTime + 1n,
    Uint8Array.from({ length: 32 }, (_, index) => 0x90 + index),
  );
  const deterministicKem = {
    encapsulate: (publicKey: Uint8Array) =>
      mlKem1024Encapsulate(
        publicKey,
        Uint8Array.from({ length: 32 }, (_, index) => 0x70 + index),
      ),
    randomBytes: () => Uint8Array.from(cat5GoldenInputs.salt),
  };
  const encryptEmpty = async (compact: boolean) => {
    const object = await encryptTextV2(
      {
        compact,
        sender: textSenderContact,
        senderSigningCapability: createSenderSigningCapabilityV2(identity),
        recipient: recipientContact,
        plaintext: "",
        messageId: Uint8Array.from({ length: 16 }, (_, index) => 0x20 + index),
        sentAt: 0x1112_1314_1516_1718n,
        createdAt: 0x2122_2324_2526_2728n,
      },
      {
        kem: deterministicKem,
        randomBytes: (length) =>
          Uint8Array.from(
            { length },
            (_, index) => (length === 32 ? 0xd0 : 0xe0) + index,
          ),
      },
    );
    const bytes = encodeEncryptedTextOuterV2(object);
    return {
      magic: object.magic,
      flags: object.flags,
      encodedLength: bytes.byteLength,
      encodedSha512: hex(sha512(bytes)),
      ciphertextSha512: hex(sha512(object.ciphertext)),
    };
  };
  const fullText = await encryptEmpty(false);
  const compactText = await encryptEmpty(true);
  const fileObject = await encryptFileV2(
    {
      sender: textSenderContact,
      senderSigningCapability: createSenderSigningCapabilityV2(identity),
      recipient: recipientContact,
      file: new Blob(),
      filename: "x",
      mimeHint: "",
      caption: "",
      fileLength: 0n,
    },
    undefined,
    {
      kem: deterministicKem,
      randomBytes: (length) =>
        Uint8Array.from(
          { length },
          (_, index) => (length === 32 ? 0xd8 : 0xf0) + index,
        ),
    },
  );
  const fileBytes = encodeEncryptedFileObjectV2(fileObject);
  return {
    schemaVersion: 1,
    description:
      "Deterministic PPX-PQ-5 identity, KEM, contact, text, and file golden.",
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
    text: {
      signatureContexts: {
        full: "PPX/TEXT/FULL/V2",
        compact: "PPX/TEXT/COMPACT/V2",
      },
      full: fullText,
      compact: compactText,
    },
    file: {
      magic: fileObject.header.magic,
      objectFamily: ObjectFamilyV2.File,
      headerBytes: 1_651,
      chunkBytes: 1_048_576,
      signatureContext: "PPX/FILE/MANIFEST/V2",
      encodedLength: fileBytes.byteLength,
      encodedSha512: hex(sha512(fileBytes)),
      manifestCiphertextSha512: hex(sha512(fileObject.manifest.ciphertext)),
    },
    recovery: {
      magic: "PPXR",
      flags: 0,
      encodedLength: recoveryBytes.byteLength,
      encodedSha512: hex(sha512(recoveryBytes)),
      encodedBase64: Buffer.from(recoveryBytes).toString("base64"),
    },
    vault: {
      magic: "PPXV",
      flags: 1,
      kdfId: 1,
      scryptN: 65_536,
      scryptR: 8,
      scryptP: 2,
      encodedLength: vaultBytes.byteLength,
      encodedSha512: hex(sha512(vaultBytes)),
      ciphertextSha512: hex(sha512(vaultBytes.subarray(56, -16))),
      encodedBase64: Buffer.from(vaultBytes).toString("base64"),
    },
  };
}
