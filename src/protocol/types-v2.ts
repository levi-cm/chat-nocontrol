export const PPX_V2_FORMAT_VERSION = 0x02 as const;
export const PPX_PQ_5_SUITE = 0x02 as const;
export const PPX_PQ_5_NAME = "PPX-PQ-5" as const;

export enum ObjectFamilyV2 {
  Contact = 0x01,
  Text = 0x02,
  QrText = 0x03,
  File = 0x04,
  Vault = 0x05,
  Recovery = 0x06,
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
