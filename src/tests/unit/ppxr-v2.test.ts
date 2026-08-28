import { describe, expect, it } from "vitest";
import {
  encodeRecoveryObjectV2Text,
  encodeRecoveryObjectV2,
  parseRecoveryObjectV2,
  parseRecoveryObjectV2Text,
} from "../../protocol/ppxr-v2";

describe("Cat-5 PPXR recovery object", () => {
  it("round-trips private recovery bytes with suite 2", () => {
    const encoded = encodeRecoveryObjectV2({
      magic: "PPXR",
      formatVersion: 2,
      suite: 2,
      flags: 0,
      masterEntropy: new Uint8Array(32).fill(0x42),
      creationTime: 123n,
      pseudonym: "Alice",
      checksum: new Uint8Array(16),
    });
    const decoded = parseRecoveryObjectV2(encoded);

    expect(encoded.slice(0, 8)).toEqual(
      Uint8Array.of(0x50, 0x50, 0x58, 0x52, 0x02, 0x02, 0x00, 0x05),
    );
    expect(encoded).toHaveLength(69);
    expect(decoded.masterEntropy).toEqual(new Uint8Array(32).fill(0x42));
    expect(decoded.pseudonym).toBe("Alice");
    expect(decoded.creationTime).toBe(123n);
  });

  it("rejects V1 and corruption", () => {
    const encoded = encodeRecoveryObjectV2({
      magic: "PPXR",
      formatVersion: 2,
      suite: 2,
      flags: 0,
      masterEntropy: new Uint8Array(32).fill(0x24),
      creationTime: 456n,
      pseudonym: "Alice",
      checksum: new Uint8Array(16),
    });
    const v1 = encoded.slice();
    v1[4] = 1;
    v1[5] = 1;
    expect(() => parseRecoveryObjectV2(v1)).toThrow("unknown-format-version");

    encoded[encoded.length - 1] = (encoded[encoded.length - 1] as number) ^ 1;
    expect(() => parseRecoveryObjectV2(encoded)).toThrow("checksum-mismatch");
  });

  it("round-trips only the private PPX2 recovery text prefix", () => {
    const recovery = {
      magic: "PPXR" as const,
      formatVersion: 2 as const,
      suite: 2 as const,
      flags: 0 as const,
      masterEntropy: new Uint8Array(32).fill(0x55),
      creationTime: 789n,
      pseudonym: "Alice",
      checksum: new Uint8Array(16),
    };
    const text = encodeRecoveryObjectV2Text(recovery);

    expect(text.startsWith("PPX2:RECOVERY:")).toBe(true);
    expect(parseRecoveryObjectV2Text(text).masterEntropy).toEqual(
      recovery.masterEntropy,
    );
    expect(() =>
      parseRecoveryObjectV2Text(text.replace("PPX2:", "PPX1:")),
    ).toThrow("noncanonical-text");
  });
});
