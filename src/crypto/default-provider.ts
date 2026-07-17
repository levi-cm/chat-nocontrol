import {
  parsePublicContactV2,
  createPublicContactV2,
} from "../protocol/ppxc-v2";
import type {
  DecryptedTextOutputV2,
  DecryptTextInputV2,
  DerivedIdentityV2,
  EncryptedTextObjectV2,
  EncryptTextInputV2,
  LockedVaultObjectV2,
  PublicContactV2,
} from "../protocol/types-v2";
import { deriveIdentityV2FromEntropy } from "./identity-v2";
import type { CryptoProvider } from "./provider";
import { decryptTextV2, encryptTextV2 } from "./text-v2";
import {
  lockVaultV2,
  unlockVaultV2,
  type LockVaultInputV2,
  type UnlockVaultInputV2,
} from "./vault-v2";

export class DefaultCryptoProvider implements CryptoProvider {
  deriveIdentity(
    masterEntropy: Uint8Array,
    pseudonym = "",
    creationTime = 0n,
  ): Promise<DerivedIdentityV2> {
    return deriveIdentityV2FromEntropy(masterEntropy, pseudonym, creationTime);
  }

  createPublicContact(
    identity: DerivedIdentityV2,
    pseudonym: string,
    creationTime: bigint,
    extraEntropy?: Uint8Array,
  ): PublicContactV2 {
    return createPublicContactV2(
      identity,
      pseudonym,
      creationTime,
      extraEntropy,
    );
  }

  parsePublicContact(bytes: Uint8Array): PublicContactV2 {
    return parsePublicContactV2(bytes);
  }

  encryptText(input: EncryptTextInputV2): Promise<EncryptedTextObjectV2> {
    return encryptTextV2(input);
  }

  decryptText(input: DecryptTextInputV2): Promise<DecryptedTextOutputV2> {
    return decryptTextV2(input);
  }

  lockVault(input: LockVaultInputV2): Promise<LockedVaultObjectV2> {
    return lockVaultV2(input);
  }

  unlockVault(input: UnlockVaultInputV2): Promise<DerivedIdentityV2> {
    return unlockVaultV2(input);
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
