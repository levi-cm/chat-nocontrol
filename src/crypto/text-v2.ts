import { checksum16, equalBytes } from "../protocol/checksum";
import {
  encodePublicContactV2,
  parsePublicContactV2,
} from "../protocol/ppxc-v2";
import {
  encodeSignedCompactTextInnerV2,
  encodeSignedFullTextInnerV2,
  parseSignedCompactTextInnerV2,
  parseSignedFullTextInnerV2,
  PPX_TEXT_V2_MAXIMUM_ORIGINAL_UTF8_SIZE,
} from "../protocol/text-v2-inner";
import {
  encodeEncryptedTextHeaderV2,
  encodeEncryptedTextOuterV2,
  parseEncryptedTextOuterV2,
} from "../protocol/text-v2-outer";
import { PPXError } from "../protocol/types";
import {
  ObjectFamilyV2,
  type DecryptedTextOutputV2,
  type DecryptTextInputV2,
  type EncryptedTextObjectV2,
  type EncryptTextInputV2,
} from "../protocol/types-v2";
import {
  decapsulateMlKemV2,
  encapsulateMlKemV2,
  type MlKemV2EncapsulationPrimitives,
} from "./kem-v2";
import { mlDsa87PublicKeyFromSecret } from "./pq-provider-v2";
import {
  gzipBytes,
  gunzipBytesBounded,
  supportsGzipStreams,
} from "./text-compression";
import { decryptAesGcm, encryptAesGcm } from "./webcrypto";
import { zeroize } from "./zeroize";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export interface TextEncryptionV2Primitives {
  kem?: MlKemV2EncapsulationPrimitives;
  randomBytes: (length: number) => Uint8Array;
}

const defaultPrimitives: TextEncryptionV2Primitives = {
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
};

function payloadChecksum(
  header: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  const payload = new Uint8Array(header.length + ciphertext.length);
  try {
    payload.set(header);
    payload.set(ciphertext, header.length);
    return checksum16(payload);
  } finally {
    zeroize(payload);
  }
}

export async function encryptTextV2(
  input: EncryptTextInputV2,
  primitives: TextEncryptionV2Primitives = defaultPrimitives,
): Promise<EncryptedTextObjectV2> {
  const capability = input.senderSigningCapability;
  let raw: Uint8Array | undefined;
  let compressed: Uint8Array | undefined;
  let inner: Uint8Array | undefined;
  let signingEntropy: Uint8Array | undefined;
  let aesKey: Uint8Array | undefined;
  try {
    const sender = parsePublicContactV2(encodePublicContactV2(input.sender));
    const recipient = parsePublicContactV2(
      encodePublicContactV2(input.recipient),
    );
    if (
      capability.suite !== 2 ||
      capability.signingSecretKey.byteLength !== 4896 ||
      !equalBytes(capability.fingerprint, sender.fingerprint) ||
      !equalBytes(capability.signingPublicKey, sender.signingPublicKey) ||
      !equalBytes(
        mlDsa87PublicKeyFromSecret(capability.signingSecretKey),
        sender.signingPublicKey,
      ) ||
      input.messageId.byteLength !== 16
    ) {
      throw new PPXError("invalid-signature");
    }
    raw = encoder.encode(input.plaintext);
    if (raw.byteLength > PPX_TEXT_V2_MAXIMUM_ORIGINAL_UTF8_SIZE) {
      throw new PPXError("impossible-length");
    }
    let flags: 0 | 1 = 0;
    let stored = raw;
    if (supportsGzipStreams()) {
      try {
        compressed = await gzipBytes(raw);
        const minimumSavings = Math.max(64, Math.ceil(raw.byteLength * 0.1));
        if (compressed.byteLength <= raw.byteLength - minimumSavings) {
          flags = 1;
          stored = compressed;
        } else {
          zeroize(compressed);
          compressed = undefined;
        }
      } catch {
        if (compressed) zeroize(compressed);
        compressed = undefined;
      }
    }
    const family = input.compact
      ? ObjectFamilyV2.CompactText
      : ObjectFamilyV2.Text;
    const kem = encapsulateMlKemV2(
      {
        objectFamily: family,
        recipientFingerprint: recipient.fingerprint,
        recipientKemPublicKey: recipient.kemPublicKey,
      },
      primitives.kem,
    );
    aesKey = kem.aes256Key;
    signingEntropy = primitives.randomBytes(32);
    if (signingEntropy.byteLength !== 32) {
      throw new PPXError("impossible-length");
    }
    const common = {
      signingSecretKey: Uint8Array.from(capability.signingSecretKey),
      recipientId: recipient.identityId,
      messageId: input.messageId,
      sentAt: input.sentAt,
      createdAt: input.createdAt,
      originalUtf8Length: raw.byteLength,
      storedPayload: stored,
      signatureEntropy: signingEntropy,
    };
    inner = input.compact
      ? encodeSignedCompactTextInnerV2({
          ...common,
          senderFingerprint: sender.fingerprint,
        })
      : encodeSignedFullTextInnerV2({ ...common, senderContact: sender });
    const nonce = primitives.randomBytes(12);
    if (nonce.byteLength !== 12) throw new PPXError("impossible-length");
    const base = {
      magic: input.compact ? ("PPXM" as const) : ("PPXT" as const),
      formatVersion: 2 as const,
      suite: 2 as const,
      flags,
      mlKemCiphertext: kem.mlKemCiphertext,
      salt: kem.salt,
      nonce,
      ciphertextLength: inner.byteLength + 16,
    };
    const header = encodeEncryptedTextHeaderV2(base);
    const ciphertext = await encryptAesGcm(aesKey, nonce, inner, header);
    return {
      ...base,
      ciphertext,
      checksum: payloadChecksum(header, ciphertext),
    };
  } finally {
    zeroize(capability.signingSecretKey);
    if (raw) zeroize(raw);
    if (compressed) zeroize(compressed);
    if (inner) zeroize(inner);
    if (signingEntropy) zeroize(signingEntropy);
    if (aesKey) zeroize(aesKey);
  }
}

