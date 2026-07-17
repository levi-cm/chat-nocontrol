import {
  mlDsa87PublicKeyFromSecret,
  mlDsa87Sign,
  mlDsa87Verify,
} from "../crypto/pq-provider-v2";
import { zeroize } from "../crypto/zeroize";
import { StrictByteReader, StrictByteWriter } from "./bytes";
import { equalBytes } from "./checksum";
import { encodePublicContactV2, parsePublicContactV2 } from "./ppxc-v2";
import {
  PPXF_V2_FILE_MAX_BYTES,
  requiredFileChunkCountV2,
} from "./ppxf-header-v2";
import { normalizeCaption, normalizeFilename, normalizeMimeHint } from "./text";
import { PPXError } from "./types";
import {
  PPX_PQ_5_SUITE,
  PPX_V2_FORMAT_VERSION,
  type FileManifestV2,
} from "./types-v2";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const MAGIC = encoder.encode("PPXF");
export const PPXF_V2_MANIFEST_SIGNATURE_CONTEXT = "PPX/FILE/MANIFEST/V2";
const SIGNATURE_CONTEXT = encoder.encode(PPXF_V2_MANIFEST_SIGNATURE_CONTEXT);
export const PPXF_V2_MANIFEST_SIGNATURE_BYTES = 4_627;
export const PPXF_V2_MANIFEST_MIN_BYTES = 13_563;
export const PPXF_V2_MANIFEST_MAX_BYTES = 30_375;

