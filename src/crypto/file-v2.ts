import { sha512 } from "@noble/hashes/sha2.js";
import { StrictByteWriter } from "../protocol/bytes";
import { equalBytes } from "../protocol/checksum";
import {
  calculateEncryptedFileChecksumV2,
  validateEncryptedFileObjectV2,
} from "../protocol/ppxf-v2";
import {
  hashFileHeaderV2,
  PPXF_V2_CHUNK_BYTES,
  PPXF_V2_FILE_MAX_BYTES,
  requiredFileChunkCountV2,
} from "../protocol/ppxf-header-v2";
import {
  createFileManifestV2,
  encodeFileManifestV2,
  parseFileManifestV2,
} from "../protocol/ppxf-manifest-v2";
import {
  encodePublicContactV2,
  parsePublicContactV2,
} from "../protocol/ppxc-v2";
import {
  normalizeCaption,
  normalizeFilename,
  normalizeMimeHint,
} from "../protocol/text";
import { PPXError } from "../protocol/types";
import {
  ObjectFamilyV2,
  PPX_PQ_5_SUITE,
  PPX_V2_FORMAT_VERSION,
  type DecryptedFileOutputV2,
  type DecryptFileInputV2,
  type EncryptedFileObjectV2,
  type EncryptFileInputV2,
  type FileChunkRecordV2,
  type FileHeaderV2,
  type FileManifestV2,
} from "../protocol/types-v2";
import {
  decapsulateMlKemV2,
  encapsulateMlKemV2,
  type MlKemV2EncapsulationPrimitives,
} from "./kem-v2";
import { mlDsa87PublicKeyFromSecret } from "./pq-provider-v2";
import { decryptAesGcm, encryptAesGcm } from "./webcrypto";
import { zeroize } from "./zeroize";

export interface FileCryptoHooksV2 {
  isCancelled?: () => boolean;
  onProgress?: (input: {
    stage: "parse" | "encrypt" | "decrypt" | "sign" | "serialize";
    completedBytes: bigint;
    totalBytes: bigint;
    chunkIndex?: number;
  }) => void;
  onPlaintextRetained?: (bytes: number) => void;
  onCiphertextRetained?: (bytes: number) => void;
}

export interface FileEncryptionV2Primitives {
  kem?: MlKemV2EncapsulationPrimitives;
  randomBytes: (length: number) => Uint8Array;
}

const defaultPrimitives: FileEncryptionV2Primitives = {
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
};

export class FileOperationCancelledV2 extends Error {
  constructor() {
    super("cancelled");
    this.name = "FileOperationCancelledV2";
  }
}

function throwIfCancelled(hooks?: FileCryptoHooksV2): void {
  if (hooks?.isCancelled?.()) throw new FileOperationCancelledV2();
}

export function createFileRecordNonceV2(
  noncePrefix: Uint8Array,
  chunkIndex: number,
): Uint8Array {
  if (noncePrefix.byteLength !== 8) throw new PPXError("impossible-length");
  const writer = new StrictByteWriter(12);
  try {
    writer.writeBytes(noncePrefix);
    writer.writeUint32BE(chunkIndex);
    return writer.toBytes();
  } finally {
    writer.destroy();
  }
}

export function createFileRecordAadV2(
  headerHash: Uint8Array,
  chunkIndex: number,
  plaintextLength: number,
  declaredChunkCount: number,
  totalFileLength: bigint,
): Uint8Array {
  if (headerHash.byteLength !== 64) throw new PPXError("impossible-length");
  const writer = new StrictByteWriter(84);
  try {
    writer.writeBytes(headerHash);
    writer.writeUint32BE(chunkIndex);
    writer.writeUint32BE(plaintextLength);
    writer.writeUint32BE(declaredChunkCount);
    writer.writeUint64BE(totalFileLength);
    return writer.toBytes();
  } finally {
    writer.destroy();
  }
}

function validateSigningCapability(input: EncryptFileInputV2): void {
  const capability = input.senderSigningCapability;
  if (
    capability.suite !== PPX_PQ_5_SUITE ||
    capability.signingSecretKey.byteLength !== 4896 ||
    !equalBytes(capability.fingerprint, input.sender.fingerprint) ||
    !equalBytes(capability.signingPublicKey, input.sender.signingPublicKey) ||
    !equalBytes(
      mlDsa87PublicKeyFromSecret(capability.signingSecretKey),
      input.sender.signingPublicKey,
    )
  ) {
    throw new PPXError("invalid-signature");
  }
}

