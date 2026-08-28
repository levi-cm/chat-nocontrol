import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { zeroize } from "../../crypto/zeroize";
import { checksum16 } from "../../protocol/checksum";
import {
  createPublicContactV2,
  encodePublicContactV2,
  parsePublicContactV2,
} from "../../protocol/ppxc-v2";
import {
  calculateEncryptedFileChecksumV2,
  encodeEncryptedFileObjectV2,
  parseEncryptedFileObjectV2,
} from "../../protocol/ppxf-v2";
import {
  encodeRecoveryObjectV2,
  parseRecoveryObjectV2,
} from "../../protocol/ppxr-v2";
import {
  encodeEncryptedTextHeaderV2,
  encodeEncryptedTextOuterV2,
  parseEncryptedTextOuterV2,
} from "../../protocol/text-v2-outer";
import type {
  EncryptedFileObjectV2,
  EncryptedTextObjectV2,
  LockedVaultObjectV2,
  TextMagicV2,
} from "../../protocol/types-v2";
import {
  encodeLockedVaultHeaderV2,
  encodeLockedVaultV2,
  parseLockedVaultV2,
} from "../../protocol/ppxv-v2";

export type Cat5ProtocolFamily =
  "ppxc" | "ppxt" | "ppxm" | "ppxf" | "ppxr" | "ppxv";

export const cat5ProtocolFamilies: readonly Cat5ProtocolFamily[] = [
  "ppxc",
  "ppxt",
  "ppxm",
  "ppxf",
  "ppxr",
  "ppxv",
];

function seededBytes(seed: number, length: number): Uint8Array {
  const output = new Uint8Array(length);
  let state = seed | 0;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    output[index] = state & 0xff;
  }
  return output;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((length, part) => length + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function canonicalTextBytes(magic: TextMagicV2, seed: number): Uint8Array {
  const minimum = magic === "PPXT" ? 13_524 : 4_731;
  const ciphertext = seededBytes(seed ^ 0x51_7a_11, minimum + (seed & 31));
  const base = {
    magic,
    formatVersion: 2 as const,
    suite: 2 as const,
    flags: (seed & 1) as 0 | 1,
    mlKemCiphertext: seededBytes(seed ^ 0x6b_31_02, 1_568),
    salt: seededBytes(seed ^ 0x1e_2d_33, 32),
    nonce: seededBytes(seed ^ 0x72_09_44, 12),
    ciphertextLength: ciphertext.byteLength,
  };
  const payload = concat(encodeEncryptedTextHeaderV2(base), ciphertext);
  const object: EncryptedTextObjectV2 = {
    ...base,
    ciphertext,
    checksum: checksum16(payload),
  };
  return encodeEncryptedTextOuterV2(object);
}

function canonicalVaultBytes(seed: number): Uint8Array {
  const ciphertext = seededBytes(seed ^ 0x0a_11_5e, 58 + (seed % 48));
  const base = {
    magic: "PPXV" as const,
    formatVersion: 2 as const,
    suite: 2 as const,
    flags: 1 as const,
    kdfId: 1 as const,
    scryptN: 65_536 as const,
    scryptR: 8 as const,
    scryptP: 2 as const,
    salt: seededBytes(seed ^ 0x22_14_09, 16),
    nonce: seededBytes(seed ^ 0x4f_71_03, 12),
    ciphertextLength: ciphertext.byteLength,
  };
  const payload = concat(encodeLockedVaultHeaderV2(base), ciphertext);
  const vault: LockedVaultObjectV2 = {
    ...base,
    ciphertext,
    checksum: checksum16(payload),
  };
  return encodeLockedVaultV2(vault);
}

function canonicalFileBytes(seed: number): Uint8Array {
  const base = {
    header: {
      magic: "PPXF" as const,
      formatVersion: 2 as const,
      suite: 2 as const,
      flags: 0 as const,
      recipientId: seededBytes(seed ^ 0x11_21_31, 20),
      mlKemCiphertext: seededBytes(seed ^ 0x41_51_61, 1_568),
      noncePrefix: seededBytes(seed ^ 0x71_12_23, 8),
      salt: seededBytes(seed ^ 0x34_45_56, 32),
      declaredChunkCount: 0,
      chunkSize: 1_048_576 as const,
      totalFileLength: 0n,
    },
    chunks: [],
    manifest: {
      chunkIndex: 0xffff_ffff as const,
      plaintextLength: 1,
      ciphertext: seededBytes(seed ^ 0x67_78_09, 17),
    },
  };
  const object: EncryptedFileObjectV2 = {
    ...base,
    checksum: calculateEncryptedFileChecksumV2(base),
  };
  return encodeEncryptedFileObjectV2(object);
}

async function canonicalContactBytes(
  seed: number,
  pseudonym: string,
): Promise<Uint8Array> {
  const entropy = seededBytes(seed ^ 0x5c_a1_c5, 32);
  const identity = await deriveIdentityV2FromEntropy(
    entropy,
    pseudonym,
    BigInt(seed >>> 0),
  );
  try {
    return encodePublicContactV2(
      createPublicContactV2(
        identity,
        pseudonym,
        BigInt(seed >>> 0),
        seededBytes(seed ^ 0x7a_28_91, 32),
      ),
    );
  } finally {
    zeroize(
      entropy,
      identity.masterEntropy,
      identity.kemSecretKey,
      identity.signingSecretKey,
    );
  }
}

export async function canonicalCat5ProtocolBytes(
  seed = 0x5ca1_ab1e,
  pseudonym = "Cat5 Parser",
): Promise<Record<Cat5ProtocolFamily, Uint8Array>> {
  const ppxc = await canonicalContactBytes(seed, pseudonym);
  const ppxr = encodeRecoveryObjectV2({
    magic: "PPXR",
    formatVersion: 2,
    suite: 2,
    flags: 0,
    masterEntropy: seededBytes(seed ^ 0x12_34_56, 32),
    creationTime: BigInt(seed >>> 0),
    pseudonym,
    checksum: new Uint8Array(16),
  });
  return {
    ppxc,
    ppxt: canonicalTextBytes("PPXT", seed),
    ppxm: canonicalTextBytes("PPXM", seed ^ 0x3c_11_9a),
    ppxf: canonicalFileBytes(seed),
    ppxr,
    ppxv: canonicalVaultBytes(seed),
  };
}

export function parseCat5ForCanonicalRoundTrip(
  family: Cat5ProtocolFamily,
  bytes: Uint8Array,
): () => Uint8Array {
  switch (family) {
    case "ppxc": {
      const parsed = parsePublicContactV2(bytes);
      return () => encodePublicContactV2(parsed);
    }
    case "ppxt": {
      const parsed = parseEncryptedTextOuterV2(bytes, "PPXT");
      return () => encodeEncryptedTextOuterV2(parsed);
    }
    case "ppxm": {
      const parsed = parseEncryptedTextOuterV2(bytes, "PPXM");
      return () => encodeEncryptedTextOuterV2(parsed);
    }
    case "ppxf": {
      const parsed = parseEncryptedFileObjectV2(bytes);
      return () => encodeEncryptedFileObjectV2(parsed);
    }
    case "ppxr": {
      const parsed = parseRecoveryObjectV2(bytes);
      return () => encodeRecoveryObjectV2(parsed);
    }
    case "ppxv": {
      const parsed = parseLockedVaultV2(bytes);
      return () => encodeLockedVaultV2(parsed);
    }
  }
}
