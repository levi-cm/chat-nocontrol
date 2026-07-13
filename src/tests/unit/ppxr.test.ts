import { describe, expect, it } from "vitest";
import { encodeRecoveryObject, parseRecoveryObject } from "../../protocol/ppxr";

describe("PPXR recovery object", () => {
  it("round-trips and rejects transfer corruption", () => {
    const encoded = encodeRecoveryObject({
      magic: "PPXR",
      formatVersion: 1,
      suite: 1,
      flags: 0,
      masterEntropy: new Uint8Array(32).fill(0x42),
      creationTime: 123n,
      pseudonym: "Alice",
      checksum: new Uint8Array(16),
    });
    const decoded = parseRecoveryObject(encoded);
    expect(encoded.slice(0, 8)).toEqual(
      Uint8Array.of(0x50, 0x50, 0x58, 0x52, 0x01, 0x01, 0x00, 0x05),
    );
    expect(encoded).toHaveLength(69);
    expect(decoded).toMatchObject({
      magic: "PPXR",
      formatVersion: 1,
      suite: 1,
      flags: 0,
    });
    expect(decoded.masterEntropy).toEqual(new Uint8Array(32).fill(0x42));
    expect(decoded.pseudonym).toBe("Alice");
    expect(decoded.creationTime).toBe(123n);
    expect(decoded.checksum).toHaveLength(16);

    encoded[encoded.length - 1] = (encoded[encoded.length - 1] as number) ^ 1;
    expect(() => parseRecoveryObject(encoded)).toThrow("checksum-mismatch");
  });
});
