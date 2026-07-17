import type {
  DecryptedTextOutputV2,
  DecryptTextInputV2,
  DerivedIdentityV2,
  EncryptedTextObjectV2,
  EncryptTextInputV2,
  LockedVaultObjectV2,
  PublicContactV2,
} from "../protocol/types-v2";
import type { LockVaultInputV2, UnlockVaultInputV2 } from "./vault-v2";

export interface CryptoProvider {
  deriveIdentity(
    masterEntropy: Uint8Array,
    pseudonym?: string,
    creationTime?: bigint,
  ): Promise<DerivedIdentityV2>;
  createPublicContact(
    identity: DerivedIdentityV2,
    pseudonym: string,
    creationTime: bigint,
    extraEntropy?: Uint8Array,
  ): PublicContactV2;
  parsePublicContact(bytes: Uint8Array): PublicContactV2;
  encryptText(input: EncryptTextInputV2): Promise<EncryptedTextObjectV2>;
  decryptText(input: DecryptTextInputV2): Promise<DecryptedTextOutputV2>;
  lockVault(input: LockVaultInputV2): Promise<LockedVaultObjectV2>;
  unlockVault(input: UnlockVaultInputV2): Promise<DerivedIdentityV2>;
}

export interface RecoveryWordCodec {
  entropyToRecoveryWords(entropy32: Uint8Array): string[];
  recoveryWordsToEntropy(words: string[]): Uint8Array;
}

export {
  createNobleCryptoProvider,
  createWebCryptoAdapter,
} from "./default-provider";
