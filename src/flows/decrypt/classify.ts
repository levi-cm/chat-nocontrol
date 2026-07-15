import { decodeBase45Upper } from "../../protocol/base45";
import { defaultCryptoProvider } from "../../crypto/default-provider";
import { PPXC_MAXIMUM_BASE45_CHARS } from "../../protocol/ppxc";
import {
  parseRecoveryObject,
  PPXR_MAXIMUM_BASE45_CHARS,
} from "../../protocol/ppxr";
import {
  parseLockedVault,
  PPXV_MAXIMUM_BASE45_CHARS,
} from "../../protocol/ppxv";
import { PPXError } from "../../protocol/types";
import { zeroize } from "../../crypto/zeroize";
import { extractQrMessageBytes } from "../../protocol/ppxq";

export type ClassifiedQrPayload =
  | {
      kind: "public-contact";
      prefix: "PPX1:CONTACT:";
      payload: Uint8Array;
    }
  | {
      kind: "private-vault";
      prefix: "PPX1:PRIVATE:";
      payload: Uint8Array;
    }
  | {
      kind: "recovery";
      prefix: "PPX1:RECOVERY:";
      payload: Uint8Array;
    }
  | {
      kind: "encrypted-message";
      prefix: "PPX1:MESSAGE:" | "https:";
      payload: Uint8Array;
    };

export function classifyQrPayload(raw: string): ClassifiedQrPayload {
  if (raw.startsWith("PPX1:MESSAGE:") || raw.startsWith("https://")) {
    const payload = extractQrMessageBytes(raw);
    return {
      kind: "encrypted-message",
      prefix: raw.startsWith("PPX1:MESSAGE:") ? "PPX1:MESSAGE:" : "https:",
      payload,
    };
  }
  if (raw.startsWith("PPX1:CONTACT:")) {
    if (raw.length > "PPX1:CONTACT:".length + PPXC_MAXIMUM_BASE45_CHARS) {
      throw new PPXError("oversize-before-allocation");
    }
    const payload = decodeBase45Upper(raw.slice("PPX1:CONTACT:".length));
    defaultCryptoProvider.parsePublicContact(payload);
    return { kind: "public-contact", prefix: "PPX1:CONTACT:", payload };
  }
  if (raw.startsWith("PPX1:PRIVATE:")) {
    if (raw.length > "PPX1:PRIVATE:".length + PPXV_MAXIMUM_BASE45_CHARS) {
      throw new PPXError("oversize-before-allocation");
    }
    const payload = decodeBase45Upper(raw.slice("PPX1:PRIVATE:".length));
    parseLockedVault(payload);
    return { kind: "private-vault", prefix: "PPX1:PRIVATE:", payload };
  }
  if (raw.startsWith("PPX1:RECOVERY:")) {
    if (raw.length > "PPX1:RECOVERY:".length + PPXR_MAXIMUM_BASE45_CHARS) {
      throw new PPXError("oversize-before-allocation");
    }
    const payload = decodeBase45Upper(raw.slice("PPX1:RECOVERY:".length));
    const recovery = parseRecoveryObject(payload);
    zeroize(recovery.masterEntropy);
    return { kind: "recovery", prefix: "PPX1:RECOVERY:", payload };
  }
  throw new PPXError("noncanonical-text");
}
