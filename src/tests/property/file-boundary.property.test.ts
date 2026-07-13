import { describe, expect, it } from "vitest";
import { encodeFileHeader } from "../../protocol/ppxf-header";
import type { FileHeader } from "../../protocol/types";

function header(
  totalFileLength: bigint,
  declaredChunkCount: number,
): FileHeader {
  return {
    magic: "PPXF",
    formatVersion: 1,
    suite: 1,
    flags: 0,
    recipientId: new Uint8Array(20),
    mlKemCiphertext: new Uint8Array(768),
    ephemeralX25519PublicKey: new Uint8Array(32),
    noncePrefix: new Uint8Array(8),
    salt: new Uint8Array(32),
    declaredChunkCount,
    chunkSize: 1_048_576,
    totalFileLength,
  };
}

describe("PPXF file boundaries", () => {
  it("accepts 0 and 100 MiB and rejects one byte above", () => {
    expect(encodeFileHeader(header(0n, 0))).toHaveLength(884);
    expect(encodeFileHeader(header(104_857_600n, 100))).toHaveLength(884);
    expect(() => encodeFileHeader(header(104_857_601n, 101))).toThrow(
      "oversize-before-allocation",
    );
  });

  it("rejects a chunk count inconsistent with file length", () => {
    expect(() => encodeFileHeader(header(1n, 0))).toThrow("impossible-length");
    expect(() => encodeFileHeader(header(0n, 1))).toThrow("impossible-length");
  });
});
