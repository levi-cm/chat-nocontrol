import { StrictByteReader, StrictByteWriter } from "../protocol/bytes";
import { checksum16 } from "../protocol/checksum";
import { encodeLockedVault, encodeLockedVaultHeader } from "../protocol/ppxv";
import { normalizePseudonym } from "../protocol/text";
import {
  PPXError,
  type DerivedIdentity,
  type LockedVaultObject,
  type LockVaultInput,
  type UnlockVaultInput,
} from "../protocol/types";
import { deriveIdentityFromEntropy } from "./identity";
import { deriveVaultKey } from "./noble-provider";
import { decryptAesGcm, encryptAesGcm } from "./webcrypto";
import { zeroize } from "./zeroize";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export interface VaultLockPrimitives {
  deriveKey: typeof deriveVaultKey;
  encodePlaintext: typeof encodeInner;
}

function requirePassphrase(passphrase: string): void {
  const length = encoder.encode(passphrase).byteLength;
  if (length === 0 || length > 256) throw new PPXError("invalid-passphrase");
}

export type PassphraseStrengthBand = "weak" | "medium" | "strong";

export function passphraseStrengthBand(bits: number): PassphraseStrengthBand {
  if (bits >= 100) return "strong";
  if (bits >= 50) return "medium";
  return "weak";
}

function characterPoolSize(value: string): number {
  let pool = 0;
  if (/\p{Ll}/u.test(value)) pool += 26;
  if (/\p{Lu}/u.test(value)) pool += 26;
  if (/\p{N}/u.test(value)) pool += 10;
  if (/\s/u.test(value)) pool += 1;
  if (/[^\p{L}\p{N}\s]/u.test(value)) pool += 33;
  if (/[^\x00-\x7F]/u.test(value)) pool += 100;
  return Math.max(pool, 1);
}

function repeatedUnitLength(value: string): number | null {
  for (let unit = 1; unit <= Math.floor(value.length / 2); unit += 1) {
    if (value.length % unit !== 0) continue;
    const pattern = value.slice(0, unit);
    if (pattern.repeat(value.length / unit) === value) return unit;
  }
  return null;
}

/**
 * A deterministic, local-only estimate for UI guidance. It is deliberately not
 * a promise of crack time and never changes whether a non-empty passphrase may
 * be saved.
 */
export function estimatePassphraseBits(value: string): number {
  const characters = [...value.normalize("NFC")];
  if (characters.length === 0) return 0;
  const poolBits = Math.log2(characterPoolSize(value));
  let estimate = characters.length * poolBits;
  const compact = characters.join("").toLocaleLowerCase("en-US");
  const unitLength = repeatedUnitLength(compact);
  if (unitLength !== null) {
    estimate = Math.min(
      estimate,
      unitLength * poolBits + Math.log2(characters.length / unitLength + 1),
    );
  }
  if (
    /^(?:0123|1234|2345|3456|4567|5678|6789|7890|abcd|qwerty)/u.test(compact)
  ) {
    estimate *= 0.65;
  }
  if (/^(?:password|passwort|letmein|admin|welcome)$/u.test(compact)) {
    estimate = Math.min(estimate, 12);
  }
  return Math.max(0, Math.floor(estimate));
}

function encodeInner(identity: DerivedIdentity): Uint8Array {
  const pseudonym = normalizePseudonym(identity.pseudonym);
  const pseudonymBytes = encoder.encode(pseudonym);
  const writer = new StrictByteWriter(41 + pseudonymBytes.byteLength);
  writer.writeBytes(identity.masterEntropy);
  writer.writeUint64BE(identity.creationTime);
  writer.writeUint8(pseudonymBytes.byteLength);
  writer.writeBytes(pseudonymBytes);
  return writer.toBytes();
}

export function decodeVaultInner(bytes: Uint8Array): {
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
    const pseudonym = decoder.decode(reader.readBytes(pseudonymLength));
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

export async function lockVault(
  input: LockVaultInput,
  primitives: VaultLockPrimitives = {
    deriveKey: deriveVaultKey,
    encodePlaintext: encodeInner,
  },
): Promise<LockedVaultObject> {
  requirePassphrase(input.passphrase);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  let plaintext: Uint8Array | undefined;
  let key: Uint8Array | undefined;
  try {
    plaintext = primitives.encodePlaintext(input.identity);
    const ciphertextLength = plaintext.byteLength + 16;
    const base = {
      magic: "PPXV" as const,
      formatVersion: 1 as const,
      suite: 1 as const,
      flags: 1,
      kdfId: 1 as const,
      scryptN: 65_536 as const,
      scryptR: 8 as const,
      scryptP: 2 as const,
      salt,
      nonce,
      ciphertextLength,
    };
    const aad = encodeLockedVaultHeader(base);
    key = await primitives.deriveKey(input.passphrase, salt);
    const ciphertext = await encryptAesGcm(key, nonce, plaintext, aad);
    const checksum = checksum16(new Uint8Array([...aad, ...ciphertext]));
    return { ...base, ciphertext, checksum };
  } finally {
    if (key) zeroize(key);
    if (plaintext) zeroize(plaintext);
  }
}

export async function unlockVault(
  input: UnlockVaultInput,
): Promise<DerivedIdentity> {
  let key: Uint8Array | undefined;
  let plaintext: Uint8Array | undefined;
  try {
    requirePassphrase(input.passphrase);
    encodeLockedVault(input.vault);
    const aad = encodeLockedVaultHeader(input.vault);
    key = await deriveVaultKey(input.passphrase, input.vault.salt);
    plaintext = await decryptAesGcm(
      key,
      input.vault.nonce,
      input.vault.ciphertext,
      aad,
    );
    const inner = decodeVaultInner(plaintext);
    try {
      return await deriveIdentityFromEntropy(
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
  }
}
