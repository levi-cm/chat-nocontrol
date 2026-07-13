import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { checksum16 } from "../../protocol/checksum";
import {
  createPublicContact,
  encodePublicContact,
  parsePublicContact,
} from "../../protocol/ppxc";
import {
  calculateEncryptedFileChecksum,
  encodeEncryptedFileObject,
  parseEncryptedFileObject,
} from "../../protocol/ppxf";
import { encodeRecoveryObject, parseRecoveryObject } from "../../protocol/ppxr";
import {
  encodeEncryptedTextHeader,
  encodeEncryptedTextOuter,
  parseEncryptedTextOuter,
} from "../../protocol/ppxt-outer";
import {
  encodeLockedVault,
  encodeLockedVaultHeader,
  parseLockedVault,
} from "../../protocol/ppxv";
import type {
  EncryptedFileObject,
  EncryptedTextObject,
  LockedVaultObject,
} from "../../protocol/types";

export type ProtocolFamily = "ppxc" | "ppxv" | "ppxr" | "ppxt" | "ppxf";

export const protocolFamilies: readonly ProtocolFamily[] = [
  "ppxc",
  "ppxv",
  "ppxr",
  "ppxt",
  "ppxf",
];

export function parseForCanonicalRoundTrip(
  family: ProtocolFamily,
  bytes: Uint8Array,
): () => Uint8Array {
  switch (family) {
    case "ppxc": {
      const parsed = parsePublicContact(bytes);
      return () => encodePublicContact(parsed);
    }
    case "ppxv": {
      const parsed = parseLockedVault(bytes);
      return () => encodeLockedVault(parsed);
    }
    case "ppxr": {
      const parsed = parseRecoveryObject(bytes);
      return () => encodeRecoveryObject(parsed);
    }
    case "ppxt": {
      const parsed = parseEncryptedTextOuter(bytes);
      return () => encodeEncryptedTextOuter(parsed);
    }
    case "ppxf": {
      const parsed = parseEncryptedFileObject(bytes);
      return () => encodeEncryptedFileObject(parsed);
    }
  }
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

export async function canonicalProtocolBytes(
  entropy = Uint8Array.from({ length: 32 }, (_, index) => index),
  pseudonym = "Alice",
): Promise<Record<ProtocolFamily, Uint8Array>> {
  const identity = await deriveIdentityFromEntropy(
    entropy,
    pseudonym,
    1_700_000_000n,
  );
  const ppxc = encodePublicContact(
    createPublicContact(identity, pseudonym, 1_700_000_000n),
  );
  const ppxr = encodeRecoveryObject({
    magic: "PPXR",
    formatVersion: 1,
    suite: 1,
    flags: 0,
    masterEntropy: entropy,
    creationTime: 1_700_000_000n,
    pseudonym,
    checksum: new Uint8Array(16),
  });

  const vaultBase = {
    magic: "PPXV" as const,
    formatVersion: 1 as const,
    suite: 1 as const,
    flags: 1,
    kdfId: 1 as const,
    scryptN: 65_536 as const,
    scryptR: 8 as const,
    scryptP: 2 as const,
    salt: new Uint8Array(16).fill(0x11),
    nonce: new Uint8Array(12).fill(0x22),
    ciphertextLength: 64,
    ciphertext: new Uint8Array(64).fill(0x33),
  };
  const vaultPayload = concat(
    encodeLockedVaultHeader(vaultBase),
    vaultBase.ciphertext,
  );
  const vault: LockedVaultObject = {
    ...vaultBase,
    checksum: checksum16(vaultPayload),
  };
  const ppxv = encodeLockedVault(vault);

  const textBase = {
    magic: "PPXT" as const,
    formatVersion: 1 as const,
    suite: 1 as const,
    flags: 0,
    mlKemCiphertext: new Uint8Array(768).fill(0x44),
    ephemeralX25519PublicKey: new Uint8Array(32).fill(0x55),
    salt: new Uint8Array(32).fill(0x66),
    nonce: new Uint8Array(12).fill(0x77),
    ciphertextLength: 32,
    ciphertext: new Uint8Array(32).fill(0x88),
  };
  const textPayload = concat(
    encodeEncryptedTextHeader(textBase),
    textBase.ciphertext,
  );
  const textObject: EncryptedTextObject = {
    ...textBase,
    checksum: checksum16(textPayload),
  };
  const ppxt = encodeEncryptedTextOuter(textObject);

  const fileBase = {
    header: {
      magic: "PPXF" as const,
      formatVersion: 1 as const,
      suite: 1 as const,
      flags: 0 as const,
      recipientId: new Uint8Array(20).fill(0x10),
      mlKemCiphertext: new Uint8Array(768).fill(0x20),
      ephemeralX25519PublicKey: new Uint8Array(32).fill(0x30),
      noncePrefix: new Uint8Array(8).fill(0x40),
      salt: new Uint8Array(32).fill(0x50),
      declaredChunkCount: 1,
      chunkSize: 1_048_576 as const,
      totalFileLength: 3n,
    },
    chunks: [
      {
        chunkIndex: 0,
        plaintextLength: 3,
        ciphertext: new Uint8Array(19).fill(0x60),
      },
    ],
    manifest: {
      chunkIndex: 0xffff_ffff as const,
      plaintextLength: 32,
      ciphertext: new Uint8Array(48).fill(0x70),
    },
  };
  const fileObject: EncryptedFileObject = {
    ...fileBase,
    checksum: calculateEncryptedFileChecksum(fileBase),
  };
  const ppxf = encodeEncryptedFileObject(fileObject);

  return { ppxc, ppxv, ppxr, ppxt, ppxf };
}
