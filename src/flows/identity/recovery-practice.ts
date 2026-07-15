import type { CryptoProvider } from "../../crypto/provider";
import { zeroize, zeroizeIdentitySecrets } from "../../crypto/zeroize";
import { decodeBase45Upper } from "../../protocol/base45";
import { equalBytes } from "../../protocol/checksum";
import { parseRecoveryObject } from "../../protocol/ppxr";

export async function verifyRecoveryBytesForIdentity(
  input: Uint8Array,
  expectedIdentityId: Uint8Array,
  provider: Pick<CryptoProvider, "deriveIdentity">,
): Promise<boolean> {
  const bytes = Uint8Array.from(input);
  let recovery: ReturnType<typeof parseRecoveryObject> | null = null;
  try {
    recovery = parseRecoveryObject(bytes);
    const recoveredIdentity = await provider.deriveIdentity(
      recovery.masterEntropy,
    );
    try {
      return equalBytes(recoveredIdentity.identityId, expectedIdentityId);
    } finally {
      zeroizeIdentitySecrets(recoveredIdentity);
    }
  } finally {
    if (recovery) zeroize(recovery.masterEntropy);
    zeroize(bytes);
  }
}

export async function verifyRecoveryCodeForIdentity(
  value: string,
  expectedIdentityId: Uint8Array,
  provider: Pick<CryptoProvider, "deriveIdentity">,
): Promise<boolean> {
  const prefix = "PPX1:RECOVERY:";
  if (!value.startsWith(prefix)) return false;
  const bytes = decodeBase45Upper(value.slice(prefix.length));
  try {
    return await verifyRecoveryBytesForIdentity(
      bytes,
      expectedIdentityId,
      provider,
    );
  } finally {
    zeroize(bytes);
  }
}
