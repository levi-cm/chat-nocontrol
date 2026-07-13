import { describe, expect, it } from "vitest";
import { decodeBase45Upper, encodeBase45Upper } from "../../protocol/base45";
import {
  decodeBase64UrlNoPad,
  encodeBase64UrlNoPad,
} from "../../protocol/base64url";
import { StrictByteReader, StrictByteWriter } from "../../protocol/bytes";
import {
  normalizeCaption,
  normalizeFilename,
  normalizeMimeHint,
  normalizePseudonym,
} from "../../protocol/text";

describe("strict byte codecs", () => {
  it("round-trips fixed-width integers and rejects trailing reads", () => {
    const writer = new StrictByteWriter(32);
    writer.writeUint8(1);
    writer.writeUint32BE(0x01020304);
    writer.writeUint64BE(0x0102030405060708n);
    const reader = new StrictByteReader(writer.toBytes(), 32);
    expect(reader.readUint8()).toBe(1);
    expect(reader.readUint32BE()).toBe(0x01020304);
    expect(reader.readUint64BE()).toBe(0x0102030405060708n);
    expect(reader.remaining()).toBe(0);
    expect(() => reader.readUint8()).toThrow("impossible-length");
  });

  it("rejects oversize input before reading", () => {
    expect(() => new StrictByteReader(new Uint8Array(3), 2)).toThrow(
      "oversize-before-allocation",
    );
  });
});

describe("canonical text codecs", () => {
  it("normalizes pseudonyms with NFKC and rejects controls", () => {
    expect(normalizePseudonym("  Ａlice  ")).toBe("Alice");
    expect(() => normalizePseudonym("Alice\u202E")).toThrow(
      "noncanonical-text",
    );
    expect(() => normalizePseudonym("")).toThrow("impossible-length");
  });

  it("bounds filename, MIME, and caption values", () => {
    expect(normalizeFilename("  report.pdf  ")).toBe("report.pdf");
    expect(normalizeMimeHint("text/plain")).toBe("text/plain");
    expect(() => normalizeMimeHint("téxt/plain")).toThrow("noncanonical-text");
    expect(normalizeCaption("")).toBe("");
  });
});

describe("transport encodings", () => {
  it("matches RFC 9285 Base45 examples", () => {
    const input = new TextEncoder().encode("AB");
    expect(encodeBase45Upper(input)).toBe("BB8");
    expect(Array.from(decodeBase45Upper("BB8"))).toEqual(Array.from(input));
    expect(() => decodeBase45Upper("bb8")).toThrow("noncanonical-text");
  });

  it("round-trips unpadded base64url and rejects padding", () => {
    const input = Uint8Array.of(0xfb, 0xff);
    expect(encodeBase64UrlNoPad(input)).toBe("-_8");
    expect(decodeBase64UrlNoPad("-_8")).toEqual(input);
    expect(() => decodeBase64UrlNoPad("-_8=")).toThrow("noncanonical-text");
  });
});