function validateFileInput(input: EncryptFileInputV2): {
  actualLength: bigint;
  filename: string;
  mimeHint: string;
  caption: string;
} {
  const actualLength = BigInt(input.file.size);
  if (
    input.fileLength !== actualLength ||
    actualLength < 0n ||
    actualLength > PPXF_V2_FILE_MAX_BYTES
  ) {
    throw new PPXError(
      actualLength > PPXF_V2_FILE_MAX_BYTES
        ? "oversize-before-allocation"
        : "impossible-length",
    );
  }
  return {
    actualLength,
    filename: normalizeFilename(input.filename),
    mimeHint: normalizeMimeHint(input.mimeHint),
    caption: normalizeCaption(input.caption),
  };
}

export async function encryptFileV2(
  input: EncryptFileInputV2,
  hooks?: FileCryptoHooksV2,
  primitives: FileEncryptionV2Primitives = defaultPrimitives,
): Promise<EncryptedFileObjectV2> {
  const capability = input.senderSigningCapability;
  let aesKey: Uint8Array | undefined;
  let headerHash: Uint8Array | undefined;
  let manifestPlaintext: Uint8Array | undefined;
  let fileDigest: Uint8Array | undefined;
  let signingEntropy: Uint8Array | undefined;
  let noncePrefix: Uint8Array | undefined;
  let manifest: FileManifestV2 | undefined;
  let manifestCiphertext: Uint8Array | undefined;
  let kem: ReturnType<typeof encapsulateMlKemV2> | undefined;
  const chunks: FileChunkRecordV2[] = [];
  let transferred = false;
  try {
    const sender = parsePublicContactV2(encodePublicContactV2(input.sender));
    const recipient = parsePublicContactV2(
      encodePublicContactV2(input.recipient),
    );
    validateSigningCapability({ ...input, sender });
    const { actualLength, filename, mimeHint, caption } =
      validateFileInput(input);
    throwIfCancelled(hooks);
    kem = encapsulateMlKemV2(
      {
        objectFamily: ObjectFamilyV2.File,
        recipientFingerprint: recipient.fingerprint,
        recipientKemPublicKey: recipient.kemPublicKey,
      },
      primitives.kem,
    );
    aesKey = kem.aes256Key;
    noncePrefix = primitives.randomBytes(8);
    if (noncePrefix.byteLength !== 8) throw new PPXError("impossible-length");
    const header: FileHeaderV2 = {
      magic: "PPXF",
      formatVersion: PPX_V2_FORMAT_VERSION,
      suite: PPX_PQ_5_SUITE,
      flags: 0,
      recipientId: Uint8Array.from(recipient.identityId),
      mlKemCiphertext: Uint8Array.from(kem.mlKemCiphertext),
      noncePrefix: Uint8Array.from(noncePrefix),
      salt: Uint8Array.from(kem.salt),
      declaredChunkCount: requiredFileChunkCountV2(actualLength),
      chunkSize: PPXF_V2_CHUNK_BYTES,
      totalFileLength: actualLength,
    };
    headerHash = hashFileHeaderV2(header);
    const digest = sha512.create();
    for (let index = 0; index < header.declaredChunkCount; index += 1) {
      throwIfCancelled(hooks);
      const start = index * PPXF_V2_CHUNK_BYTES;
      const end = Math.min(input.file.size, start + PPXF_V2_CHUNK_BYTES);
      const plaintext = new Uint8Array(
        await input.file.slice(start, end).arrayBuffer(),
      );
      hooks?.onPlaintextRetained?.(plaintext.byteLength);
      let nonce: Uint8Array | undefined;
      let aad: Uint8Array | undefined;
      let ciphertext: Uint8Array | undefined;
      try {
        throwIfCancelled(hooks);
        digest.update(plaintext);
        nonce = createFileRecordNonceV2(header.noncePrefix, index);
        aad = createFileRecordAadV2(
          headerHash,
          index,
          plaintext.byteLength,
          header.declaredChunkCount,
          header.totalFileLength,
        );
        ciphertext = await encryptAesGcm(aesKey, nonce, plaintext, aad);
        throwIfCancelled(hooks);
        chunks.push({
          chunkIndex: index,
          plaintextLength: plaintext.byteLength,
          ciphertext,
        });
        ciphertext = undefined;
      } finally {
        zeroize(plaintext);
        if (nonce) zeroize(nonce);
        if (aad) zeroize(aad);
        if (ciphertext) zeroize(ciphertext);
        hooks?.onPlaintextRetained?.(0);
      }
      hooks?.onProgress?.({
        stage: "encrypt",
        completedBytes: BigInt(end),
        totalBytes: actualLength,
        chunkIndex: index,
      });
    }
    throwIfCancelled(hooks);
    fileDigest = digest.digest();
    signingEntropy = primitives.randomBytes(32);
    if (signingEntropy.byteLength !== 32) {
      throw new PPXError("impossible-length");
    }
    manifest = createFileManifestV2({
      senderContact: sender,
      signingSecretKey: Uint8Array.from(capability.signingSecretKey),
      signatureEntropy: signingEntropy,
      recipientId: recipient.identityId,
      filename,
      mimeHint,
      caption,
      fileLength: actualLength,
      chunkCount: header.declaredChunkCount,
      fullPlaintextDigest: fileDigest,
    });
    hooks?.onProgress?.({
      stage: "sign",
      completedBytes: actualLength,
      totalBytes: actualLength,
    });
    manifestPlaintext = encodeFileManifestV2(manifest);
    const nonce = createFileRecordNonceV2(header.noncePrefix, 0xffff_ffff);
    const aad = createFileRecordAadV2(
      headerHash,
      0xffff_ffff,
      manifestPlaintext.byteLength,
      header.declaredChunkCount,
      header.totalFileLength,
    );
    try {
      manifestCiphertext = await encryptAesGcm(
        aesKey,
        nonce,
        manifestPlaintext,
        aad,
      );
    } finally {
      zeroize(nonce, aad);
    }
    throwIfCancelled(hooks);
    const base = {
      header,
      chunks,
      manifest: {
        chunkIndex: 0xffff_ffff as const,
        plaintextLength: manifestPlaintext.byteLength,
        ciphertext: manifestCiphertext,
      },
    };
    const object: EncryptedFileObjectV2 = {
      ...base,
      checksum: calculateEncryptedFileChecksumV2(base),
    };
    hooks?.onProgress?.({
      stage: "serialize",
      completedBytes: actualLength,
      totalBytes: actualLength,
    });
    throwIfCancelled(hooks);
    transferred = true;
    return object;
  } finally {
    zeroize(capability.signingSecretKey);
    if (aesKey) zeroize(aesKey);
    if (headerHash) zeroize(headerHash);
    if (manifestPlaintext) zeroize(manifestPlaintext);
    if (fileDigest) zeroize(fileDigest);
    if (signingEntropy) zeroize(signingEntropy);
    if (noncePrefix) zeroize(noncePrefix);
    if (kem) {
      zeroize(
        kem.recipientFingerprint,
        kem.salt,
        kem.mlKemCiphertext,
        kem.aes256Key,
      );
    }
    if (manifest) {
      zeroize(
        manifest.recipientId,
        manifest.fullPlaintextDigest,
        manifest.signature,
      );
    }
    if (!transferred) {
      for (const chunk of chunks) zeroize(chunk.ciphertext);
      if (manifestCiphertext) zeroize(manifestCiphertext);
    }
  }
}

