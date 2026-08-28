import { StrictByteReader, StrictByteWriter } from "../protocol/bytes";
import { checksum16 } from "../protocol/checksum";
import {
  encodeLockedVaultHeaderV2,
  encodeLockedVaultV2,
} from "../protocol/ppxv-v2";
import { normalizePseudonym } from "../protocol/text";
import { PPXError } from "../protocol/types";
import {
  PPX_PQ_5_SUITE,
  PPX_V2_FORMAT_VERSION,
  type DerivedIdentityV2,
  type LockedVaultObjectV2,
} from "../protocol/types-v2";
import { deriveIdentityV2FromEntropy } from "./identity-v2";
import { deriveVaultKey } from "./noble-provider";
import { decryptAesGcm, encryptAesGcm } from "./webcrypto";
import { zeroize } from "./zeroize";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export interface LockVaultInputV2 {
  identity: VaultLockCapabilityV2;
  passphrase: string;
}

/** The minimal identity material needed to create a locked vault. */
export interface VaultLockCapabilityV2 {
  masterEntropy: Uint8Array;
  creationTime: bigint;
  pseudonym: string;
}

export interface UnlockVaultInputV2 {
  vault: LockedVaultObjectV2;
  passphrase: string;
}

export interface VaultLockPrimitivesV2 {
  deriveKey: typeof deriveVaultKey;
  encodePlaintext: typeof encodeVaultInnerV2;
}

function requirePassphraseV2(passphrase: string): void {
  const bytes = encoder.encode(passphrase);
  try {
    if (bytes.byteLength === 0 || bytes.byteLength > 256) {
      throw new PPXError("invalid-passphrase");
    }
  } finally {
    zeroize(bytes);
  }
}

function encodeVaultInnerV2(identity: VaultLockCapabilityV2): Uint8Array {
  const pseudonymBytes = encoder.encode(normalizePseudonym(identity.pseudonym));
  const writer = new StrictByteWriter(41 + pseudonymBytes.byteLength);
  try {
    writer.writeBytes(identity.masterEntropy);
    writer.writeUint64BE(identity.creationTime);
    writer.writeUint8(pseudonymBytes.byteLength);
    writer.writeBytes(pseudonymBytes);
    return writer.toBytes();
  } finally {
    zeroize(pseudonymBytes);
    writer.destroy();
  }
}

export function decodeVaultInnerV2(bytes: Uint8Array): {
  masterEntropy: Uint8Array;
  creationTime: bigint;
  pseudonym: string;
} {
  const reader = new StrictByteReader(bytes, 89);
  let masterEntropy: Uint8Array | undefined;
  let transferred = false;
  try {
    masterEntropy = reader.readBytes(32);
    const creationTime = reader.readUint64BE();
    const pseudonymLength = reader.readUint8();
    if (pseudonymLength < 1 || pseudonymLength > 48) {
      throw new PPXError("impossible-length");
    }
    let pseudonym: string;
    try {
      pseudonym = decoder.decode(reader.readBytes(pseudonymLength));
    } catch {
      throw new PPXError("noncanonical-text");
    }
    reader.requireEnd();
    if (normalizePseudonym(pseudonym) !== pseudonym) {
      throw new PPXError("noncanonical-text");
    }
    transferred = true;
    return { masterEntropy, creationTime, pseudonym };
  } finally {
    if (masterEntropy && !transferred) zeroize(masterEntropy);
  }
}

export async function lockVaultV2(
  input: LockVaultInputV2,
  primitives: VaultLockPrimitivesV2 = {
    deriveKey: deriveVaultKey,
    encodePlaintext: encodeVaultInnerV2,
  },
): Promise<LockedVaultObjectV2> {
  requirePassphraseV2(input.passphrase);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  let plaintext: Uint8Array | undefined;
  let key: Uint8Array | undefined;
  let aad: Uint8Array | undefined;
  let checksumInput: Uint8Array | undefined;
  try {
    plaintext = primitives.encodePlaintext(input.identity);
    const ciphertextLength = plaintext.byteLength + 16;
    const base = {
      magic: "PPXV" as const,
      formatVersion: PPX_V2_FORMAT_VERSION,
      suite: PPX_PQ_5_SUITE,
      flags: 1 as const,
      kdfId: 1 as const,
      scryptN: 65_536 as const,
      scryptR: 8 as const,
      scryptP: 2 as const,
      salt,
      nonce,
      ciphertextLength,
    };
    aad = encodeLockedVaultHeaderV2(base);
    key = await primitives.deriveKey(input.passphrase, salt);
    const ciphertext = await encryptAesGcm(key, nonce, plaintext, aad);
    checksumInput = new Uint8Array(aad.byteLength + ciphertext.byteLength);
    checksumInput.set(aad);
    checksumInput.set(ciphertext, aad.byteLength);
    return { ...base, ciphertext, checksum: checksum16(checksumInput) };
  } finally {
    if (key) zeroize(key);
    if (plaintext) zeroize(plaintext);
    if (aad) zeroize(aad);
    if (checksumInput) zeroize(checksumInput);
  }
}

export async function unlockVaultV2(
  input: UnlockVaultInputV2,
): Promise<DerivedIdentityV2> {
  let key: Uint8Array | undefined;
  let plaintext: Uint8Array | undefined;
  let aad: Uint8Array | undefined;
  try {
    requirePassphraseV2(input.passphrase);
    encodeLockedVaultV2(input.vault).fill(0);
    aad = encodeLockedVaultHeaderV2(input.vault);
    key = await deriveVaultKey(input.passphrase, input.vault.salt);
    plaintext = await decryptAesGcm(
      key,
      input.vault.nonce,
      input.vault.ciphertext,
      aad,
    );
    const inner = decodeVaultInnerV2(plaintext);
    try {
      return await deriveIdentityV2FromEntropy(
        inner.masterEntropy,
        inner.pseudonym,
        inner.creationTime,
      );
    } finally {
      zeroize(inner.masterEntropy);
    }
  } catch {
    throw new PPXError("wrong-passphrase-or-corruption");
  } finally {
    if (key) zeroize(key);
    if (plaintext) zeroize(plaintext);
    if (aad) zeroize(aad);
  }
}
