import { checksum16, equalBytes } from "../protocol/checksum";
import { encodePublicContact, parsePublicContact } from "../protocol/ppxc";
import {
  encodeSignedTextInner,
  parseSignedTextInner,
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
    const base = {
      magic: "PPXT" as const,
      formatVersion: 1 as const,
      suite: 1 as const,
      flags: 0,
      mlKemCiphertext: hybrid.mlKemCiphertext,
      ephemeralX25519PublicKey: hybrid.ephemeralX25519PublicKey,
      salt: hybrid.salt,
      nonce,
      ciphertextLength: inner.byteLength + 16,
    };
    const header = encodeEncryptedTextHeader(base);
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
  }
}

export async function decryptText(
  input: DecryptTextInput,
): Promise<DecryptedTextOutput> {
  let key: Uint8Array | undefined;
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
    inner = await decryptAesGcm(key, object.nonce, object.ciphertext, header);
    const output = parseSignedTextInner(inner);
    if (!equalBytes(output.recipientId, input.activeIdentity.identityId)) {
      throw new PPXError("wrong-identity-or-corruption");
    }
    return output;
  } catch (error) {
    if (error instanceof PPXError && error.code === "invalid-signature") {
      throw new PPXError("invalid-signature");
    }
    throw new PPXError("wrong-identity-or-corruption");
  } finally {
    if (key) zeroize(key);
    if (inner) zeroize(inner);
  }
}