export async function decryptTextV2(
  input: DecryptTextInputV2,
): Promise<DecryptedTextOutputV2> {
  let key: Uint8Array | undefined;
  let decrypted: Uint8Array | undefined;
  let decoded: Uint8Array | undefined;
  let reencoded: Uint8Array | undefined;
  let storedPayload: Uint8Array | undefined;
  try {
    const object = parseEncryptedTextOuterV2(
      encodeEncryptedTextOuterV2(input.object),
      input.object.magic,
    );
    const family =
      object.magic === "PPXT"
        ? ObjectFamilyV2.Text
        : ObjectFamilyV2.CompactText;
    key = decapsulateMlKemV2({
      objectFamily: family,
      activeIdentity: input.activeIdentity,
      mlKemCiphertext: object.mlKemCiphertext,
      salt: object.salt,
    });
    decrypted = await decryptAesGcm(
      key,
      object.nonce,
      object.ciphertext,
      encodeEncryptedTextHeaderV2(object),
    );
    const inner =
      object.magic === "PPXT"
        ? parseSignedFullTextInnerV2(decrypted)
        : parseSignedCompactTextInnerV2(decrypted, input.knownSenders);
    storedPayload = inner.storedPayload;
    if (!equalBytes(inner.recipientId, input.activeIdentity.identityId)) {
      throw new PPXError("wrong-identity-or-corruption");
    }
    if (object.flags === 1) {
      if (!supportsGzipStreams()) {
        throw new PPXError("unsupported-compression");
      }
      decoded = await gunzipBytesBounded(
        inner.storedPayload,
        PPX_TEXT_V2_MAXIMUM_ORIGINAL_UTF8_SIZE,
      );
    } else {
      decoded = Uint8Array.from(inner.storedPayload);
    }
    if (decoded.byteLength !== inner.originalUtf8Length) {
      throw new PPXError("wrong-identity-or-corruption");
    }
    let plaintext: string;
    try {
      plaintext = decoder.decode(decoded);
    } catch {
      throw new PPXError("wrong-identity-or-corruption");
    }
    reencoded = encoder.encode(plaintext);
    if (reencoded.byteLength !== decoded.byteLength) {
      throw new PPXError("wrong-identity-or-corruption");
    }
    return {
      senderContact: inner.senderContact,
      recipientId: inner.recipientId,
      messageId: inner.messageId,
      sentAt: inner.sentAt,
      createdAt: inner.createdAt,
      plaintext,
      signatureValid: true,
    };
  } catch (error) {
    if (
      error instanceof PPXError &&
      (error.code === "unknown-sender-contact" ||
        error.code === "unsupported-compression" ||
        error.code === "invalid-signature")
    ) {
      throw new PPXError(error.code);
    }
    throw new PPXError("wrong-identity-or-corruption");
  } finally {
    if (key) zeroize(key);
    if (decrypted) zeroize(decrypted);
    if (decoded) zeroize(decoded);
    if (reencoded) zeroize(reencoded);
    if (storedPayload) zeroize(storedPayload);
    zeroize(input.activeIdentity.kemSecretKey);
  }
}
