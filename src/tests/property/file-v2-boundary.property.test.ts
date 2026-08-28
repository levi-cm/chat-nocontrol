import { describe, expect, it } from "vitest";
import {
  encodeFileHeaderV2,
  PPXF_V2_CHUNK_BYTES,
} from "../../protocol/ppxf-header-v2";
import type { FileHeaderV2 } from "../../protocol/types-v2";

function header(totalFileLength: bigint, count: number): FileHeaderV2 {
  return {
    magic: "PPXF",
    formatVersion: 2,
    suite: 2,
    flags: 0,
    recipientId: new Uint8Array(20),
    mlKemCiphertext: new Uint8Array(1568),
    noncePrefix: new Uint8Array(8),
    salt: new Uint8Array(32),
    declaredChunkCount: count,
    chunkSize: PPXF_V2_CHUNK_BYTES,
    totalFileLength,
  };
}

describe("PPXF Cat-5 boundaries", () => {
  it("accepts 0 and 100 MiB; rejects one byte above", () => {
    expect(encodeFileHeaderV2(header(0n, 0))).toHaveLength(1651);
    expect(encodeFileHeaderV2(header(104_857_600n, 100))).toHaveLength(1651);
    expect(() => encodeFileHeaderV2(header(104_857_601n, 101))).toThrow(
      "oversize-before-allocation",
    );
  });

  it("rejects inconsistent chunk counts", () => {
    expect(() => encodeFileHeaderV2(header(1n, 0))).toThrow(
      "impossible-length",
    );
    expect(() => encodeFileHeaderV2(header(0n, 1))).toThrow(
      "impossible-length",
    );
  });
});