export async function decryptFileV2(
  input: DecryptFileInputV2,
  hooks?: FileCryptoHooksV2,
): Promise<DecryptedFileOutputV2> {
  let key: Uint8Array | undefined;
  let headerHash: Uint8Array | undefined;
  let manifestPlaintext: Uint8Array | undefined;
  let fileDigest: Uint8Array | undefined;
  let manifestDigest: Uint8Array | undefined;
  let parsedManifest: FileManifestV2 | undefined;
  const plaintextParts: Blob[] = [];
  try {
    throwIfCancelled(hooks);
    validateEncryptedFileObjectV2(input.object);
    const object = input.object;
    hooks?.onProgress?.({
      stage: "parse",
      completedBytes: object.header.totalFileLength,
      totalBytes: object.header.totalFileLength,
    });
    key = decapsulateMlKemV2({
      objectFamily: ObjectFamilyV2.File,
      activeIdentity: input.activeIdentity,
      mlKemCiphertext: object.header.mlKemCiphertext,
      salt: object.header.salt,
    });
    headerHash = hashFileHeaderV2(object.header);
    const digest = sha512.create();
    let completed = 0n;
    for (const chunk of object.chunks) {
      throwIfCancelled(hooks);
      const nonce = createFileRecordNonceV2(
        object.header.noncePrefix,
        chunk.chunkIndex,
      );
      const aad = createFileRecordAadV2(
        headerHash,
        chunk.chunkIndex,
        chunk.plaintextLength,
        object.header.declaredChunkCount,
        object.header.totalFileLength,
      );
      let plaintext: Uint8Array;
      try {
        plaintext = await decryptAesGcm(key, nonce, chunk.ciphertext, aad);
      } finally {
        zeroize(nonce, aad);
      }
      hooks?.onPlaintextRetained?.(plaintext.byteLength);
      try {
        throwIfCancelled(hooks);
        digest.update(plaintext);
        plaintextParts.push(
          new Blob([Uint8Array.from(plaintext).buffer], {
            type: "application/octet-stream",
          }),
        );
      } finally {
        zeroize(plaintext);
        hooks?.onPlaintextRetained?.(0);
      }
      completed += BigInt(chunk.plaintextLength);
      hooks?.onProgress?.({
        stage: "decrypt",
        completedBytes: completed,
        totalBytes: object.header.totalFileLength,
        chunkIndex: chunk.chunkIndex,
      });
    }
    throwIfCancelled(hooks);
    const manifestNonce = createFileRecordNonceV2(
      object.header.noncePrefix,
      0xffff_ffff,
    );
    const manifestAad = createFileRecordAadV2(
      headerHash,
      0xffff_ffff,
      object.manifest.plaintextLength,
      object.header.declaredChunkCount,
      object.header.totalFileLength,
    );
    try {
      manifestPlaintext = await decryptAesGcm(
        key,
        manifestNonce,
        object.manifest.ciphertext,
        manifestAad,
      );
    } finally {
      zeroize(manifestNonce, manifestAad);
    }
    throwIfCancelled(hooks);
    const manifest = parseFileManifestV2(manifestPlaintext);
    parsedManifest = manifest;
    manifestDigest = manifest.fullPlaintextDigest;
    fileDigest = digest.digest();
    const retainedLength = plaintextParts.reduce(
      (length, part) => length + part.size,
      0,
    );
    if (
      !equalBytes(object.header.recipientId, input.activeIdentity.identityId) ||
      !equalBytes(manifest.recipientId, input.activeIdentity.identityId) ||
      manifest.fileLength !== object.header.totalFileLength ||
      manifest.chunkCount !== object.header.declaredChunkCount ||
      !equalBytes(manifest.fullPlaintextDigest, fileDigest) ||
      BigInt(retainedLength) !== manifest.fileLength
    ) {
      throw new PPXError("wrong-identity-or-corruption");
    }
    throwIfCancelled(hooks);
    const blob = new Blob(plaintextParts, {
      type: manifest.mimeHint || "application/octet-stream",
    });
    return {
      senderContact: manifest.senderContact,
      recipientId: Uint8Array.from(manifest.recipientId),
      filename: manifest.filename,
      mimeHint: manifest.mimeHint,
      caption: manifest.caption,
      fileLength: manifest.fileLength,
      blob,
      digestValid: true,
      signatureValid: true,
    };
  } catch (error) {
    if (error instanceof FileOperationCancelledV2) throw error;
    throw new PPXError("wrong-identity-or-corruption");
  } finally {
    if (key) zeroize(key);
    if (headerHash) zeroize(headerHash);
    if (manifestPlaintext) zeroize(manifestPlaintext);
    if (fileDigest) zeroize(fileDigest);
    if (manifestDigest) zeroize(manifestDigest);
    if (parsedManifest) {
      zeroize(parsedManifest.recipientId, parsedManifest.signature);
    }
    hooks?.onPlaintextRetained?.(0);
    zeroize(input.activeIdentity.kemSecretKey);
  }
}
