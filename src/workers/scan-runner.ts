import { zeroize } from "../crypto/zeroize";
import { classifyQrPayload } from "../flows/decrypt/classify";
import type { ClassifiedQrPayload } from "../flows/decrypt/classify";

export type ScannedQrKind = ClassifiedQrPayload["kind"];

export function classifyScannedText(raw: string): ScannedQrKind {
  const classified = classifyQrPayload(raw);
  try {
    return classified.kind;
  } finally {
    zeroize(classified.payload);
  }
}
