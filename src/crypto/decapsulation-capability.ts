import type {
  DecapsulationCapability,
  DerivedIdentity,
} from "../protocol/types";
import { PPXError } from "../protocol/types";
import { zeroize } from "./zeroize";

export function validateDecapsulationCapability(
  capability: DecapsulationCapability,
): void {
  if (capability.suite !== 1) throw new PPXError("unknown-suite");
}

export function zeroizeDecapsulationCapability(
  capability: DecapsulationCapability,
): void {
  zeroize(capability.kemSecretKey, capability.x25519SecretKey);
}

export function createDecapsulationCapability(
  identity: DecapsulationCapability | DerivedIdentity,
): DecapsulationCapability {
  if (identity.suite !== 1) throw new PPXError("unknown-suite");
  const capability: DecapsulationCapability = {
    suite: 1,
    fingerprint: Uint8Array.from(identity.fingerprint),
    identityId: Uint8Array.from(identity.identityId),
    kemSecretKey: Uint8Array.from(identity.kemSecretKey),
    x25519SecretKey: Uint8Array.from(identity.x25519SecretKey),
  };
  validateDecapsulationCapability(capability);
  return capability;
}
