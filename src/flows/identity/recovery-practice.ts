import type { CryptoProvider } from "../../crypto/provider";
import { zeroize, zeroizeIdentitySecretsV2 } from "../../crypto/zeroize";
import { decodeBase45Upper } from "../../protocol/base45";
import { equalBytes } from "../../protocol/checksum";
import {
  parseRecoveryObjectV2,
  PPXR_V2_TEXT_PREFIX,
} from "../../protocol/ppxr-v2";

export async function verifyRecoveryBytesForIdentity(
  input: Uint8Array,
  expectedIdentityId: Uint8Array,
  provider: Pick<CryptoProvider, "deriveIdentity">,
): Promise<boolean> {
  const bytes = Uint8Array.from(input);
  let recovery: ReturnType<typeof parseRecoveryObjectV2> | null = null;
  try {
    recovery = parseRecoveryObjectV2(bytes);
    const recoveredIdentity = await provider.deriveIdentity(
      recovery.masterEntropy,
    );
    try {
      return equalBytes(recoveredIdentity.identityId, expectedIdentityId);
    } finally {
      zeroizeIdentitySecretsV2(recoveredIdentity);
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
  const prefix = PPXR_V2_TEXT_PREFIX;
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
