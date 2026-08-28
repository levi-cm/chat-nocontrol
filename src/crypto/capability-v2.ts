import { PPXError } from "../protocol/types";
import {
  PPX_PQ_5_SUITE,
  type DecapsulationCapabilityV2,
  type SenderSigningCapabilityV2,
} from "../protocol/types-v2";
import { zeroize } from "./zeroize";

function requireSuite(suite: number): void {
  if (suite !== PPX_PQ_5_SUITE) throw new PPXError("unknown-suite");
}

export function validateDecapsulationCapabilityV2(
  capability: DecapsulationCapabilityV2,
): void {
  requireSuite(capability.suite);
  if (
    capability.fingerprint.byteLength !== 32 ||
    capability.identityId.byteLength !== 20 ||
    capability.kemSecretKey.byteLength !== 3168
  ) {
    throw new PPXError("wrong-identity-or-corruption");
  }
}

export function validateSenderSigningCapabilityV2(
  capability: SenderSigningCapabilityV2,
): void {
  requireSuite(capability.suite);
  if (
    capability.fingerprint.byteLength !== 32 ||
    capability.signingPublicKey.byteLength !== 2592 ||
    capability.signingSecretKey.byteLength !== 4896
  ) {
    throw new PPXError("wrong-identity-or-corruption");
  }
}

export function cloneDecapsulationCapabilityV2(
  capability: DecapsulationCapabilityV2,
): DecapsulationCapabilityV2 {
  validateDecapsulationCapabilityV2(capability);
  return {
    suite: PPX_PQ_5_SUITE,
    fingerprint: Uint8Array.from(capability.fingerprint),
    identityId: Uint8Array.from(capability.identityId),
    kemSecretKey: Uint8Array.from(capability.kemSecretKey),
  };
}

export function cloneSenderSigningCapabilityV2(
  capability: SenderSigningCapabilityV2,
): SenderSigningCapabilityV2 {
  validateSenderSigningCapabilityV2(capability);
  return {
    suite: PPX_PQ_5_SUITE,
    fingerprint: Uint8Array.from(capability.fingerprint),
    signingPublicKey: Uint8Array.from(capability.signingPublicKey),
    signingSecretKey: Uint8Array.from(capability.signingSecretKey),
  };
}

export function zeroizeDecapsulationCapabilityV2(
  capability: DecapsulationCapabilityV2,
): void {
  zeroize(capability.kemSecretKey);
}

export function zeroizeSenderSigningCapabilityV2(
  capability: SenderSigningCapabilityV2,
): void {
  zeroize(capability.signingSecretKey);
}
