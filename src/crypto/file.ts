import { sha512 } from "@noble/hashes/sha2.js";
import { StrictByteReader, StrictByteWriter } from "../protocol/bytes";
import { equalBytes } from "../protocol/checksum";
import {
  calculateEncryptedFileChecksum,
  encodeEncryptedFileObject,
  parseEncryptedFileObject,
  PPXF_ENCODED_MAX_BYTES,
} from "../protocol/ppxf";
import {
  encodeFileHeader,
  parseFileHeader,
  hashFileHeader,
  PPXF_CHUNK_BYTES,
  PPXF_FILE_MAX_BYTES,
  PPXF_HEADER_BYTES,
  requiredFileChunkCount,
} from "../protocol/ppxf-header";
import {
  createFileManifest,
  encodeFileManifest,
  parseFileManifest,
  PPXF_MANIFEST_MAX_BYTES,
} from "../protocol/ppxf-manifest";
import { encodePublicContact, parsePublicContact } from "../protocol/ppxc";
import {
  normalizeCaption,
  normalizeFilename,
  normalizeMimeHint,
} from "../protocol/text";
import {
  PPXError,
  type ChunkRecord,
  type DecryptedFileOutput,
  type DecryptFileInput,
  type DerivedIdentity,
  type EncryptedFileObject,
  type EncryptedFileBlobOutput,
  type EncryptFileInput,
  type FileHeader,
} from "../protocol/types";
import { decapsulateHybrid, encapsulateHybrid } from "./hybrid";
import { ed25519PublicKey } from "./noble-provider";
import { decryptAesGcm, encryptAesGcm } from "./webcrypto";
import { zeroize } from "./zeroize";

export interface FileCryptoHooks {
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

export class FileOperationCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "FileOperationCancelled";
  }
}

function throwIfCancelled(hooks?: FileCryptoHooks): void {
  if (hooks?.isCancelled?.()) throw new FileOperationCancelled();
}

export function createFileRecordNonce(
  noncePrefix: Uint8Array,
  chunkIndex: number,
): Uint8Array {
  if (noncePrefix.byteLength !== 8) throw new PPXError("impossible-length");
  const writer = new StrictByteWriter(12);
  writer.writeBytes(noncePrefix);
  writer.writeUint32BE(chunkIndex);
  return writer.toBytes();
}

export function createFileRecordAad(
  headerHash: Uint8Array,
  chunkIndex: number,
  plaintextLength: number,
  declaredChunkCount: number,
  totalFileLength: bigint,
): Uint8Array {
  if (headerHash.byteLength !== 64) throw new PPXError("impossible-length");
  const writer = new StrictByteWriter(84);
  writer.writeBytes(headerHash);
  writer.writeUint32BE(chunkIndex);
  writer.writeUint32BE(plaintextLength);
  writer.writeUint32BE(declaredChunkCount);
  writer.writeUint64BE(totalFileLength);
  return writer.toBytes();
}

function validateSigningCapability(
  input: EncryptFileInput,
  senderFingerprint: Uint8Array,
  senderSigningPublicKey: Uint8Array,
): void {
  const capability = input.senderSigningCapability;
  if (
    capability.signingSecretKey.byteLength !== 32 ||
    !equalBytes(capability.fingerprint, senderFingerprint) ||
    !equalBytes(capability.signingPublicKey, senderSigningPublicKey) ||
    !equalBytes(
      ed25519PublicKey(capability.signingSecretKey),
      senderSigningPublicKey,
    )
  ) {
    throw new PPXError("invalid-signature");
  }
}

