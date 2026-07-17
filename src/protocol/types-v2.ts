export const PPX_V2_FORMAT_VERSION = 0x02 as const;
export const PPX_PQ_5_SUITE = 0x02 as const;
export const PPX_PQ_5_NAME = "PPX-PQ-5" as const;

export const ObjectFamilyV2 = Object.freeze({
  Contact: 0x01,
  Text: 0x02,
  CompactText: 0x03,
  File: 0x04,
  Vault: 0x05,
  Recovery: 0x06,
} as const);

export type ObjectFamilyV2 =
  (typeof ObjectFamilyV2)[keyof typeof ObjectFamilyV2];

const OBJECT_FAMILY_V2_VALUES: ReadonlySet<number> = new Set(
  Object.values(ObjectFamilyV2),
);

export function isObjectFamilyV2(value: number): value is ObjectFamilyV2 {
  return OBJECT_FAMILY_V2_VALUES.has(value);
}

export interface DerivedIdentityV2 {
  suite: typeof PPX_PQ_5_SUITE;
  creationTime: bigint;
  importedAt?: bigint;
  masterEntropy: Uint8Array;
  kemPublicKey: Uint8Array;
  kemSecretKey: Uint8Array;
  signingPublicKey: Uint8Array;
  signingSecretKey: Uint8Array;
  fingerprint: Uint8Array;
  identityId: Uint8Array;
  pseudonym: string;
}

export interface SenderSigningCapabilityV2 {
  suite: typeof PPX_PQ_5_SUITE;
  fingerprint: Uint8Array;
  signingPublicKey: Uint8Array;
  signingSecretKey: Uint8Array;
}

export interface DecapsulationCapabilityV2 {
  suite: typeof PPX_PQ_5_SUITE;
  fingerprint: Uint8Array;
  identityId: Uint8Array;
  kemSecretKey: Uint8Array;
}

export interface MlKemEncapsulationV2 {
  formatVersion: typeof PPX_V2_FORMAT_VERSION;
  suite: typeof PPX_PQ_5_SUITE;
  objectFamily: ObjectFamilyV2;
  recipientFingerprint: Uint8Array;
  salt: Uint8Array;
  mlKemCiphertext: Uint8Array;
  aes256Key: Uint8Array;
}

export interface PublicContactV2 {
  magic: "PPXC";
  formatVersion: typeof PPX_V2_FORMAT_VERSION;
  suite: typeof PPX_PQ_5_SUITE;
  creationTime: bigint;
  pseudonym: string;
  kemPublicKey: Uint8Array;
  signingPublicKey: Uint8Array;
  selfSignature: Uint8Array;
  checksum: Uint8Array;
  fingerprint: Uint8Array;
  identityId: Uint8Array;
}

export type TextMagicV2 = "PPXT" | "PPXM";

export interface EncryptedTextObjectV2 {
  magic: TextMagicV2;
  formatVersion: typeof PPX_V2_FORMAT_VERSION;
  suite: typeof PPX_PQ_5_SUITE;
  flags: 0 | 1;
  mlKemCiphertext: Uint8Array;
  salt: Uint8Array;
  nonce: Uint8Array;
  ciphertextLength: number;
  ciphertext: Uint8Array;
  checksum: Uint8Array;
}

export interface EncryptTextInputV2 {
  compact: boolean;
  sender: PublicContactV2;
  senderSigningCapability: SenderSigningCapabilityV2;
  recipient: PublicContactV2;
  plaintext: string;
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
}

export interface DecryptTextInputV2 {
  object: EncryptedTextObjectV2;
  activeIdentity: DecapsulationCapabilityV2;
  knownSenders: readonly PublicContactV2[];
}

export interface DecryptedTextOutputV2 {
  senderContact: PublicContactV2;
  recipientId: Uint8Array;
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
  plaintext: string;
  signatureValid: true;
}

export interface FileHeaderV2 {
  magic: "PPXF";
  formatVersion: typeof PPX_V2_FORMAT_VERSION;
  suite: typeof PPX_PQ_5_SUITE;
  flags: 0;
  recipientId: Uint8Array;
  mlKemCiphertext: Uint8Array;
  noncePrefix: Uint8Array;
  salt: Uint8Array;
  declaredChunkCount: number;
  chunkSize: 1_048_576;
  totalFileLength: bigint;
}

export interface FileChunkRecordV2 {
  chunkIndex: number;
  plaintextLength: number;
  ciphertext: Uint8Array;
}

export interface EncryptedFileManifestRecordV2 {
  chunkIndex: 0xffff_ffff;
  plaintextLength: number;
  ciphertext: Uint8Array;
}

export interface EncryptedFileObjectV2 {
  header: FileHeaderV2;
  chunks: FileChunkRecordV2[];
  manifest: EncryptedFileManifestRecordV2;
  checksum: Uint8Array;
}

export interface FileManifestV2 {
  magic: "PPXF";
  formatVersion: typeof PPX_V2_FORMAT_VERSION;
  suite: typeof PPX_PQ_5_SUITE;
  chunkIndex: 0xffff_ffff;
  senderContact: PublicContactV2;
  recipientId: Uint8Array;
  filename: string;
  mimeHint: string;
  caption: string;
  fileLength: bigint;
  chunkCount: number;
  fullPlaintextDigest: Uint8Array;
  signature: Uint8Array;
}

export interface EncryptFileInputV2 {
  sender: PublicContactV2;
  senderSigningCapability: SenderSigningCapabilityV2;
  recipient: PublicContactV2;
  file: Blob;
  filename: string;
  mimeHint: string;
  caption: string;
  fileLength: bigint;
}

export interface DecryptFileInputV2 {
  object: EncryptedFileObjectV2;
  activeIdentity: DecapsulationCapabilityV2;
}

export interface DecryptedFileOutputV2 {
  senderContact: PublicContactV2;
  recipientId: Uint8Array;
  filename: string;
  mimeHint: string;
  caption: string;
  fileLength: bigint;
  blob: Blob;
  digestValid: true;
  signatureValid: true;
}
