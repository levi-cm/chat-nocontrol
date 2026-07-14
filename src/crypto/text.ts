import { checksum16, equalBytes } from "../protocol/checksum";
import { encodePublicContact, parsePublicContact } from "../protocol/ppxc";
import {
  encodeSignedTextInner,
  parseSignedTextInner,
  PPXT_MAXIMUM_INNER_SIZE,
} from "../protocol/ppxt-inner";
import {
  encodeEncryptedTextHeader,
  encodeEncryptedTextOuter,
  parseEncryptedTextOuter,
} from "../protocol/ppxt-outer";
import {
  PPXError,
  type DecryptedTextOutput,
  type DecryptTextInput,
  type EncryptedTextObject,
  type EncryptTextInput,
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

function payloadChecksum(
  header: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  const payload = new Uint8Array(header.byteLength + ciphertext.byteLength);
  payload.set(header);
  payload.set(ciphertext, header.byteLength);
  return checksum16(payload);
}

export async function encryptText(
  input: EncryptTextInput,
): Promise<EncryptedTextObject> {
  const capability = input.senderSigningCapability;
  let hybrid: ReturnType<typeof encapsulateHybrid> | undefined;
  let inner: Uint8Array | undefined;
  let compressed: Uint8Array | undefined;
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
      )
    ) {
      throw new PPXError("invalid-signature");
    }
    hybrid = encapsulateHybrid({
      recipientFingerprint: recipient.fingerprint,
      recipientKemPublicKey: recipient.kemPublicKey,
      recipientX25519PublicKey: recipient.x25519PublicKey,
    });
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    inner = encodeSignedTextInner({
      senderContact: sender,
      signingSecretKey: capability.signingSecretKey,
      recipientId: recipient.identityId,
      messageId: input.messageId,
      sentAt: input.sentAt,
      createdAt: input.createdAt,
      plaintext: input.plaintext,
    });
    let envelope:
      { formatVersion: 1; flags: 0 } | { formatVersion: 2; flags: 1 } = {
      formatVersion: 1,
      flags: 0,
    };
    let aesPlaintext = inner;
    if (inner.byteLength >= 1_024 && supportsGzipStreams()) {
      try {
        compressed = await gzipBytes(inner);
        const minimumSavings = Math.max(64, Math.ceil(inner.byteLength * 0.1));
        if (compressed.byteLength <= inner.byteLength - minimumSavings) {
          envelope = { formatVersion: 2, flags: 1 };
          aesPlaintext = compressed;
        } else {
          zeroize(compressed);
          compressed = undefined;
        }
      } catch {
        if (compressed) zeroize(compressed);
        compressed = undefined;
      }
    }
    const base = {
      magic: "PPXT" as const,
      ...envelope,
      suite: 1 as const,
      mlKemCiphertext: hybrid.mlKemCiphertext,
      ephemeralX25519PublicKey: hybrid.ephemeralX25519PublicKey,
      salt: hybrid.salt,
      nonce,
      ciphertextLength: aesPlaintext.byteLength + 16,
    };
    const header = encodeEncryptedTextHeader(base);
    const ciphertext = await encryptAesGcm(
      hybrid.aes256Key,
      nonce,
      aesPlaintext,
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
    if (compressed) zeroize(compressed);
  }
}

export async function decryptText(
  input: DecryptTextInput,
): Promise<DecryptedTextOutput> {
  let key: Uint8Array | undefined;
  let decrypted: Uint8Array | undefined;
  let inner: Uint8Array | undefined;
  try {
    const object = parseEncryptedTextOuter(
      encodeEncryptedTextOuter(input.object),
    );
    key = decapsulateHybrid({
      activeIdentity: input.activeIdentity,
      mlKemCiphertext: object.mlKemCiphertext,
      ephemeralX25519PublicKey: object.ephemeralX25519PublicKey,
      salt: object.salt,
    });
    const header = encodeEncryptedTextHeader(object);
    decrypted = await decryptAesGcm(
      key,
      object.nonce,
      object.ciphertext,
      header,
    );
    if (object.formatVersion === 2) {
      if (!supportsGzipStreams()) {
        throw new PPXError("unsupported-compression");
      }
      inner = await gunzipBytesBounded(decrypted, PPXT_MAXIMUM_INNER_SIZE);
    } else {
      inner = decrypted;
    }
    const output = parseSignedTextInner(inner);
    if (!equalBytes(output.recipientId, input.activeIdentity.identityId)) {
      throw new PPXError("wrong-identity-or-corruption");
    }
    return output;
  } catch (error) {
    if (
      error instanceof PPXError &&
      (error.code === "invalid-signature" ||
        error.code === "unsupported-compression")
    ) {
      throw new PPXError(error.code);
    }
    throw new PPXError("wrong-identity-or-corruption");
  } finally {
    if (key) zeroize(key);
    if (inner) zeroize(inner);
    if (decrypted && decrypted !== inner) zeroize(decrypted);
  }
}
