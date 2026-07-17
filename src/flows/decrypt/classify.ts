import { zeroize } from "../../crypto/zeroize";
import { decodeBase45Upper } from "../../protocol/base45";
import {
  parseRecoveryObjectV2,
  PPXR_V2_MAXIMUM_BASE45_CHARS,
  PPXR_V2_TEXT_PREFIX,
} from "../../protocol/ppxr-v2";
import {
  parseLockedVaultV2,
  PPXV_V2_MAXIMUM_BASE45_CHARS,
} from "../../protocol/ppxv-v2";
import { PPXError } from "../../protocol/types";

export type ClassifiedQrPayload =
  | {
      kind: "private-vault";
      prefix: "PPX2:PRIVATE:";
      payload: Uint8Array;
    }
  | {
      kind: "recovery";
      prefix: typeof PPXR_V2_TEXT_PREFIX;
      payload: Uint8Array;
    };

export function classifyQrPayload(raw: string): ClassifiedQrPayload {
  if (raw.startsWith(PPXR_V2_TEXT_PREFIX)) {
    if (raw.length > PPXR_V2_TEXT_PREFIX.length + PPXR_V2_MAXIMUM_BASE45_CHARS)
      throw new PPXError("oversize-before-allocation");
    const payload = decodeBase45Upper(raw.slice(PPXR_V2_TEXT_PREFIX.length));
    const recovery = parseRecoveryObjectV2(payload);
    zeroize(recovery.masterEntropy);
    return { kind: "recovery", prefix: PPXR_V2_TEXT_PREFIX, payload };
  }
  const vaultPrefix = "PPX2:PRIVATE:" as const;
  if (raw.startsWith(vaultPrefix)) {
    if (raw.length > vaultPrefix.length + PPXV_V2_MAXIMUM_BASE45_CHARS)
      throw new PPXError("oversize-before-allocation");
    const payload = decodeBase45Upper(raw.slice(vaultPrefix.length));
    parseLockedVaultV2(payload);
    return { kind: "private-vault", prefix: vaultPrefix, payload };
  }
  throw new PPXError("noncanonical-text");
}
