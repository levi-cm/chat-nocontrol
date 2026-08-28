import type { DerivedIdentity } from "../protocol/types";
import type { DerivedIdentityV2 } from "../protocol/types-v2";

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

export function zeroizeIdentitySecretsV2(identity: DerivedIdentityV2): void {
  zeroize(
    identity.masterEntropy,
    identity.kemSecretKey,
    identity.signingSecretKey,
  );
}
