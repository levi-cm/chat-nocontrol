import { checksum16, equalBytes } from "../protocol/checksum";
import {
  encodeSignedQrTextInner,
  parseSignedQrTextInner,
  PPXQ_MAXIMUM_ORIGINAL_UTF8_SIZE,
  PPXQ_MAXIMUM_STORED_PAYLOAD_SIZE,
} from "../protocol/ppxq-inner";
import {
  encodeEncryptedQrText,
  encodeEncryptedQrTextHeader,
  parseEncryptedQrText,
} from "../protocol/ppxq-outer";
import { encodePublicContact, parsePublicContact } from "../protocol/ppxc";
import {
  PPXError,
  type DecryptedQrTextOutput,
  type DecryptQrTextInput,
  type EncryptedQrTextObject,
  type EncryptQrTextInput,
} from "../protocol/types";
import { decapsulateHybrid, encapsulateHybrid } from "./hybrid";
import { ed25519PublicKey } from "./noble-provider";
import {
  gzipBytes,
  gunzipBytesBounded,
  supportsGzipStreams,
} from "./text-compression";
import { decryptAesGcm, encryptAesGcm } from "./webcrypto";
import { zeroize } from "./zeroize";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function payloadChecksum(
  header: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  const payload = new Uint8Array(header.byteLength + ciphertext.byteLength);
  payload.set(header);
  payload.set(ciphertext, header.byteLength);
  return checksum16(payload);
}

export async function encryptQrText(
  input: EncryptQrTextInput,
): Promise<EncryptedQrTextObject> {
  const capability = input.senderSigningCapability;
  let hybrid: ReturnType<typeof encapsulateHybrid> | undefined;
  let raw: Uint8Array | undefined;
  let compressed: Uint8Array | undefined;
  let inner: Uint8Array | undefined;
  try {
    const sender = parsePublicContact(encodePublicContact(input.sender));
    const recipient = parsePublicContact(encodePublicContact(input.recipient));
    if (
      !equalBytes(capability.fingerprint, sender.fingerprint) ||
      !equalBytes(capability.signingPublicKey, sender.signingPublicKey) ||
      capability.signingSecretKey.byteLength !== 32 ||
      !equalBytes(
        ed25519PublicKey(capability.signingSecretKey),
        sender.signingPublicKey,
      ) ||
      input.messageId.byteLength !== 16
    ) {
      throw new PPXError("invalid-signature");
    }
    raw = encoder.encode(input.plaintext);
    if (raw.byteLength > PPXQ_MAXIMUM_ORIGINAL_UTF8_SIZE) {
      throw new PPXError("impossible-length");
    }
    let flags: 0 | 1 = 0;
    let stored = raw;
    if (supportsGzipStreams()) {
      try {
        compressed = await gzipBytes(raw);
        if (
          compressed.byteLength < raw.byteLength &&
          compressed.byteLength <= PPXQ_MAXIMUM_STORED_PAYLOAD_SIZE
        ) {
          flags = 1;
          stored = compressed;
        }
      } catch {
        if (compressed) zeroize(compressed);
        compressed = undefined;
      }
    }
    if (stored.byteLength > PPXQ_MAXIMUM_STORED_PAYLOAD_SIZE) {
      throw new PPXError("impossible-length");
    }
    hybrid = encapsulateHybrid({
      recipientFingerprint: recipient.fingerprint,
      recipientKemPublicKey: recipient.kemPublicKey,
      recipientX25519PublicKey: recipient.x25519PublicKey,
    });
    inner = encodeSignedQrTextInner({
      senderFingerprint: sender.fingerprint,
      signingSecretKey: capability.signingSecretKey,
      recipientId: recipient.identityId,
      messageId: input.messageId,
      sentAt: input.sentAt,
      createdAt: input.createdAt,
      originalUtf8Length: raw.byteLength,
      storedPayload: stored,
    });
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const base = {
      magic: "PPXQ" as const,
      formatVersion: 1 as const,
      suite: 1 as const,
      flags,
      mlKemCiphertext: hybrid.mlKemCiphertext,
      ephemeralX25519PublicKey: hybrid.ephemeralX25519PublicKey,
      salt: hybrid.salt,
      nonce,
      ciphertextLength: inner.byteLength + 16,
    };
    const header = encodeEncryptedQrTextHeader(base);
    const ciphertext = await encryptAesGcm(
      hybrid.aes256Key,
      nonce,
      inner,
      header,
    );
    return {
      ...base,
      ciphertext,
      checksum: payloadChecksum(header, ciphertext),
    };
  } finally {
    zeroize(capability.signingSecretKey);
    if (hybrid)
      zeroize(
        hybrid.aes256Key,
        hybrid.mlKemSharedSecret,
        hybrid.x25519SharedSecret,
      );
    if (inner) zeroize(inner);
    if (raw) zeroize(raw);
    if (compressed) zeroize(compressed);
  }
}

export async function decryptQrText(
  input: DecryptQrTextInput,
): Promise<DecryptedQrTextOutput> {
  let key: Uint8Array | undefined;
  let decrypted: Uint8Array | undefined;
  let decoded: Uint8Array | undefined;
  let storedPayload: Uint8Array | undefined;
  try {
    const object = parseEncryptedQrText(encodeEncryptedQrText(input.object));
    key = decapsulateHybrid({
      activeIdentity: input.activeIdentity,
      mlKemCiphertext: object.mlKemCiphertext,
      ephemeralX25519PublicKey: object.ephemeralX25519PublicKey,
      salt: object.salt,
    });
    decrypted = await decryptAesGcm(
      key,
      object.nonce,
      object.ciphertext,
      encodeEncryptedQrTextHeader(object),
    );
    const inner = parseSignedQrTextInner(decrypted, input.knownSenders);
    storedPayload = inner.storedPayload;
    if (!equalBytes(inner.recipientId, input.activeIdentity.identityId)) {
      throw new PPXError("wrong-identity-or-corruption");
    }
    if (object.flags === 1) {
      if (!supportsGzipStreams()) throw new PPXError("unsupported-compression");
      decoded = await gunzipBytesBounded(
        inner.storedPayload,
        PPXQ_MAXIMUM_ORIGINAL_UTF8_SIZE,
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
    if (encoder.encode(plaintext).byteLength !== decoded.byteLength) {
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
    if (decoded) zeroize(decoded);
    if (storedPayload) zeroize(storedPayload);
    if (decrypted) zeroize(decrypted);
  }
}
