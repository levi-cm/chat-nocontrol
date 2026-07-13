import type {
  DecryptedFileOutput,
  DecryptedTextOutput,
  DecryptFileInput,
  DecryptTextInput,
  DerivedIdentity,
  EncryptedFileBlobOutput,
  EncryptedFileObject,
  EncryptedTextObject,
  EncryptFileInput,
  EncryptTextInput,
  HybridEncapsulation,
  LockedVaultObject,
  LockVaultInput,
  PublicContact,
  UnlockVaultInput,
} from "../protocol/types";
import type { FileCryptoHooks } from "./file";

export interface CryptoProvider {
  deriveIdentity(masterEntropy: Uint8Array): Promise<DerivedIdentity>;
  createPublicContact(
    identity: DerivedIdentity,
    pseudonym: string,
    creationTime: bigint,
  ): PublicContact;
  parsePublicContact(bytes: Uint8Array): PublicContact;
  createHybridEncapsulation(params: {
    recipientFingerprint: Uint8Array;
    recipientKemPublicKey: Uint8Array;
    recipientX25519PublicKey: Uint8Array;
  }): HybridEncapsulation;
  encryptText(input: EncryptTextInput): Promise<EncryptedTextObject>;
  decryptText(input: DecryptTextInput): Promise<DecryptedTextOutput>;
  encryptFile(
    input: EncryptFileInput,
    hooks?: FileCryptoHooks,
  ): Promise<EncryptedFileObject>;
  encryptFileToBlob(
    input: EncryptFileInput,
    hooks?: FileCryptoHooks,
  ): Promise<EncryptedFileBlobOutput>;
  decryptFile(
    input: DecryptFileInput,
    hooks?: FileCryptoHooks,
  ): Promise<DecryptedFileOutput>;
  lockVault(input: LockVaultInput): Promise<LockedVaultObject>;
  unlockVault(input: UnlockVaultInput): Promise<DerivedIdentity>;
}

export interface RecoveryWordCodec {
  entropyToRecoveryWords(entropy32: Uint8Array): string[];
  recoveryWordsToEntropy(words: string[]): Uint8Array;
}

export {
  createNobleCryptoProvider,
  createWebCryptoAdapter,
} from "./default-provider";
