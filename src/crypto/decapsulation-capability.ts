import type {
  DecapsulationCapability,
  DerivedIdentity,
} from "../protocol/types";

export function createDecapsulationCapability(
  identity: DecapsulationCapability | DerivedIdentity,
): DecapsulationCapability {
  return {
    fingerprint: Uint8Array.from(identity.fingerprint),
    identityId: Uint8Array.from(identity.identityId),
    kemSecretKey: Uint8Array.from(identity.kemSecretKey),
    x25519SecretKey: Uint8Array.from(identity.x25519SecretKey),
  };
}
