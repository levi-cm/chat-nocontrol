import type { DerivedIdentity } from "../protocol/types";

export function zeroize(...buffers: Uint8Array[]): void {
  for (const buffer of buffers) buffer.fill(0);
}

export function zeroizeIdentitySecrets(identity: DerivedIdentity): void {
  zeroize(
    identity.masterEntropy,
    identity.kemSecretKey,
    identity.x25519SecretKey,
    identity.signingSecretKey,
  );
}
