import { normalizePseudonym } from "../protocol/text";
import {
  PPXError,
  type DerivedIdentity,
  type SenderSigningCapability,
} from "../protocol/types";
import {
  deriveHkdfSha512,
  ed25519PublicKey,
  mlKem512Keygen,
  sha512Digest,
  x25519PublicKey,
} from "./noble-provider";
import { zeroize } from "./zeroize";

const encoder = new TextEncoder();
const IDENTITY_SALT = sha512Digest(encoder.encode("PPX/IDENTITY/V1/SALT"));

function concatBytes(...parts: Uint8Array[]): Uint8Array {
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

function derive(
  masterEntropy: Uint8Array,
  label: string,
  length: number,
  deriveKey: typeof deriveHkdfSha512 = deriveHkdfSha512,
): Uint8Array {
  return deriveKey(masterEntropy, IDENTITY_SALT, encoder.encode(label), length);
}

export interface IdentityDerivationPrimitives {
  deriveKey: typeof deriveHkdfSha512;
  keygen: typeof mlKem512Keygen;
  xPublicKey: typeof x25519PublicKey;
  signingPublicKey: typeof ed25519PublicKey;
}

const defaultIdentityDerivationPrimitives: IdentityDerivationPrimitives = {
  deriveKey: deriveHkdfSha512,
  keygen: mlKem512Keygen,
  xPublicKey: x25519PublicKey,
  signingPublicKey: ed25519PublicKey,
};

export function deriveFingerprint(input: {
  suite: 0x01;
  kemPublicKey: Uint8Array;
  x25519PublicKey: Uint8Array;
  signingPublicKey: Uint8Array;
}): Uint8Array {
  return sha512Digest(
    concatBytes(
      encoder.encode("PPX/IDENTITY/V1/FINGERPRINT"),
      Uint8Array.of(input.suite),
      input.kemPublicKey,
      input.x25519PublicKey,
      input.signingPublicKey,
    ),
  ).slice(0, 32);
}

export async function deriveIdentityFromEntropy(
  masterEntropy: Uint8Array,
  pseudonym = "",
  creationTime = 0n,
  primitives: IdentityDerivationPrimitives = defaultIdentityDerivationPrimitives,
): Promise<DerivedIdentity> {
  if (masterEntropy.byteLength !== 32) throw new PPXError("impossible-length");
  const normalizedPseudonym =
    pseudonym === "" ? "" : normalizePseudonym(pseudonym);
  let kemSeed: Uint8Array | undefined;
  let x25519SecretKey: Uint8Array | undefined;
  let signingSecretKey: Uint8Array | undefined;
  let historyKey: Uint8Array | undefined;
  let kemSecretKey: Uint8Array | undefined;
  let transferred = false;
  try {
    kemSeed = derive(
      masterEntropy,
      "PPX/IDENTITY/V1/ML-KEM-512/KEYGEN-SEED",
      64,
      primitives.deriveKey,
    );
    x25519SecretKey = derive(
      masterEntropy,
      "PPX/IDENTITY/V1/X25519/RECEIVE-SECRET",
      32,
      primitives.deriveKey,
    );
    signingSecretKey = derive(
      masterEntropy,
      "PPX/IDENTITY/V1/ED25519/SIGNING-SEED",
      32,
      primitives.deriveKey,
    );
    historyKey = derive(
      masterEntropy,
      "PPX/IDENTITY/V1/HISTORY-KEY",
      32,
      primitives.deriveKey,
    );
    const kem = await Promise.resolve().then(() => primitives.keygen(kemSeed));
    kemSecretKey = kem.secretKey;
    const xPublicKey = primitives.xPublicKey(x25519SecretKey);
    const signingPublicKey = primitives.signingPublicKey(signingSecretKey);
    const fingerprint = deriveFingerprint({
      suite: 0x01,
      kemPublicKey: kem.publicKey,
      x25519PublicKey: xPublicKey,
      signingPublicKey,
    });
    const identity: DerivedIdentity = {
      suite: 0x01,
      creationTime,
      masterEntropy: Uint8Array.from(masterEntropy),
      kemPublicKey: kem.publicKey,
      kemSecretKey,
      x25519PublicKey: xPublicKey,
      x25519SecretKey,
      signingPublicKey,
      signingSecretKey,
      fingerprint,
      identityId: fingerprint.slice(0, 20),
      pseudonym: normalizedPseudonym,
    };
    transferred = true;
    return identity;
  } finally {
    if (kemSeed) zeroize(kemSeed);
    if (historyKey) zeroize(historyKey);
    if (!transferred) {
      if (x25519SecretKey) zeroize(x25519SecretKey);
      if (signingSecretKey) zeroize(signingSecretKey);
      if (kemSecretKey) zeroize(kemSecretKey);
    }
  }
}

export function createSenderSigningCapability(
  identity: DerivedIdentity,
): SenderSigningCapability {
  return {
    fingerprint: Uint8Array.from(identity.fingerprint),
    signingPublicKey: Uint8Array.from(identity.signingPublicKey),
    signingSecretKey: Uint8Array.from(identity.signingSecretKey),
  };
}
