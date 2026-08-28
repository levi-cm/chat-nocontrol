import { sha512 } from "@noble/hashes/sha2.js";
import { StrictByteReader, StrictByteWriter } from "../protocol/bytes";
import { equalBytes } from "../protocol/checksum";
import {
  calculateEncryptedFileChecksumV2,
  PPXF_V2_ENCODED_MAX_BYTES,
  validateEncryptedFileObjectV2,
} from "../protocol/ppxf-v2";
import {
  encodeFileHeaderV2,
  hashFileHeaderV2,
  parseFileHeaderV2,
  PPXF_V2_CHUNK_BYTES,
  PPXF_V2_FILE_MAX_BYTES,
  PPXF_V2_HEADER_BYTES,
  requiredFileChunkCountV2,
} from "../protocol/ppxf-header-v2";
import {
  createFileManifestV2,
  encodeFileManifestV2,
  parseFileManifestV2,
  PPXF_V2_MANIFEST_MAX_BYTES,
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

export interface EncryptedFileBlobOutputV2 {
  blob: Blob;
  plaintextLength: bigint;
  encodedLength: bigint;
}

export interface DecryptFileSourceInputV2 {
  object: EncryptedFileObjectV2 | Blob;
  activeIdentity: DecryptFileInputV2["activeIdentity"];
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
      let nonce: Uint8Array | undefined;
      let aad: Uint8Array | undefined;
      let ciphertext: Uint8Array | undefined;
      try {
        hooks?.onPlaintextRetained?.(plaintext.byteLength);
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

function encodeStreamingRecordV2(input: {
  chunkIndex: number;
  plaintextLength: number;
  ciphertext: Uint8Array;
}): Uint8Array {
  if (input.ciphertext.byteLength !== input.plaintextLength + 16) {
    throw new PPXError("impossible-length");
  }
  const writer = new StrictByteWriter(12 + input.ciphertext.byteLength);
  try {
    writer.writeUint32BE(input.chunkIndex);
    writer.writeUint32BE(input.plaintextLength);
    writer.writeUint32BE(input.ciphertext.byteLength);
    writer.writeBytes(input.ciphertext);
    return writer.toBytes();
  } finally {
    writer.destroy();
  }
}

export async function encryptFileToBlobV2(
  input: EncryptFileInputV2,
  hooks?: FileCryptoHooksV2,
  primitives: FileEncryptionV2Primitives = defaultPrimitives,
): Promise<EncryptedFileBlobOutputV2> {
  const capability = input.senderSigningCapability;
  let kem: ReturnType<typeof encapsulateMlKemV2> | undefined;
  let aesKey: Uint8Array | undefined;
  let headerHash: Uint8Array | undefined;
  let manifestPlaintext: Uint8Array | undefined;
  let fileDigest: Uint8Array | undefined;
  let signingEntropy: Uint8Array | undefined;
  let noncePrefix: Uint8Array | undefined;
  let manifest: FileManifestV2 | undefined;
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
    const plaintextDigest = sha512.create();
    const payloadDigest = sha512.create();
    const parts: Blob[] = [];
    const headerBytes = encodeFileHeaderV2(header);
    try {
      payloadDigest.update(headerBytes);
      parts.push(new Blob([Uint8Array.from(headerBytes).buffer]));
    } finally {
      zeroize(headerBytes);
    }

    for (let index = 0; index < header.declaredChunkCount; index += 1) {
      throwIfCancelled(hooks);
      const start = index * PPXF_V2_CHUNK_BYTES;
      const end = Math.min(input.file.size, start + PPXF_V2_CHUNK_BYTES);
      const plaintext = new Uint8Array(
        await input.file.slice(start, end).arrayBuffer(),
      );
      let nonce: Uint8Array | undefined;
      let aad: Uint8Array | undefined;
      let ciphertext: Uint8Array | undefined;
      let record: Uint8Array | undefined;
      try {
        hooks?.onPlaintextRetained?.(plaintext.byteLength);
        throwIfCancelled(hooks);
        plaintextDigest.update(plaintext);
        nonce = createFileRecordNonceV2(header.noncePrefix, index);
        aad = createFileRecordAadV2(
          headerHash,
          index,
          plaintext.byteLength,
          header.declaredChunkCount,
          header.totalFileLength,
        );
        ciphertext = await encryptAesGcm(aesKey, nonce, plaintext, aad);
        hooks?.onCiphertextRetained?.(ciphertext.byteLength);
        throwIfCancelled(hooks);
        record = encodeStreamingRecordV2({
          chunkIndex: index,
          plaintextLength: plaintext.byteLength,
          ciphertext,
        });
        payloadDigest.update(record);
        parts.push(new Blob([Uint8Array.from(record).buffer]));
      } finally {
        zeroize(plaintext);
        if (nonce) zeroize(nonce);
        if (aad) zeroize(aad);
        if (ciphertext) zeroize(ciphertext);
        if (record) zeroize(record);
        hooks?.onPlaintextRetained?.(0);
        hooks?.onCiphertextRetained?.(0);
      }
      hooks?.onProgress?.({
        stage: "encrypt",
        completedBytes: BigInt(end),
        totalBytes: actualLength,
        chunkIndex: index,
      });
    }

    throwIfCancelled(hooks);
    fileDigest = plaintextDigest.digest();
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
    let manifestCiphertext: Uint8Array | undefined;
    let terminal: Uint8Array | undefined;
    try {
      manifestCiphertext = await encryptAesGcm(
        aesKey,
        nonce,
        manifestPlaintext,
        aad,
      );
      hooks?.onCiphertextRetained?.(manifestCiphertext.byteLength);
      terminal = encodeStreamingRecordV2({
        chunkIndex: 0xffff_ffff,
        plaintextLength: manifestPlaintext.byteLength,
        ciphertext: manifestCiphertext,
      });
      payloadDigest.update(terminal);
      parts.push(new Blob([Uint8Array.from(terminal).buffer]));
    } finally {
      zeroize(nonce, aad);
      if (manifestCiphertext) zeroize(manifestCiphertext);
      if (terminal) zeroize(terminal);
      hooks?.onCiphertextRetained?.(0);
    }
    throwIfCancelled(hooks);
    const payloadHash = payloadDigest.digest();
    const checksum = payloadHash.slice(0, 16);
    try {
      parts.push(new Blob([Uint8Array.from(checksum).buffer]));
    } finally {
      zeroize(payloadHash, checksum);
    }
    const blob = new Blob(parts, { type: "application/x-ppx-file" });
    hooks?.onProgress?.({
      stage: "serialize",
      completedBytes: actualLength,
      totalBytes: actualLength,
    });
    throwIfCancelled(hooks);
    return {
      blob,
      plaintextLength: actualLength,
      encodedLength: BigInt(blob.size),
    };
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
    hooks?.onPlaintextRetained?.(0);
    hooks?.onCiphertextRetained?.(0);
  }
}

function cloneEncryptedFileObjectV2(
  object: EncryptedFileObjectV2,
): EncryptedFileObjectV2 {
  return {
    header: {
      ...object.header,
      recipientId: Uint8Array.from(object.header.recipientId),
      mlKemCiphertext: Uint8Array.from(object.header.mlKemCiphertext),
      noncePrefix: Uint8Array.from(object.header.noncePrefix),
      salt: Uint8Array.from(object.header.salt),
    },
    chunks: object.chunks.map((chunk) => ({
      ...chunk,
      ciphertext: Uint8Array.from(chunk.ciphertext),
    })),
    manifest: {
      ...object.manifest,
      ciphertext: Uint8Array.from(object.manifest.ciphertext),
    },
    checksum: Uint8Array.from(object.checksum),
  };
}

export async function decryptFileV2(
  input: DecryptFileSourceInputV2,
  hooks?: FileCryptoHooksV2,
): Promise<DecryptedFileOutputV2> {
  if (input.object instanceof Blob) {
    return decryptEncodedFileBlobV2(input.object, input.activeIdentity, hooks);
  }
  let key: Uint8Array | undefined;
  let headerHash: Uint8Array | undefined;
  let manifestPlaintext: Uint8Array | undefined;
  let fileDigest: Uint8Array | undefined;
  let manifestDigest: Uint8Array | undefined;
  let parsedManifest: FileManifestV2 | undefined;
  let objectSnapshot: EncryptedFileObjectV2 | undefined;
  let plaintextParts: Blob[] | undefined;
  try {
    throwIfCancelled(hooks);
    validateEncryptedFileObjectV2(input.object);
    objectSnapshot = cloneEncryptedFileObjectV2(input.object);
    const object = objectSnapshot;
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
      try {
        hooks?.onPlaintextRetained?.(plaintext.byteLength);
        throwIfCancelled(hooks);
        digest.update(plaintext);
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
    if (
      !equalBytes(object.header.recipientId, input.activeIdentity.identityId) ||
      !equalBytes(manifest.recipientId, input.activeIdentity.identityId) ||
      manifest.fileLength !== object.header.totalFileLength ||
      manifest.chunkCount !== object.header.declaredChunkCount ||
      !equalBytes(manifest.fullPlaintextDigest, fileDigest) ||
      completed !== manifest.fileLength
    ) {
      throw new PPXError("wrong-identity-or-corruption");
    }
    throwIfCancelled(hooks);
    // The first pass above verifies every AEAD record, the signed manifest,
    // recipient binding and the whole-file digest while retaining only a
    // mutable chunk. Only after that gate may immutable Blob parts exist.
    plaintextParts = [];
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
      try {
        hooks?.onPlaintextRetained?.(plaintext.byteLength);
        throwIfCancelled(hooks);
        const immutableSource = Uint8Array.from(plaintext);
        try {
          plaintextParts.push(new Blob([immutableSource.buffer]));
          // Blob construction copies into immutable browser-managed memory.
          // Cancellation cannot wipe an already-created part, so stop before
          // decrypting another chunk and release every reference in `finally`.
          throwIfCancelled(hooks);
        } finally {
          zeroize(immutableSource);
        }
      } finally {
        zeroize(plaintext);
        hooks?.onPlaintextRetained?.(0);
      }
    }
    throwIfCancelled(hooks);
    const blob = new Blob(plaintextParts, {
      type: manifest.mimeHint || "application/octet-stream",
    });
    throwIfCancelled(hooks);
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
    if (objectSnapshot) {
      zeroize(
        objectSnapshot.header.recipientId,
        objectSnapshot.header.mlKemCiphertext,
        objectSnapshot.header.noncePrefix,
        objectSnapshot.header.salt,
        objectSnapshot.manifest.ciphertext,
        objectSnapshot.checksum,
      );
      for (const chunk of objectSnapshot.chunks) zeroize(chunk.ciphertext);
    }
    if (plaintextParts) plaintextParts.length = 0;
    zeroize(input.activeIdentity.kemSecretKey);
    hooks?.onPlaintextRetained?.(0);
  }
}

interface EncodedRecordDescriptorV2 {
  chunkIndex: number;
  plaintextLength: number;
  ciphertextOffset: number;
  ciphertextLength: number;
}

async function readEncodedSliceV2(
  file: Blob,
  start: number,
  end: number,
  hooks?: FileCryptoHooksV2,
  honorCancellation = true,
): Promise<Uint8Array> {
  if (honorCancellation) throwIfCancelled(hooks);
  const bytes = new Uint8Array(await file.slice(start, end).arrayBuffer());
  if (honorCancellation && hooks?.isCancelled?.()) {
    zeroize(bytes);
    throw new FileOperationCancelledV2();
  }
  if (bytes.byteLength !== end - start) {
    zeroize(bytes);
    throw new PPXError("impossible-length");
  }
  try {
    hooks?.onCiphertextRetained?.(bytes.byteLength);
  } catch (error) {
    zeroize(bytes);
    throw error;
  }
  return bytes;
}

function releaseEncodedSliceV2(
  bytes: Uint8Array,
  hooks?: FileCryptoHooksV2,
): void {
  zeroize(bytes);
  try {
    hooks?.onCiphertextRetained?.(0);
  } catch {
    // Reset notifications are diagnostic only and must never interrupt later
    // secret cleanup in a surrounding finally block.
  }
}

async function verifyEncodedBlobChecksumV2(
  file: Blob,
  checksumOffset: number,
  hooks?: FileCryptoHooksV2,
): Promise<void> {
  const digest = sha512.create();
  for (let offset = 0; offset < checksumOffset; offset += PPXF_V2_CHUNK_BYTES) {
    const end = Math.min(checksumOffset, offset + PPXF_V2_CHUNK_BYTES);
    const bytes = await readEncodedSliceV2(file, offset, end, hooks);
    try {
      digest.update(bytes);
    } finally {
      releaseEncodedSliceV2(bytes, hooks);
    }
    hooks?.onProgress?.({
      stage: "parse",
      completedBytes: BigInt(end),
      totalBytes: BigInt(file.size),
    });
  }
  const checksum = await readEncodedSliceV2(
    file,
    checksumOffset,
    file.size,
    hooks,
  );
  const fullDigest = digest.digest();
  const expected = fullDigest.slice(0, 16);
  try {
    if (!equalBytes(expected, checksum)) {
      throw new PPXError("checksum-mismatch");
    }
  } finally {
    zeroize(fullDigest, expected);
    releaseEncodedSliceV2(checksum, hooks);
  }
}

function expectedEncodedChunkLengthV2(
  header: FileHeaderV2,
  index: number,
): number {
  const consumed = BigInt(index) * BigInt(PPXF_V2_CHUNK_BYTES);
  const remaining = header.totalFileLength - consumed;
  return Number(
    remaining > BigInt(PPXF_V2_CHUNK_BYTES)
      ? BigInt(PPXF_V2_CHUNK_BYTES)
      : remaining,
  );
}

async function readRecordDescriptorV2(
  file: Blob,
  offset: number,
  checksumOffset: number,
  expectedChunkIndex: number,
  expectedPlaintextLength: number | null,
  hooks?: FileCryptoHooksV2,
): Promise<{ descriptor: EncodedRecordDescriptorV2; nextOffset: number }> {
  if (offset + 12 > checksumOffset) throw new PPXError("impossible-length");
  const prefix = await readEncodedSliceV2(file, offset, offset + 12, hooks);
  try {
    const reader = new StrictByteReader(prefix, 12);
    const chunkIndex = reader.readUint32BE();
    const plaintextLength = reader.readUint32BE();
    const ciphertextLength = reader.readUint32BE();
    reader.requireEnd();
    if (
      chunkIndex !== expectedChunkIndex ||
      (expectedPlaintextLength === null
        ? plaintextLength < 1 || plaintextLength > PPXF_V2_MANIFEST_MAX_BYTES
        : plaintextLength !== expectedPlaintextLength) ||
      ciphertextLength !== plaintextLength + 16 ||
      offset + 12 + ciphertextLength > checksumOffset
    ) {
      throw new PPXError(
        plaintextLength > PPXF_V2_MANIFEST_MAX_BYTES &&
          expectedPlaintextLength === null
          ? "oversize-before-allocation"
          : "impossible-length",
      );
    }
    return {
      descriptor: {
        chunkIndex,
        plaintextLength,
        ciphertextOffset: offset + 12,
        ciphertextLength,
      },
      nextOffset: offset + 12 + ciphertextLength,
    };
  } finally {
    releaseEncodedSliceV2(prefix, hooks);
  }
}

async function inspectEncodedFileBlobV2(
  file: Blob,
  hooks?: FileCryptoHooksV2,
): Promise<{
  header: FileHeaderV2;
  chunks: EncodedRecordDescriptorV2[];
  manifest: EncodedRecordDescriptorV2;
}> {
  if (file.size > PPXF_V2_ENCODED_MAX_BYTES) {
    throw new PPXError("oversize-before-allocation");
  }
  if (file.size < PPXF_V2_HEADER_BYTES + 12 + 17 + 16) {
    throw new PPXError("impossible-length");
  }
  const checksumOffset = file.size - 16;
  const headerBytes = await readEncodedSliceV2(
    file,
    0,
    PPXF_V2_HEADER_BYTES,
    hooks,
  );
  let header: FileHeaderV2;
  try {
    header = parseFileHeaderV2(headerBytes);
  } finally {
    releaseEncodedSliceV2(headerBytes, hooks);
  }
  const chunks: EncodedRecordDescriptorV2[] = [];
  let offset = PPXF_V2_HEADER_BYTES;
  for (let index = 0; index < header.declaredChunkCount; index += 1) {
    const record = await readRecordDescriptorV2(
      file,
      offset,
      checksumOffset,
      index,
      expectedEncodedChunkLengthV2(header, index),
      hooks,
    );
    chunks.push(record.descriptor);
    offset = record.nextOffset;
  }
  const terminal = await readRecordDescriptorV2(
    file,
    offset,
    checksumOffset,
    0xffff_ffff,
    null,
    hooks,
  );
  if (terminal.nextOffset !== checksumOffset) {
    throw new PPXError("trailing-bytes");
  }
  await verifyEncodedBlobChecksumV2(file, checksumOffset, hooks);
  return { header, chunks, manifest: terminal.descriptor };
}

async function decryptEncodedFileBlobV2(
  file: Blob,
  activeIdentity: DecryptFileInputV2["activeIdentity"],
  hooks?: FileCryptoHooksV2,
): Promise<DecryptedFileOutputV2> {
  let key: Uint8Array | undefined;
  let headerHash: Uint8Array | undefined;
  let manifestPlaintext: Uint8Array | undefined;
  let fileDigest: Uint8Array | undefined;
  let manifestDigest: Uint8Array | undefined;
  let parsedManifest: FileManifestV2 | undefined;
  let plaintextParts: Blob[] | undefined;
  try {
    const object = await inspectEncodedFileBlobV2(file, hooks);
    throwIfCancelled(hooks);
    key = decapsulateMlKemV2({
      objectFamily: ObjectFamilyV2.File,
      activeIdentity,
      mlKemCiphertext: object.header.mlKemCiphertext,
      salt: object.header.salt,
    });
    headerHash = hashFileHeaderV2(object.header);
    const digest = sha512.create();
    let completed = 0n;
    for (const chunk of object.chunks) {
      throwIfCancelled(hooks);
      const ciphertext = await readEncodedSliceV2(
        file,
        chunk.ciphertextOffset,
        chunk.ciphertextOffset + chunk.ciphertextLength,
        hooks,
      );
      let plaintext: Uint8Array | undefined;
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
      try {
        plaintext = await decryptAesGcm(key, nonce, ciphertext, aad);
        hooks?.onPlaintextRetained?.(plaintext.byteLength);
        throwIfCancelled(hooks);
        digest.update(plaintext);
      } finally {
        releaseEncodedSliceV2(ciphertext, hooks);
        zeroize(nonce, aad);
        if (plaintext) zeroize(plaintext);
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
    const manifestCiphertext = await readEncodedSliceV2(
      file,
      object.manifest.ciphertextOffset,
      object.manifest.ciphertextOffset + object.manifest.ciphertextLength,
      hooks,
    );
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
        manifestCiphertext,
        manifestAad,
      );
    } finally {
      releaseEncodedSliceV2(manifestCiphertext, hooks);
      zeroize(manifestNonce, manifestAad);
    }
    throwIfCancelled(hooks);
    const manifest = parseFileManifestV2(manifestPlaintext);
    parsedManifest = manifest;
    manifestDigest = manifest.fullPlaintextDigest;
    fileDigest = digest.digest();
    if (
      !equalBytes(object.header.recipientId, activeIdentity.identityId) ||
      !equalBytes(manifest.recipientId, activeIdentity.identityId) ||
      manifest.fileLength !== object.header.totalFileLength ||
      manifest.chunkCount !== object.header.declaredChunkCount ||
      !equalBytes(manifest.fullPlaintextDigest, fileDigest) ||
      completed !== manifest.fileLength
    ) {
      throw new PPXError("wrong-identity-or-corruption");
    }
    throwIfCancelled(hooks);

    // Blob input is immutable. A second pass begins only after complete
    // cryptographic verification, so authentication, binding, and digest
    // failures create no immutable plaintext. Cancellation can race one Blob
    // construction; that unavoidable part is dereferenced before propagating.
    plaintextParts = [];
    for (const chunk of object.chunks) {
      throwIfCancelled(hooks);
      const ciphertext = await readEncodedSliceV2(
        file,
        chunk.ciphertextOffset,
        chunk.ciphertextOffset + chunk.ciphertextLength,
        hooks,
      );
      let plaintext: Uint8Array | undefined;
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
      try {
        plaintext = await decryptAesGcm(key, nonce, ciphertext, aad);
        hooks?.onPlaintextRetained?.(plaintext.byteLength);
        throwIfCancelled(hooks);
        const immutableSource = Uint8Array.from(plaintext);
        try {
          plaintextParts.push(new Blob([immutableSource.buffer]));
          // Immutable Blob bytes cannot be zeroized. On cancellation, retain
          // no reference and do not decrypt or construct another part.
          throwIfCancelled(hooks);
        } finally {
          zeroize(immutableSource);
        }
      } finally {
        releaseEncodedSliceV2(ciphertext, hooks);
        zeroize(nonce, aad);
        if (plaintext) zeroize(plaintext);
        hooks?.onPlaintextRetained?.(0);
      }
    }
    throwIfCancelled(hooks);
    const blob = new Blob(plaintextParts, {
      type: manifest.mimeHint || "application/octet-stream",
    });
    throwIfCancelled(hooks);
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
    if (plaintextParts) plaintextParts.length = 0;
    zeroize(activeIdentity.kemSecretKey);
    hooks?.onPlaintextRetained?.(0);
    hooks?.onCiphertextRetained?.(0);
  }
}
