import { describe, expect, it } from "vitest";
import {
  gzipBytes,
  gunzipBytesBounded,
  supportsGzipStreams,
} from "../../crypto/text-compression";

const encoder = new TextEncoder();

describe("bounded text compression", () => {
  it("constructs both gzip stream directions before reporting support", () => {
    expect(supportsGzipStreams()).toBe(true);
  });

  it.each([
    ["empty", new Uint8Array()],
    [
      "Unicode Markdown",
      encoder.encode("# Überschrift\n\n🔐 sicher ".repeat(128)),
    ],
    ["1023 bytes", new Uint8Array(1_023).fill(0x61)],
    ["1024 bytes", new Uint8Array(1_024).fill(0x61)],
    ["1025 bytes", new Uint8Array(1_025).fill(0x61)],
  ])("round-trips %s", async (_name, input) => {
    const compressed = await gzipBytes(input);
    const output = await gunzipBytesBounded(
      compressed,
      Math.max(1, input.byteLength),
    );
    expect([...output]).toEqual([...input]);
  });

  it("rejects corrupt, truncated, and trailing gzip data", async () => {
    const compressed = await gzipBytes(
      encoder.encode("compress me".repeat(64)),
    );
    const corrupt = compressed.slice();
    const corruptIndex = Math.floor(corrupt.byteLength / 2);
    corrupt[corruptIndex] = (corrupt[corruptIndex] as number) ^ 0x80;
    await expect(gunzipBytesBounded(corrupt, 10_000)).rejects.toThrow();
    await expect(
      gunzipBytesBounded(compressed.slice(0, -1), 10_000),
    ).rejects.toThrow();
    const trailing = new Uint8Array(compressed.byteLength + 1);
    trailing.set(compressed);
    trailing[trailing.byteLength - 1] = 1;
    await expect(gunzipBytesBounded(trailing, 10_000)).rejects.toThrow();
  });

  it("stops before retaining decompressed output above the bound", async () => {
    const bomb = await gzipBytes(new Uint8Array(264_001).fill(0x41));
    await expect(gunzipBytesBounded(bomb, 264_000)).rejects.toThrow(
      "oversize-before-allocation",
    );
  });
});
