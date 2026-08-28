import { describe, expect, it, vi } from "vitest";
import { encodeBase37Upper } from "../../protocol/base37";
import { encodeBase64UrlNoPad } from "../../protocol/base64url";
import { checksum16 } from "../../protocol/checksum";
import {
  captureIncomingEncryptedIntent,
  isReservedIncomingEncryptedHash,
} from "../../protocol/message-link";
import {
  encodeEncryptedQrText,
  encodeEncryptedQrTextHeader,
} from "../../protocol/ppxq-outer";
import {
  encodeEncryptedTextHeader,
  encodeEncryptedTextOuter,
} from "../../protocol/ppxt-outer";

function compactBytes(): Uint8Array {
  const base = {
    magic: "PPXQ" as const,
    formatVersion: 1 as const,
    suite: 1 as const,
    flags: 0 as const,
    mlKemCiphertext: new Uint8Array(768).fill(1),
    ephemeralX25519PublicKey: new Uint8Array(32).fill(2),
    salt: new Uint8Array(32).fill(3),
    nonce: new Uint8Array(12).fill(4),
    ciphertextLength: 16,
    ciphertext: new Uint8Array(16).fill(5),
  };
  const header = encodeEncryptedQrTextHeader(base);
  const payload = new Uint8Array(header.byteLength + base.ciphertextLength);
  payload.set(header);
  payload.set(base.ciphertext, header.byteLength);
  return encodeEncryptedQrText({ ...base, checksum: checksum16(payload) });
}

function compressedLegacyTextBytes(): Uint8Array {
  const base = {
    magic: "PPXT" as const,
    formatVersion: 2 as const,
    suite: 1 as const,
    flags: 1 as const,
    mlKemCiphertext: new Uint8Array(768).fill(6),
    ephemeralX25519PublicKey: new Uint8Array(32).fill(7),
    salt: new Uint8Array(32).fill(8),
    nonce: new Uint8Array(12).fill(9),
    ciphertextLength: 16,
    ciphertext: new Uint8Array(16).fill(10),
  };
  const header = encodeEncryptedTextHeader(base);
  const payload = new Uint8Array(header.byteLength + base.ciphertextLength);
  payload.set(header);
  payload.set(base.ciphertext, header.byteLength);
  return encodeEncryptedTextOuter({ ...base, checksum: checksum16(payload) });
}

describe("unified incoming encrypted fragment capture", () => {
  it("scrubs a canonical old QR fragment before returning its memory-only intent", () => {
    const hash = `#/decrypt/qr/${encodeBase37Upper(compactBytes())}`;
    const replaceState = vi.fn();
    const intent = captureIncomingEncryptedIntent(
      {
        protocol: "https:",
        pathname: "/app/",
        search: "",
        hash,
        username: "",
        password: "",
      },
      { replaceState },
      42,
    );

    expect(replaceState).toHaveBeenCalledWith(null, "", "/app/#/decrypt");
    expect(intent).toMatchObject({ kind: "legacy-v1-compact", capturedAt: 42 });
    expect(JSON.stringify(intent)).not.toContain(hash);
  });

  it("captures a compressed format-2 Suite-1 PPXT #/m link as legacy full", () => {
    const hash = `#/m/${encodeBase64UrlNoPad(compressedLegacyTextBytes())}`;
    const replaceState = vi.fn();
    expect(
      captureIncomingEncryptedIntent(
        {
          protocol: "https:",
          pathname: "/app/",
          search: "",
          hash,
          username: "",
          password: "",
        },
        { replaceState },
        43,
      ),
    ).toMatchObject({
      kind: "legacy-v1-full",
      capturedAt: 43,
      object: { formatVersion: 2, suite: 1 },
    });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/app/#/decrypt");
  });

  it.each(["#/m", "#/m/", "#/m/not_base64!", "#/decrypt/qr", "#/decrypt/qr/"])(
    "scrubs malformed reserved fragment %s before rejecting it",
    (hash) => {
      const replaceState = vi.fn();
      expect(
        captureIncomingEncryptedIntent(
          {
            protocol: "https:",
            pathname: "/",
            search: "",
            hash,
            username: "",
            password: "",
          },
          { replaceState },
          1,
        ),
      ).toEqual({ kind: "invalid" });
      expect(replaceState).toHaveBeenCalledWith(null, "", "/#/decrypt");
      expect(isReservedIncomingEncryptedHash(hash)).toBe(true);
    },
  );

  it("rejects non-HTTPS, query, and credentials after immediate scrubbing", () => {
    const hash = `#/decrypt/qr/${encodeBase37Upper(compactBytes())}`;
    for (const unsafe of [
      { protocol: "http:", search: "", username: "", password: "" },
      {
        protocol: "http:",
        hostname: "localhost",
        search: "",
        username: "",
        password: "",
      },
      {
        protocol: "http:",
        hostname: "127.0.0.1",
        search: "",
        username: "",
        password: "",
      },
      {
        protocol: "http:",
        hostname: "[::1]",
        search: "",
        username: "",
        password: "",
      },
      { protocol: "https:", search: "?x=1", username: "", password: "" },
      { protocol: "https:", search: "", username: "u", password: "p" },
    ]) {
      const replaceState = vi.fn();
      expect(
        captureIncomingEncryptedIntent(
          { pathname: "/", hash, ...unsafe },
          { replaceState },
          1,
        ),
      ).toEqual({ kind: "invalid" });
      expect(replaceState).toHaveBeenCalledOnce();
    }
  });
});