function concatBytes(...parts: Uint8Array[]): Uint8Array {
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

function canonicalText(
  bytes: Uint8Array,
  normalize: (value: string) => string,
): string {
  let value: string;
  try {
    value = decoder.decode(bytes);
  } catch {
    throw new PPXError("noncanonical-text");
  }
  if (normalize(value) !== value) throw new PPXError("noncanonical-text");
  return value;
}

function encodeUnsignedFileManifestV2(
  manifest: Omit<FileManifestV2, "signature">,
): Uint8Array {
  if (manifest.magic !== "PPXF") throw new PPXError("noncanonical-text");
  if (manifest.formatVersion !== PPX_V2_FORMAT_VERSION) {
    throw new PPXError("unknown-format-version");
  }
  if (manifest.suite !== PPX_PQ_5_SUITE) throw new PPXError("unknown-suite");
  if (manifest.chunkIndex !== 0xffff_ffff) {
    throw new PPXError("impossible-length");
  }
  if (
    manifest.recipientId.byteLength !== 20 ||
    manifest.fullPlaintextDigest.byteLength !== 64
  ) {
    throw new PPXError("impossible-length");
  }
  if (
    manifest.fileLength < 0n ||
    manifest.fileLength > PPXF_V2_FILE_MAX_BYTES
  ) {
    throw new PPXError(
      manifest.fileLength > PPXF_V2_FILE_MAX_BYTES
        ? "oversize-before-allocation"
        : "impossible-length",
    );
  }
  if (manifest.chunkCount !== requiredFileChunkCountV2(manifest.fileLength)) {
    throw new PPXError("impossible-length");
  }
  const sender = encodePublicContactV2(manifest.senderContact);
  const filename = encoder.encode(normalizeFilename(manifest.filename));
  const mimeHint = encoder.encode(normalizeMimeHint(manifest.mimeHint));
  const caption = encoder.encode(normalizeCaption(manifest.caption));
  const length =
    4 +
    1 +
    1 +
    4 +
    2 +
    sender.byteLength +
    20 +
    2 +
    filename.byteLength +
    1 +
    mimeHint.byteLength +
    4 +
    caption.byteLength +
    8 +
    4 +
    64;
  if (length + PPXF_V2_MANIFEST_SIGNATURE_BYTES > PPXF_V2_MANIFEST_MAX_BYTES) {
    throw new PPXError("oversize-before-allocation");
  }
  const writer = new StrictByteWriter(length);
  try {
    writer.writeBytes(MAGIC);
    writer.writeUint8(PPX_V2_FORMAT_VERSION);
    writer.writeUint8(PPX_PQ_5_SUITE);
    writer.writeUint32BE(0xffff_ffff);
    writer.writeUint16BE(sender.byteLength);
    writer.writeBytes(sender);
    writer.writeBytes(manifest.recipientId);
    writer.writeUint16BE(filename.byteLength);
    writer.writeBytes(filename);
    writer.writeUint8(mimeHint.byteLength);
    writer.writeBytes(mimeHint);
    writer.writeUint32BE(caption.byteLength);
    writer.writeBytes(caption);
    writer.writeUint64BE(manifest.fileLength);
    writer.writeUint32BE(manifest.chunkCount);
    writer.writeBytes(manifest.fullPlaintextDigest);
    return writer.toBytes();
  } finally {
    zeroize(sender, filename, mimeHint, caption);
    writer.destroy();
  }
}

export function createFileManifestV2(input: {
  senderContact: FileManifestV2["senderContact"];
  signingSecretKey: Uint8Array;
  signatureEntropy: Uint8Array;
  recipientId: Uint8Array;
  filename: string;
  mimeHint: string;
  caption: string;
  fileLength: bigint;
  chunkCount: number;
  fullPlaintextDigest: Uint8Array;
}): FileManifestV2 {
  let unsigned: Uint8Array | undefined;
  let secret: Uint8Array | undefined;
  let entropy: Uint8Array | undefined;
  let recipientId: Uint8Array | undefined;
  let digest: Uint8Array | undefined;
  let transferred = false;
  try {
    secret = Uint8Array.from(input.signingSecretKey);
    entropy = Uint8Array.from(input.signatureEntropy);
    if (
      secret.byteLength !== 4896 ||
      entropy.byteLength !== 32 ||
      !equalBytes(
        mlDsa87PublicKeyFromSecret(secret),
        input.senderContact.signingPublicKey,
      )
    ) {
      throw new PPXError("invalid-signature");
    }
    recipientId = Uint8Array.from(input.recipientId);
    digest = Uint8Array.from(input.fullPlaintextDigest);
    const manifest: Omit<FileManifestV2, "signature"> = {
      magic: "PPXF",
      formatVersion: PPX_V2_FORMAT_VERSION,
      suite: PPX_PQ_5_SUITE,
      chunkIndex: 0xffff_ffff,
      senderContact: input.senderContact,
      recipientId,
      filename: normalizeFilename(input.filename),
      mimeHint: normalizeMimeHint(input.mimeHint),
      caption: normalizeCaption(input.caption),
      fileLength: input.fileLength,
      chunkCount: input.chunkCount,
      fullPlaintextDigest: digest,
    };
    unsigned = encodeUnsignedFileManifestV2(manifest);
    const signature = mlDsa87Sign(unsigned, secret, SIGNATURE_CONTEXT, entropy);
    transferred = true;
    return { ...manifest, signature };
  } finally {
    zeroize(input.signingSecretKey, input.signatureEntropy);
    if (secret) zeroize(secret);
    if (entropy) zeroize(entropy);
    if (unsigned) zeroize(unsigned);
    if (!transferred) {
      if (recipientId) zeroize(recipientId);
      if (digest) zeroize(digest);
    }
  }
}

export function encodeFileManifestV2(manifest: FileManifestV2): Uint8Array {
  if (manifest.signature.byteLength !== PPXF_V2_MANIFEST_SIGNATURE_BYTES) {
    throw new PPXError("impossible-length");
  }
  const unsigned = encodeUnsignedFileManifestV2(manifest);
  try {
    if (
      !mlDsa87Verify(
        manifest.signature,
        unsigned,
        manifest.senderContact.signingPublicKey,
        SIGNATURE_CONTEXT,
      )
    ) {
      throw new PPXError("invalid-signature");
    }
    return concatBytes(unsigned, manifest.signature);
  } finally {
    zeroize(unsigned);
  }
}

export function parseFileManifestV2(bytes: Uint8Array): FileManifestV2 {
  if (
    bytes.byteLength < PPXF_V2_MANIFEST_MIN_BYTES ||
    bytes.byteLength > PPXF_V2_MANIFEST_MAX_BYTES
  ) {
    throw new PPXError(
      bytes.byteLength > PPXF_V2_MANIFEST_MAX_BYTES
        ? "oversize-before-allocation"
        : "impossible-length",
    );
  }
  let recipientId: Uint8Array | undefined;
  let fullPlaintextDigest: Uint8Array | undefined;
  let signature: Uint8Array | undefined;
  let unsigned: Uint8Array | undefined;
  let transferred = false;
  try {
    const reader = new StrictByteReader(bytes, PPXF_V2_MANIFEST_MAX_BYTES);
    const magic = reader.readBytes(4);
    const formatVersion = reader.readUint8();
    const suite = reader.readUint8();
    const chunkIndex = reader.readUint32BE();
    if (!equalBytes(magic, MAGIC)) throw new PPXError("noncanonical-text");
    if (formatVersion !== PPX_V2_FORMAT_VERSION) {
      throw new PPXError("unknown-format-version");
    }
    if (suite !== PPX_PQ_5_SUITE) throw new PPXError("unknown-suite");
    if (chunkIndex !== 0xffff_ffff) throw new PPXError("impossible-length");
    const senderLength = reader.readUint16BE();
    if (senderLength < 8_820 || senderLength > 8_867) {
      throw new PPXError("impossible-length");
    }
    const senderContact = parsePublicContactV2(reader.readBytes(senderLength));
    recipientId = reader.readBytes(20);
    const filenameLength = reader.readUint16BE();
    if (filenameLength < 1 || filenameLength > 255) {
      throw new PPXError("impossible-length");
    }
    const filename = canonicalText(
      reader.readBytes(filenameLength),
      normalizeFilename,
    );
    const mimeLength = reader.readUint8();
    if (mimeLength > 127) throw new PPXError("impossible-length");
    const mimeHint = canonicalText(
      reader.readBytes(mimeLength),
      normalizeMimeHint,
    );
    const captionLength = reader.readUint32BE();
    if (captionLength > 16_384) throw new PPXError("impossible-length");
    const caption = canonicalText(
      reader.readBytes(captionLength),
      normalizeCaption,
    );
    const fileLength = reader.readUint64BE();
    const chunkCount = reader.readUint32BE();
    fullPlaintextDigest = reader.readBytes(64);
    if (chunkCount !== requiredFileChunkCountV2(fileLength)) {
      throw new PPXError("impossible-length");
    }
    const signatureOffset = bytes.byteLength - PPXF_V2_MANIFEST_SIGNATURE_BYTES;
    if (reader.remaining() !== PPXF_V2_MANIFEST_SIGNATURE_BYTES) {
      throw new PPXError("impossible-length");
    }
    signature = reader.readBytes(PPXF_V2_MANIFEST_SIGNATURE_BYTES);
    reader.requireEnd();
    unsigned = bytes.slice(0, signatureOffset);
    if (
      !mlDsa87Verify(
        signature,
        unsigned,
        senderContact.signingPublicKey,
        SIGNATURE_CONTEXT,
      )
    ) {
      throw new PPXError("invalid-signature");
    }
    transferred = true;
    return {
      magic: "PPXF",
      formatVersion: PPX_V2_FORMAT_VERSION,
      suite: PPX_PQ_5_SUITE,
      chunkIndex: 0xffff_ffff,
      senderContact,
      recipientId,
      filename,
      mimeHint,
      caption,
      fileLength,
      chunkCount,
      fullPlaintextDigest,
      signature,
    };
  } finally {
    if (unsigned) zeroize(unsigned);
    if (!transferred) {
      if (recipientId) zeroize(recipientId);
      if (fullPlaintextDigest) zeroize(fullPlaintextDigest);
      if (signature) zeroize(signature);
    }
  }
}
