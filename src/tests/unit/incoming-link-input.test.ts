import { describe, expect, it } from "vitest";
import { parseIncomingMessageText } from "../../app/incoming-link-input";
import { checksum16 } from "../../protocol/checksum";
import { encodeMessageLinkV2 } from "../../protocol/message-link-v2";
import { encodeEncryptedTextHeaderV2 } from "../../protocol/text-v2-outer";
import type { EncryptedTextObjectV2 } from "../../protocol/types-v2";

function object(): EncryptedTextObjectV2 {
  const ciphertext = new Uint8Array(13_524).fill(7);
  const base = {
    magic: "PPXT" as const,
    formatVersion: 2 as const,
    suite: 2 as const,
    flags: 0 as const,
    mlKemCiphertext: new Uint8Array(1568),
    salt: new Uint8Array(32),
    nonce: new Uint8Array(12),
    ciphertextLength: ciphertext.byteLength,
  };
  const header = encodeEncryptedTextHeaderV2(base);
  const payload = new Uint8Array(header.byteLength + ciphertext.byteLength);
  payload.set(header);
  payload.set(ciphertext, header.byteLength);
  return { ...base, ciphertext, checksum: checksum16(payload) };
}

function link(): string {
  return encodeMessageLinkV2(
    { kind: "ppxt", object: object() },
    "https://app.example/",
  );
}

describe("pasted encrypted links", () => {
  it("extracts a V2 object without requiring the canonical host", () => {
    const foreign = link().replace(
      "https://app.example/",
      "https://mirror.example/",
    );
    expect(parseIncomingMessageText(foreign)?.kind).toBe("ppxt");
  });

  it("rejects credentials and query parameters", () => {
    const hash = new URL(link()).hash;
    expect(() =>
      parseIncomingMessageText(`https://user:pass@app.example/${hash}`),
    ).toThrow();
    expect(() =>
      parseIncomingMessageText(`https://app.example/?tracking=1${hash}`),
    ).toThrow();
  });

  it("returns null for ordinary armored input", () => {
    expect(
      parseIncomingMessageText("-----BEGIN PPX ENCRYPTED TEXT-----"),
    ).toBeNull();
  });
});
