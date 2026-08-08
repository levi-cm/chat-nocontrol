import type { FileCryptoHooks } from "./file";
import { decryptFile } from "./file";
import {
  createDecapsulationCapability,
  zeroizeDecapsulationCapability,
} from "./decapsulation-capability";
import { deriveIdentityFromEntropy } from "./identity";
import { deriveIdentityV2FromEntropy } from "./identity-v2";
import { decryptQrText } from "./qr-text";
import { decryptText } from "./text";
import { unlockVault } from "./vault";
import { zeroize, zeroizeIdentitySecrets } from "./zeroize";
import { parseLockedVault } from "../protocol/ppxv";
import { parseRecoveryObject } from "../protocol/ppxr";
import { parsePublicContact } from "../protocol/ppxc";
import { parseEncryptedQrText } from "../protocol/ppxq-outer";
import type {
  DecryptedFileOutput,
  DecryptedQrTextOutput,
  DecryptedTextOutput,
  EncryptedFileObject,
  EncryptedTextObject,
} from "../protocol/types";
import type { DerivedIdentityV2 } from "../protocol/types-v2";

export interface LegacyTextDecryptInputV1 {
  object: EncryptedTextObject;
  masterEntropy: Uint8Array;
}

export interface LegacyFileDecryptInputV1 {
  object: EncryptedFileObject | Blob;
  masterEntropy: Uint8Array;
}

export interface LegacyCompactTextDecryptInputV1 {
  ppxqBytes: Uint8Array;
  senderContactBytes: Uint8Array;
  masterEntropy: Uint8Array;
}

export async function decryptLegacyCompactTextV1(
  input: LegacyCompactTextDecryptInputV1,
): Promise<DecryptedQrTextOutput> {
  let object: ReturnType<typeof parseEncryptedQrText> | undefined;
  let senderContact: ReturnType<typeof parsePublicContact> | undefined;
  let identity:
    Awaited<ReturnType<typeof deriveIdentityFromEntropy>> | undefined;
  let capability: ReturnType<typeof createDecapsulationCapability> | undefined;
  try {
    object = parseEncryptedQrText(input.ppxqBytes);
    senderContact = parsePublicContact(input.senderContactBytes);
    identity = await deriveIdentityFromEntropy(input.masterEntropy);
    capability = createDecapsulationCapability(identity);
    return await decryptQrText({
      object,
      activeIdentity: capability,
      knownSenders: [senderContact],
    });
  } finally {
    zeroize(input.ppxqBytes, input.senderContactBytes, input.masterEntropy);
    if (capability) zeroizeDecapsulationCapability(capability);
    if (identity) zeroizeIdentitySecrets(identity);
    if (object) {
      zeroize(
        object.mlKemCiphertext,
        object.ephemeralX25519PublicKey,
        object.salt,
        object.nonce,
        object.ciphertext,
        object.checksum,
      );
    }
  }
}

export async function decryptLegacyTextV1(
  input: LegacyTextDecryptInputV1,
): Promise<DecryptedTextOutput> {
  let identity: Awaited<ReturnType<typeof deriveIdentityFromEntropy>>;
  let capability: ReturnType<typeof createDecapsulationCapability>;
  try {
    identity = await deriveIdentityFromEntropy(input.masterEntropy);
    capability = createDecapsulationCapability(identity);
    return await decryptText({
      object: input.object,
      activeIdentity: capability,
    });
  } finally {
    zeroize(input.masterEntropy);
    if (capability!) zeroizeDecapsulationCapability(capability);
    if (identity!) zeroizeIdentitySecrets(identity);
  }
}

export async function decryptLegacyFileV1(
  input: LegacyFileDecryptInputV1,
  hooks?: FileCryptoHooks,
): Promise<DecryptedFileOutput> {
  let identity: Awaited<ReturnType<typeof deriveIdentityFromEntropy>>;
  let capability: ReturnType<typeof createDecapsulationCapability>;
  try {
    identity = await deriveIdentityFromEntropy(input.masterEntropy);
    capability = createDecapsulationCapability(identity);
    return await decryptFile(
      { object: input.object, activeIdentity: capability },
      hooks,
    );
  } finally {
    zeroize(input.masterEntropy);
    if (capability!) zeroizeDecapsulationCapability(capability);
    if (identity!) zeroizeIdentitySecrets(identity);
  }
}

export async function migrateLegacyRecoveryV1(
  bytes: Uint8Array,
): Promise<DerivedIdentityV2> {
  let recovery: ReturnType<typeof parseRecoveryObject>;
  try {
    recovery = parseRecoveryObject(bytes);
    return await deriveIdentityV2FromEntropy(
      recovery.masterEntropy,
      recovery.pseudonym,
      recovery.creationTime,
    );
  } finally {
    zeroize(bytes);
    if (recovery!) zeroize(recovery.masterEntropy);
  }
}

export async function migrateLegacyVaultV1(input: {
  bytes: Uint8Array;
  passphrase: string;
}): Promise<DerivedIdentityV2> {
  let legacy: Awaited<ReturnType<typeof unlockVault>>;
  try {
    legacy = await unlockVault({
      vault: parseLockedVault(input.bytes),
      passphrase: input.passphrase,
    });
    return await deriveIdentityV2FromEntropy(
      legacy.masterEntropy,
      legacy.pseudonym,
      legacy.creationTime,
    );
  } finally {
    zeroize(input.bytes);
    if (legacy!) zeroizeIdentitySecrets(legacy);
  }
}
