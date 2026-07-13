export type PPXParseError =
  | "unknown-format-version"
  | "unknown-suite"
  | "unknown-flags"
  | "impossible-length"
  | "duplicate-field"
  | "trailing-bytes"
  | "noncanonical-text"
  | "oversize-before-allocation"
  | "checksum-mismatch";

export type PPXCryptoError =
  | "wrong-identity-or-corruption"
  | "wrong-passphrase-or-corruption"
  | "invalid-aead"
  | "invalid-signature"
  | "invalid-hybrid-encapsulation"
  | "invalid-passphrase"
  | "corrupted-vault";

export class PPXError extends Error {
  readonly code: PPXParseError | PPXCryptoError;

  constructor(code: PPXParseError | PPXCryptoError) {
    super(code);
    this.name = "PPXError";
    this.code = code;
  }
}

export interface DerivedIdentity {
  suite: 0x01;
  creationTime: bigint;
  masterEntropy: Uint8Array;
  kemPublicKey: Uint8Array;
  kemSecretKey: Uint8Array;
  x25519PublicKey: Uint8Array;
  x25519SecretKey: Uint8Array;
  signingPublicKey: Uint8Array;
  signingSecretKey: Uint8Array;
  fingerprint: Uint8Array;
  identityId: Uint8Array;
  pseudonym: string;
}

export interface PublicContact {
  magic: "PPXC";
  formatVersion: 0x01;
  suite: 0x01;
  creationTime: bigint;
  pseudonym: string;
  kemPublicKey: Uint8Array;
  x25519PublicKey: Uint8Array;
  signingPublicKey: Uint8Array;
  selfSignature: Uint8Array;
  checksum: Uint8Array;
  fingerprint: Uint8Array;
  identityId: Uint8Array;
}

export interface HybridEncapsulation {
  suite: 0x01;
  recipientFingerprint: Uint8Array;
  salt: Uint8Array;
  ephemeralX25519PublicKey: Uint8Array;
  mlKemCiphertext: Uint8Array;
  x25519SharedSecret: Uint8Array;
  mlKemSharedSecret: Uint8Array;
  aes256Key: Uint8Array;
}

export interface LockedVaultObject {
  magic: "PPXV";
  formatVersion: 0x01;
  suite: 0x01;
  flags: number;
  kdfId: 0x01;
  scryptN: 65536;
  scryptR: 8;
  scryptP: 2;
  salt: Uint8Array;
  nonce: Uint8Array;
  ciphertextLength: number;
  ciphertext: Uint8Array;
  checksum: Uint8Array;
}

export interface RecoveryObject {
  magic: "PPXR";
  formatVersion: 0x01;
  suite: 0x01;
  flags: number;
  masterEntropy: Uint8Array;
  creationTime: bigint;
  pseudonym: string;
  checksum: Uint8Array;
}

export interface LockVaultInput {
  identity: DerivedIdentity;
  passphrase: string;
}

export interface UnlockVaultInput {
  vault: LockedVaultObject;
  passphrase: string;
}

export interface SenderSigningCapability {
  fingerprint: Uint8Array;
  signingPublicKey: Uint8Array;
  signingSecretKey: Uint8Array;
}

export interface EncryptTextInput {
  sender: PublicContact;
  senderSigningCapability: SenderSigningCapability;
  recipient: PublicContact;
  plaintext: string;
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
}

export interface DecryptTextInput {
  object: EncryptedTextObject;
  activeIdentity: DerivedIdentity;
}

export interface EncryptedTextObject {
  magic: "PPXT";
  formatVersion: 0x01;
  suite: 0x01;
  flags: number;
  mlKemCiphertext: Uint8Array;
  ephemeralX25519PublicKey: Uint8Array;
  salt: Uint8Array;
  nonce: Uint8Array;
  ciphertextLength: number;
  ciphertext: Uint8Array;
  checksum: Uint8Array;
}

export interface DecryptedTextOutput {
  senderContact: PublicContact;
  recipientId: Uint8Array;
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
  plaintext: string;
  signatureValid: true;
}

export interface EncryptFileInput {
  sender: PublicContact;
  senderSigningCapability: SenderSigningCapability;
  recipient: PublicContact;
  file: Blob;
  filename: string;
  mimeHint: string;
  caption: string;
  fileLength: bigint;
}

export interface DecryptFileInput {
  object: EncryptedFileObject | Blob;
  activeIdentity: DerivedIdentity;
}

export interface FileHeader {
  magic: "PPXF";
  formatVersion: 0x01;
  suite: 0x01;
  flags: 0;
  recipientId: Uint8Array;
  mlKemCiphertext: Uint8Array;
  ephemeralX25519PublicKey: Uint8Array;
  noncePrefix: Uint8Array;
  salt: Uint8Array;
  declaredChunkCount: number;
  chunkSize: 1048576;
  totalFileLength: bigint;
}

export interface ChunkRecord {
  chunkIndex: number;
  plaintextLength: number;
  ciphertext: Uint8Array;
}

export interface FileManifest {
  magic: "PPXF";
  formatVersion: 0x01;
  suite: 0x01;
  chunkIndex: 0xffffffff;
  senderContact: PublicContact;
  recipientId: Uint8Array;
  filename: string;
  mimeHint: string;
  caption: string;
  fileLength: bigint;
  chunkCount: number;
  fullPlaintextDigest: Uint8Array;
  signature: Uint8Array;
}

export interface EncryptedManifestRecord {
  chunkIndex: 0xffffffff;
  plaintextLength: number;
  ciphertext: Uint8Array;
}

export interface EncryptedFileObject {
  header: FileHeader;
  chunks: ChunkRecord[];
  manifest: EncryptedManifestRecord;
  checksum: Uint8Array;
}

export interface EncryptedFileBlobOutput {
  blob: Blob;
  plaintextLength: bigint;
  encodedLength: bigint;
}

export interface DecryptedFileOutput {
  senderContact: PublicContact;
  recipientId: Uint8Array;
  filename: string;
  mimeHint: string;
  caption: string;
  fileLength: bigint;
  blob: Blob;
  digestValid: true;
  signatureValid: true;
}

export interface RecoveryWordsImportInput {
  words: string[];
  pseudonym: string;
  importedAt: bigint;
}

export interface RecoveryWordsImportOutput {
  identity: DerivedIdentity;
  publicContact: PublicContact;
  importedAt: bigint;
}
