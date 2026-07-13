import { parsePublicContact, createPublicContact } from "../protocol/ppxc";
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
import {
  decryptFile,
  encryptFile,
  encryptFileToBlob,
  type FileCryptoHooks,
} from "./file";
import { encapsulateHybrid } from "./hybrid";
import { deriveIdentityFromEntropy } from "./identity";
import type { CryptoProvider } from "./provider";
import { decryptText, encryptText } from "./text";
import { lockVault, unlockVault } from "./vault";

export class DefaultCryptoProvider implements CryptoProvider {
  deriveIdentity(masterEntropy: Uint8Array): Promise<DerivedIdentity> {
    return deriveIdentityFromEntropy(masterEntropy);
  }

  createPublicContact(
    identity: DerivedIdentity,
    pseudonym: string,
    creationTime: bigint,
  ): PublicContact {
    return createPublicContact(identity, pseudonym, creationTime);
  }

  parsePublicContact(bytes: Uint8Array): PublicContact {
    return parsePublicContact(bytes);
  }

  createHybridEncapsulation(params: {
    recipientFingerprint: Uint8Array;
    recipientKemPublicKey: Uint8Array;
    recipientX25519PublicKey: Uint8Array;
  }): HybridEncapsulation {
    return encapsulateHybrid(params);
  }

  encryptText(input: EncryptTextInput): Promise<EncryptedTextObject> {
    return encryptText(input);
  }

  decryptText(input: DecryptTextInput): Promise<DecryptedTextOutput> {
    return decryptText(input);
  }

  encryptFile(
    input: EncryptFileInput,
    hooks?: FileCryptoHooks,
  ): Promise<EncryptedFileObject> {
    return encryptFile(input, hooks);
  }

  encryptFileToBlob(
    input: EncryptFileInput,
    hooks?: FileCryptoHooks,
  ): Promise<EncryptedFileBlobOutput> {
    return encryptFileToBlob(input, hooks);
  }

  decryptFile(
    input: DecryptFileInput,
    hooks?: FileCryptoHooks,
  ): Promise<DecryptedFileOutput> {
    return decryptFile(input, hooks);
  }

  lockVault(input: LockVaultInput): Promise<LockedVaultObject> {
    return lockVault(input);
  }

  unlockVault(input: UnlockVaultInput): Promise<DerivedIdentity> {
    return unlockVault(input);
  }
}

export function createNobleCryptoProvider(): CryptoProvider {
  return new DefaultCryptoProvider();
}

export function createWebCryptoAdapter(): CryptoProvider | null {
  return globalThis.crypto?.subtle ? new DefaultCryptoProvider() : null;
}

export const defaultCryptoProvider: CryptoProvider =
  createWebCryptoAdapter() ?? createNobleCryptoProvider();