export async function encryptFile(
  input: EncryptFileInput,
  hooks?: FileCryptoHooks,
): Promise<EncryptedFileObject> {
  const capability = input.senderSigningCapability;
  let hybrid: ReturnType<typeof encapsulateHybrid> | undefined;
  let manifestPlaintext: Uint8Array | undefined;
  let fileDigest: Uint8Array | undefined;
  let manifestDigest: Uint8Array | undefined;
  try {
    const sender = parsePublicContact(encodePublicContact(input.sender));
    const recipient = parsePublicContact(encodePublicContact(input.recipient));
    validateSigningCapability(
      input,
      sender.fingerprint,
      sender.signingPublicKey,
    );
    const actualLength = BigInt(input.file.size);
    if (
      input.fileLength !== actualLength ||
      actualLength < 0n ||
      actualLength > PPXF_FILE_MAX_BYTES
    ) {
      throw new PPXError(
        actualLength > PPXF_FILE_MAX_BYTES
          ? "oversize-before-allocation"
          : "impossible-length",
      );
    }
    const filename = normalizeFilename(input.filename);
    const mimeHint = normalizeMimeHint(input.mimeHint);
    const caption = normalizeCaption(input.caption);
    throwIfCancelled(hooks);
    hybrid = encapsulateHybrid({
      recipientFingerprint: recipient.fingerprint,
      recipientKemPublicKey: recipient.kemPublicKey,
      recipientX25519PublicKey: recipient.x25519PublicKey,
    });
    const header: FileHeader = {
      magic: "PPXF",
      formatVersion: 1,
      suite: 1,
      flags: 0,
      recipientId: Uint8Array.from(recipient.identityId),
      mlKemCiphertext: hybrid.mlKemCiphertext,
      ephemeralX25519PublicKey: hybrid.ephemeralX25519PublicKey,
      noncePrefix: crypto.getRandomValues(new Uint8Array(8)),
      salt: hybrid.salt,
      declaredChunkCount: requiredFileChunkCount(actualLength),
      chunkSize: PPXF_CHUNK_BYTES,
      totalFileLength: actualLength,
    };
    const headerHash = hashFileHeader(header);
    const digest = sha512.create();
    const chunks: ChunkRecord[] = [];
    for (let index = 0; index < header.declaredChunkCount; index += 1) {
      throwIfCancelled(hooks);
      const start = index * PPXF_CHUNK_BYTES;
      const end = Math.min(input.file.size, start + PPXF_CHUNK_BYTES);
      const plaintext = new Uint8Array(
        await input.file.slice(start, end).arrayBuffer(),
      );
      hooks?.onPlaintextRetained?.(plaintext.byteLength);
      try {
        throwIfCancelled(hooks);
        digest.update(plaintext);
        const aad = createFileRecordAad(
          headerHash,
          index,
          plaintext.byteLength,
          header.declaredChunkCount,
          header.totalFileLength,
        );
        const ciphertext = await encryptAesGcm(
          hybrid.aes256Key,
          createFileRecordNonce(header.noncePrefix, index),
          plaintext,
          aad,
        );
        throwIfCancelled(hooks);
        chunks.push({
          chunkIndex: index,
          plaintextLength: plaintext.byteLength,
          ciphertext,
        });
      } finally {
        zeroize(plaintext);
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
    const manifest = createFileManifest({
      senderContact: sender,
      signingSecretKey: capability.signingSecretKey,
      recipientId: recipient.identityId,
      filename,
      mimeHint,
      caption,
      fileLength: actualLength,
      chunkCount: header.declaredChunkCount,
      fullPlaintextDigest: fileDigest,
    });
    manifestDigest = manifest.fullPlaintextDigest;
    hooks?.onProgress?.({
      stage: "sign",
      completedBytes: actualLength,
      totalBytes: actualLength,
    });
    manifestPlaintext = encodeFileManifest(manifest);
    const manifestCiphertext = await encryptAesGcm(
      hybrid.aes256Key,
      createFileRecordNonce(header.noncePrefix, 0xffff_ffff),
      manifestPlaintext,
      createFileRecordAad(
        headerHash,
        0xffff_ffff,
        manifestPlaintext.byteLength,
        header.declaredChunkCount,
        header.totalFileLength,
      ),
    );
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
    const object: EncryptedFileObject = {
      ...base,
      checksum: calculateEncryptedFileChecksum(base),
    };
    hooks?.onProgress?.({
      stage: "serialize",
      completedBytes: actualLength,
      totalBytes: actualLength,
    });
    throwIfCancelled(hooks);
    return object;
  } finally {
    zeroize(capability.signingSecretKey);
    if (manifestPlaintext) zeroize(manifestPlaintext);
    if (fileDigest) zeroize(fileDigest);
    if (manifestDigest) zeroize(manifestDigest);
    if (hybrid) {
      zeroize(
        hybrid.aes256Key,
        hybrid.mlKemSharedSecret,
        hybrid.x25519SharedSecret,
      );
    }
  }
}

function encodeStreamingRecord(input: {
  chunkIndex: number;
  plaintextLength: number;
  ciphertext: Uint8Array;
}): Uint8Array {
  if (input.ciphertext.byteLength !== input.plaintextLength + 16) {
    throw new PPXError("impossible-length");
  }
  const writer = new StrictByteWriter(12 + input.ciphertext.byteLength);
  writer.writeUint32BE(input.chunkIndex);
  writer.writeUint32BE(input.plaintextLength);
  writer.writeUint32BE(input.ciphertext.byteLength);
  writer.writeBytes(input.ciphertext);
  return writer.toBytes();
}

export async function encryptFileToBlob(
  input: EncryptFileInput,
  hooks?: FileCryptoHooks,
): Promise<EncryptedFileBlobOutput> {
  const capability = input.senderSigningCapability;
  let hybrid: ReturnType<typeof encapsulateHybrid> | undefined;
  let manifestPlaintext: Uint8Array | undefined;
  let fileDigest: Uint8Array | undefined;
  let manifestDigest: Uint8Array | undefined;
  try {
    const sender = parsePublicContact(encodePublicContact(input.sender));
    const recipient = parsePublicContact(encodePublicContact(input.recipient));
    validateSigningCapability(
      input,
      sender.fingerprint,
      sender.signingPublicKey,
    );
    const actualLength = BigInt(input.file.size);
    if (
      input.fileLength !== actualLength ||
      actualLength < 0n ||
      actualLength > PPXF_FILE_MAX_BYTES
    ) {
      throw new PPXError(
        actualLength > PPXF_FILE_MAX_BYTES
          ? "oversize-before-allocation"
          : "impossible-length",
      );
    }
    const filename = normalizeFilename(input.filename);
    const mimeHint = normalizeMimeHint(input.mimeHint);
    const caption = normalizeCaption(input.caption);
    throwIfCancelled(hooks);
    hybrid = encapsulateHybrid({
      recipientFingerprint: recipient.fingerprint,
      recipientKemPublicKey: recipient.kemPublicKey,
      recipientX25519PublicKey: recipient.x25519PublicKey,
    });
    const header: FileHeader = {
      magic: "PPXF",
      formatVersion: 1,
      suite: 1,
      flags: 0,
      recipientId: Uint8Array.from(recipient.identityId),
      mlKemCiphertext: hybrid.mlKemCiphertext,
      ephemeralX25519PublicKey: hybrid.ephemeralX25519PublicKey,
      noncePrefix: crypto.getRandomValues(new Uint8Array(8)),
      salt: hybrid.salt,
      declaredChunkCount: requiredFileChunkCount(actualLength),
      chunkSize: PPXF_CHUNK_BYTES,
      totalFileLength: actualLength,
    };
    const headerHash = hashFileHeader(header);
    const plaintextDigest = sha512.create();
    const payloadDigest = sha512.create();
    const parts: Blob[] = [];
    const headerBytes = encodeFileHeader(header);
    payloadDigest.update(headerBytes);
    parts.push(new Blob([Uint8Array.from(headerBytes).buffer]));
    zeroize(headerBytes);

    for (let index = 0; index < header.declaredChunkCount; index += 1) {
      throwIfCancelled(hooks);
      const start = index * PPXF_CHUNK_BYTES;
      const end = Math.min(input.file.size, start + PPXF_CHUNK_BYTES);
      const plaintext = new Uint8Array(
        await input.file.slice(start, end).arrayBuffer(),
      );
      hooks?.onPlaintextRetained?.(plaintext.byteLength);
      try {
        throwIfCancelled(hooks);
        plaintextDigest.update(plaintext);
        const ciphertext = await encryptAesGcm(
          hybrid.aes256Key,
          createFileRecordNonce(header.noncePrefix, index),
          plaintext,
          createFileRecordAad(
            headerHash,
            index,
            plaintext.byteLength,
            header.declaredChunkCount,
            header.totalFileLength,
          ),
        );
        hooks?.onCiphertextRetained?.(ciphertext.byteLength);
        try {
          throwIfCancelled(hooks);
          const record = encodeStreamingRecord({
            chunkIndex: index,
            plaintextLength: plaintext.byteLength,
            ciphertext,
          });
          payloadDigest.update(record);
          parts.push(new Blob([Uint8Array.from(record).buffer]));
          zeroize(record);
        } finally {
          zeroize(ciphertext);
          hooks?.onCiphertextRetained?.(0);
        }
      } finally {
        zeroize(plaintext);
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
    fileDigest = plaintextDigest.digest();
    const manifest = createFileManifest({
      senderContact: sender,
      signingSecretKey: capability.signingSecretKey,
      recipientId: recipient.identityId,
      filename,
      mimeHint,
      caption,
      fileLength: actualLength,
      chunkCount: header.declaredChunkCount,
      fullPlaintextDigest: fileDigest,
    });
    manifestDigest = manifest.fullPlaintextDigest;
    hooks?.onProgress?.({
      stage: "sign",
      completedBytes: actualLength,
      totalBytes: actualLength,
    });
    manifestPlaintext = encodeFileManifest(manifest);
    const manifestCiphertext = await encryptAesGcm(
      hybrid.aes256Key,
      createFileRecordNonce(header.noncePrefix, 0xffff_ffff),
      manifestPlaintext,
      createFileRecordAad(
        headerHash,
        0xffff_ffff,
        manifestPlaintext.byteLength,
        header.declaredChunkCount,
        header.totalFileLength,
      ),
    );
    hooks?.onCiphertextRetained?.(manifestCiphertext.byteLength);
    try {
      const terminal = encodeStreamingRecord({
        chunkIndex: 0xffff_ffff,
        plaintextLength: manifestPlaintext.byteLength,
        ciphertext: manifestCiphertext,
      });
      payloadDigest.update(terminal);
      parts.push(new Blob([Uint8Array.from(terminal).buffer]));
      zeroize(terminal);
    } finally {
      zeroize(manifestCiphertext);
      hooks?.onCiphertextRetained?.(0);
    }
    throwIfCancelled(hooks);
    const payloadHash = payloadDigest.digest();
    const checksum = payloadHash.slice(0, 16);
    parts.push(new Blob([Uint8Array.from(checksum).buffer]));
    zeroize(payloadHash, checksum);
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
    if (manifestPlaintext) zeroize(manifestPlaintext);
    if (fileDigest) zeroize(fileDigest);
    if (manifestDigest) zeroize(manifestDigest);
    if (hybrid) {
      zeroize(
        hybrid.aes256Key,
        hybrid.mlKemSharedSecret,
        hybrid.x25519SharedSecret,
      );
    }
  }
}

export async function decryptFile(
  input: DecryptFileInput,
  hooks?: FileCryptoHooks,
): Promise<DecryptedFileOutput> {
  if (input.object instanceof Blob) {
    return decryptEncodedFileBlob(input.object, input.activeIdentity, hooks);
  }
  let key: Uint8Array | undefined;
  let manifestPlaintext: Uint8Array | undefined;
  let fileDigest: Uint8Array | undefined;
  let manifestDigest: Uint8Array | undefined;
  try {
    throwIfCancelled(hooks);
    const object = parseEncryptedFileObject(
      encodeEncryptedFileObject(input.object),
    );
    key = decapsulateHybrid({
      activeIdentity: input.activeIdentity,
      mlKemCiphertext: object.header.mlKemCiphertext,
      ephemeralX25519PublicKey: object.header.ephemeralX25519PublicKey,
      salt: object.header.salt,
    });
    const headerHash = hashFileHeader(object.header);
    const digest = sha512.create();
    const outputParts: Blob[] = [];
    let completed = 0n;
    for (const chunk of object.chunks) {
      throwIfCancelled(hooks);
      const plaintext = await decryptAesGcm(
        key,
        createFileRecordNonce(object.header.noncePrefix, chunk.chunkIndex),
        chunk.ciphertext,
        createFileRecordAad(
          headerHash,
          chunk.chunkIndex,
          chunk.plaintextLength,
          object.header.declaredChunkCount,
          object.header.totalFileLength,
        ),
      );
      hooks?.onPlaintextRetained?.(plaintext.byteLength);
      try {
        throwIfCancelled(hooks);
        digest.update(plaintext);
        outputParts.push(new Blob([Uint8Array.from(plaintext).buffer]));
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
    manifestPlaintext = await decryptAesGcm(
      key,
      createFileRecordNonce(object.header.noncePrefix, 0xffff_ffff),
      object.manifest.ciphertext,
      createFileRecordAad(
        headerHash,
        0xffff_ffff,
        object.manifest.plaintextLength,
        object.header.declaredChunkCount,
        object.header.totalFileLength,
      ),
    );
    throwIfCancelled(hooks);
    const manifest = parseFileManifest(manifestPlaintext);
    manifestDigest = manifest.fullPlaintextDigest;
    fileDigest = digest.digest();
    const blob = new Blob(outputParts, {
      type: manifest.mimeHint || "application/octet-stream",
    });
    if (
      !equalBytes(object.header.recipientId, input.activeIdentity.identityId) ||
      !equalBytes(manifest.recipientId, input.activeIdentity.identityId) ||
      manifest.fileLength !== object.header.totalFileLength ||
      manifest.chunkCount !== object.header.declaredChunkCount ||
      !equalBytes(manifest.fullPlaintextDigest, fileDigest) ||
      BigInt(blob.size) !== manifest.fileLength
    ) {
      throw new PPXError("wrong-identity-or-corruption");
    }
    throwIfCancelled(hooks);
    return {
      senderContact: manifest.senderContact,
      recipientId: manifest.recipientId,
      filename: manifest.filename,
      mimeHint: manifest.mimeHint,
      caption: manifest.caption,
      fileLength: manifest.fileLength,
      blob,
      digestValid: true,
      signatureValid: true,
    };
  } catch (error) {
    if (error instanceof FileOperationCancelled) throw error;
    if (error instanceof PPXError && error.code === "invalid-signature") {
      throw new PPXError("invalid-signature");
    }
    throw new PPXError("wrong-identity-or-corruption");
  } finally {
    if (key) zeroize(key);
    if (manifestPlaintext) zeroize(manifestPlaintext);
    if (fileDigest) zeroize(fileDigest);
    if (manifestDigest) zeroize(manifestDigest);
  }
}

interface EncodedRecordDescriptor {
  chunkIndex: number;
  plaintextLength: number;
  ciphertextOffset: number;
  ciphertextLength: number;
}

async function readEncodedSlice(
  file: Blob,
  start: number,
  end: number,
  hooks?: FileCryptoHooks,
): Promise<Uint8Array> {
  throwIfCancelled(hooks);
  const bytes = new Uint8Array(await file.slice(start, end).arrayBuffer());
  throwIfCancelled(hooks);
  if (bytes.byteLength !== end - start) {
    zeroize(bytes);
    throw new PPXError("impossible-length");
  }
  hooks?.onCiphertextRetained?.(bytes.byteLength);
  return bytes;
}

function releaseEncodedSlice(bytes: Uint8Array, hooks?: FileCryptoHooks): void {
  zeroize(bytes);
  hooks?.onCiphertextRetained?.(0);
}

async function verifyEncodedBlobChecksum(
  file: Blob,
  checksumOffset: number,
  hooks?: FileCryptoHooks,
): Promise<void> {
  const digest = sha512.create();
  for (let offset = 0; offset < checksumOffset; offset += PPXF_CHUNK_BYTES) {
    const end = Math.min(checksumOffset, offset + PPXF_CHUNK_BYTES);
    const bytes = await readEncodedSlice(file, offset, end, hooks);
    try {
      digest.update(bytes);
    } finally {
      releaseEncodedSlice(bytes, hooks);
    }
    hooks?.onProgress?.({
      stage: "parse",
      completedBytes: BigInt(end),
      totalBytes: BigInt(file.size),
    });
  }
  const checksum = await readEncodedSlice(
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
    releaseEncodedSlice(checksum, hooks);
  }
}

function expectedEncodedChunkLength(header: FileHeader, index: number): number {
  const consumed = BigInt(index) * BigInt(PPXF_CHUNK_BYTES);
  const remaining = header.totalFileLength - consumed;
  return Number(
    remaining > BigInt(PPXF_CHUNK_BYTES) ? BigInt(PPXF_CHUNK_BYTES) : remaining,
  );
}

async function readRecordDescriptor(
  file: Blob,
  offset: number,
  checksumOffset: number,
  expectedChunkIndex: number,
  expectedPlaintextLength: number | null,
  hooks?: FileCryptoHooks,
): Promise<{ descriptor: EncodedRecordDescriptor; nextOffset: number }> {
  if (offset + 12 > checksumOffset) throw new PPXError("impossible-length");
  const prefix = await readEncodedSlice(file, offset, offset + 12, hooks);
  try {
    const reader = new StrictByteReader(prefix, 12);
    const chunkIndex = reader.readUint32BE();
    const plaintextLength = reader.readUint32BE();
    const ciphertextLength = reader.readUint32BE();
    reader.requireEnd();
    if (
      chunkIndex !== expectedChunkIndex ||
      (expectedPlaintextLength === null
        ? plaintextLength < 1 || plaintextLength > PPXF_MANIFEST_MAX_BYTES
        : plaintextLength !== expectedPlaintextLength) ||
      ciphertextLength !== plaintextLength + 16 ||
      offset + 12 + ciphertextLength > checksumOffset
    ) {
      throw new PPXError(
        plaintextLength > PPXF_MANIFEST_MAX_BYTES &&
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
    releaseEncodedSlice(prefix, hooks);
  }
}

async function inspectEncodedFileBlob(
  file: Blob,
  hooks?: FileCryptoHooks,
): Promise<{
  header: FileHeader;
  chunks: EncodedRecordDescriptor[];
  manifest: EncodedRecordDescriptor;
}> {
  if (file.size > PPXF_ENCODED_MAX_BYTES) {
    throw new PPXError("oversize-before-allocation");
  }
  if (file.size < PPXF_HEADER_BYTES + 12 + 17 + 16) {
    throw new PPXError("impossible-length");
  }
  const checksumOffset = file.size - 16;
  const headerBytes = await readEncodedSlice(file, 0, PPXF_HEADER_BYTES, hooks);
  let header: FileHeader;
  try {
    header = parseFileHeader(headerBytes);
  } finally {
    releaseEncodedSlice(headerBytes, hooks);
  }
  const chunks: EncodedRecordDescriptor[] = [];
  let offset = PPXF_HEADER_BYTES;
  for (let index = 0; index < header.declaredChunkCount; index += 1) {
    const record = await readRecordDescriptor(
      file,
      offset,
      checksumOffset,
      index,
      expectedEncodedChunkLength(header, index),
      hooks,
    );
    chunks.push(record.descriptor);
    offset = record.nextOffset;
  }
  const terminal = await readRecordDescriptor(
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
  await verifyEncodedBlobChecksum(file, checksumOffset, hooks);
  return { header, chunks, manifest: terminal.descriptor };
}

async function decryptEncodedFileBlob(
  file: Blob,
  activeIdentity: DerivedIdentity,
  hooks?: FileCryptoHooks,
): Promise<DecryptedFileOutput> {
  let key: Uint8Array | undefined;
  let manifestPlaintext: Uint8Array | undefined;
  let fileDigest: Uint8Array | undefined;
  let manifestDigest: Uint8Array | undefined;
  try {
    const object = await inspectEncodedFileBlob(file, hooks);
    throwIfCancelled(hooks);
    key = decapsulateHybrid({
      activeIdentity,
      mlKemCiphertext: object.header.mlKemCiphertext,
      ephemeralX25519PublicKey: object.header.ephemeralX25519PublicKey,
      salt: object.header.salt,
    });
    const headerHash = hashFileHeader(object.header);
    const digest = sha512.create();
    const outputParts: Blob[] = [];
    let completed = 0n;
    for (const chunk of object.chunks) {
      throwIfCancelled(hooks);
      const ciphertext = await readEncodedSlice(
        file,
        chunk.ciphertextOffset,
        chunk.ciphertextOffset + chunk.ciphertextLength,
        hooks,
      );
      try {
        const plaintext = await decryptAesGcm(
          key,
          createFileRecordNonce(object.header.noncePrefix, chunk.chunkIndex),
          ciphertext,
          createFileRecordAad(
            headerHash,
            chunk.chunkIndex,
            chunk.plaintextLength,
            object.header.declaredChunkCount,
            object.header.totalFileLength,
          ),
        );
        hooks?.onPlaintextRetained?.(plaintext.byteLength);
        try {
          throwIfCancelled(hooks);
          digest.update(plaintext);
          outputParts.push(new Blob([Uint8Array.from(plaintext).buffer]));
        } finally {
          zeroize(plaintext);
          hooks?.onPlaintextRetained?.(0);
        }
      } finally {
        releaseEncodedSlice(ciphertext, hooks);
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
    const manifestCiphertext = await readEncodedSlice(
      file,
      object.manifest.ciphertextOffset,
      object.manifest.ciphertextOffset + object.manifest.ciphertextLength,
      hooks,
    );
    try {
      manifestPlaintext = await decryptAesGcm(
        key,
        createFileRecordNonce(object.header.noncePrefix, 0xffff_ffff),
        manifestCiphertext,
        createFileRecordAad(
          headerHash,
          0xffff_ffff,
          object.manifest.plaintextLength,
          object.header.declaredChunkCount,
          object.header.totalFileLength,
        ),
      );
    } finally {
      releaseEncodedSlice(manifestCiphertext, hooks);
    }
    throwIfCancelled(hooks);
    const manifest = parseFileManifest(manifestPlaintext);
    manifestDigest = manifest.fullPlaintextDigest;
    fileDigest = digest.digest();
    const blob = new Blob(outputParts, {
      type: manifest.mimeHint || "application/octet-stream",
    });
    if (
      !equalBytes(object.header.recipientId, activeIdentity.identityId) ||
      !equalBytes(manifest.recipientId, activeIdentity.identityId) ||
      manifest.fileLength !== object.header.totalFileLength ||
      manifest.chunkCount !== object.header.declaredChunkCount ||
      !equalBytes(manifest.fullPlaintextDigest, fileDigest) ||
      BigInt(blob.size) !== manifest.fileLength
    ) {
      throw new PPXError("wrong-identity-or-corruption");
    }
    throwIfCancelled(hooks);
    return {
      senderContact: manifest.senderContact,
      recipientId: manifest.recipientId,
      filename: manifest.filename,
      mimeHint: manifest.mimeHint,
      caption: manifest.caption,
      fileLength: manifest.fileLength,
      blob,
      digestValid: true,
      signatureValid: true,
    };
  } catch (error) {
    if (error instanceof FileOperationCancelled) throw error;
    if (error instanceof PPXError && error.code === "invalid-signature") {
      throw new PPXError("invalid-signature");
    }
    throw new PPXError("wrong-identity-or-corruption");
  } finally {
    if (key) zeroize(key);
    if (manifestPlaintext) zeroize(manifestPlaintext);
    if (fileDigest) zeroize(fileDigest);
    if (manifestDigest) zeroize(manifestDigest);
  }
}
