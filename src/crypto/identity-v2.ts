import { normalizePseudonym } from "../protocol/text";
import { PPXError } from "../protocol/types";
import {
  PPX_PQ_5_SUITE,
  type DecapsulationCapabilityV2,
  type DerivedIdentityV2,
  type SenderSigningCapabilityV2,
} from "../protocol/types-v2";
import { deriveHkdfSha512, sha512Digest } from "./noble-provider";
import { mlDsa87Keygen, mlKem1024Keygen } from "./pq-provider-v2";
import { zeroize } from "./zeroize";

const encoder = new TextEncoder();
const IDENTITY_SALT = sha512Digest(encoder.encode("PPX/IDENTITY/V2/SALT"));
export const V2_KEM_SEED_LABEL = "PPX/IDENTITY/V2/ML-KEM-1024/KEYGEN-SEED";
export const V2_DSA_SEED_LABEL = "PPX/IDENTITY/V2/ML-DSA-87/SIGNING-SEED";
export const V2_FINGERPRINT_DOMAIN = "PPX/IDENTITY/V2/FINGERPRINT";

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    parts.reduce((length, part) => length + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function derive(
  master: Uint8Array,
  label: string,
  length: number,
  deriveKey: typeof deriveHkdfSha512,
): Uint8Array {
  return deriveKey(master, IDENTITY_SALT, encoder.encode(label), length);
}

export interface IdentityV2DerivationPrimitives {
  deriveKey: typeof deriveHkdfSha512;
  kemKeygen: typeof mlKem1024Keygen;
  dsaKeygen: typeof mlDsa87Keygen;
}

const defaultIdentityV2Primitives: IdentityV2DerivationPrimitives = {
  deriveKey: deriveHkdfSha512,
  kemKeygen: mlKem1024Keygen,
  dsaKeygen: mlDsa87Keygen,
};

export function deriveFingerprintV2(input: {
  suite: 0x02;
  kemPublicKey: Uint8Array;
  signingPublicKey: Uint8Array;
}): Uint8Array {
  if (
    input.kemPublicKey.byteLength !== 1568 ||
    input.signingPublicKey.byteLength !== 2592
  ) {
    throw new PPXError("impossible-length");
  }
  const transcript = concatBytes(
    encoder.encode(V2_FINGERPRINT_DOMAIN),
    Uint8Array.of(input.suite),
    input.kemPublicKey,
    input.signingPublicKey,
  );
  let digest: Uint8Array | undefined;
  try {
    digest = sha512Digest(transcript);
    return digest.slice(0, 32);
  } finally {
    zeroize(transcript);
    if (digest) zeroize(digest);
  }
}

export async function deriveIdentityV2FromEntropy(
  masterEntropy: Uint8Array,
  pseudonym = "",
  creationTime = 0n,
  primitives: IdentityV2DerivationPrimitives = defaultIdentityV2Primitives,
): Promise<DerivedIdentityV2> {
  if (masterEntropy.byteLength !== 32) throw new PPXError("impossible-length");
  const normalizedPseudonym =
    pseudonym === "" ? "" : normalizePseudonym(pseudonym);
  let kemSeed: Uint8Array | undefined;
  let dsaSeed: Uint8Array | undefined;
  let kemSecretKey: Uint8Array | undefined;
  let signingSecretKey: Uint8Array | undefined;
  let transferred = false;
  try {
    kemSeed = derive(
      masterEntropy,
      V2_KEM_SEED_LABEL,
      64,
      primitives.deriveKey,
    );
    dsaSeed = derive(
      masterEntropy,
      V2_DSA_SEED_LABEL,
      32,
      primitives.deriveKey,
    );
    const kem = await Promise.resolve().then(() =>
      primitives.kemKeygen(kemSeed),
    );
    kemSecretKey = kem.secretKey;
    const dsa = await Promise.resolve().then(() =>
      primitives.dsaKeygen(dsaSeed),
    );
    signingSecretKey = dsa.secretKey;
    const fingerprint = deriveFingerprintV2({
      suite: PPX_PQ_5_SUITE,
      kemPublicKey: kem.publicKey,
      signingPublicKey: dsa.publicKey,
    });
    const identity: DerivedIdentityV2 = {
      suite: PPX_PQ_5_SUITE,
      creationTime,
      masterEntropy: Uint8Array.from(masterEntropy),
      kemPublicKey: kem.publicKey,
      kemSecretKey,
      signingPublicKey: dsa.publicKey,
      signingSecretKey,
      fingerprint,
      identityId: fingerprint.slice(0, 20),
      pseudonym: normalizedPseudonym,
    };
    transferred = true;
    return identity;
  } finally {
    if (kemSeed) zeroize(kemSeed);
    if (dsaSeed) zeroize(dsaSeed);
    if (!transferred) {
      if (kemSecretKey) zeroize(kemSecretKey);
      if (signingSecretKey) zeroize(signingSecretKey);
    }
  }
}

export function createSenderSigningCapabilityV2(
  identity: DerivedIdentityV2,
): SenderSigningCapabilityV2 {
  return {
    suite: PPX_PQ_5_SUITE,
    fingerprint: Uint8Array.from(identity.fingerprint),
    signingPublicKey: Uint8Array.from(identity.signingPublicKey),
    signingSecretKey: Uint8Array.from(identity.signingSecretKey),
  };
}

export function createDecapsulationCapabilityV2(
  identity: DerivedIdentityV2,
): DecapsulationCapabilityV2 {
  return {
    suite: PPX_PQ_5_SUITE,
    fingerprint: Uint8Array.from(identity.fingerprint),
    identityId: Uint8Array.from(identity.identityId),
    kemSecretKey: Uint8Array.from(identity.kemSecretKey),
  };
}
