import { describe, expect, it } from "vitest";
import { encodeBase45Upper } from "../../protocol/base45";
import { encodeRecoveryObjectV2 } from "../../protocol/ppxr-v2";
import { classifyScannedText } from "../../workers/scan-runner";

describe("scan worker runner", () => {
  it("strictly classifies private V2 recovery and rejects damaged input", () => {
    const bytes = encodeRecoveryObjectV2({
      magic: "PPXR",
      formatVersion: 2,
      suite: 2,
      flags: 0,
      masterEntropy: new Uint8Array(32),
      creationTime: 1n,
      pseudonym: "Worker Alice",
      checksum: new Uint8Array(16),
    });
    const qr = `PPX2:RECOVERY:${encodeBase45Upper(bytes)}`;
    expect(classifyScannedText(qr)).toBe("recovery");
    expect(() => classifyScannedText(`${qr.slice(0, -1)}!`)).toThrow();
  });
});
