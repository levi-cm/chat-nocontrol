import { describe, expect, it, vi } from "vitest";
import { routeFromHash } from "../../app/routes";
import { checksum16 } from "../../protocol/checksum";
import { captureIncomingEncryptedIntent } from "../../protocol/message-link";
import {
  captureIncomingMessageIntentV2,
  encodeMessageLinkV2,
  MESSAGE_LINK_V2_HASH_PREFIX,
  parseMessageLinkHashV2,
} from "../../protocol/message-link-v2";
import { encodeEncryptedTextHeaderV2 } from "../../protocol/text-v2-outer";
import type {
  EncryptedTextObjectV2,
  TextMagicV2,
} from "../../protocol/types-v2";

function object(magic: TextMagicV2): EncryptedTextObjectV2 {
  const ciphertext = new Uint8Array(magic === "PPXT" ? 13_524 : 4_731).fill(7);
  const base = {
    magic,
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

describe("Cat-5 encrypted message links", () => {
  it.each([
    ["ppxt", "PPXT"],
    ["ppxm", "PPXM"],
  ] as const)("round-trips %s", (kind, magic) => {
    const link = encodeMessageLinkV2(
      { kind, object: object(magic) },
      "https://app.example/",
    );
    expect(parseMessageLinkHashV2(new URL(link).hash)).toMatchObject({ kind });
  });

  it("scrubs the fragment before parsing valid or malformed ciphertext", () => {
    for (const hash of [
      new URL(
        encodeMessageLinkV2(
          { kind: "ppxt", object: object("PPXT") },
          "https://app.example/",
        ),
      ).hash,
      `${MESSAGE_LINK_V2_HASH_PREFIX}broken`,
    ]) {
      const replaceState = vi.fn();
      const intent = captureIncomingMessageIntentV2(
        { pathname: "/app/", search: "", hash, username: "", password: "" },
        { replaceState },
        42,
      );
      expect(replaceState).toHaveBeenCalledWith(null, "", "/app/#/decrypt");
      expect(intent).not.toBeNull();
      expect(JSON.stringify(intent)).not.toContain(hash);
      expect(routeFromHash(hash)).toBe("decrypt");
    }
  });

  it.each(["#/m", "#/decrypt/qr/ABC"])(
    "scrubs malformed reserved route %s",
    (hash) => {
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
          42,
        ),
      ).toEqual({ kind: "invalid" });
      expect(replaceState).toHaveBeenCalledWith(null, "", "/app/#/decrypt");
      expect(routeFromHash(hash)).toBe("decrypt");
    },
  );

  it("does not reserve unrelated obsolete routes", () => {
    const replaceState = vi.fn();
    expect(
      captureIncomingEncryptedIntent(
        {
          protocol: "https:",
          pathname: "/app/",
          search: "",
          hash: "#/message",
          username: "",
          password: "",
        },
        { replaceState },
        42,
      ),
    ).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
    expect(routeFromHash("#/message")).toBe("identity");
  });

  it("rejects query parameters and credentials after scrubbing", () => {
    const hash = new URL(
      encodeMessageLinkV2(
        { kind: "ppxm", object: object("PPXM") },
        "https://app.example/",
      ),
    ).hash;
    for (const location of [
      { pathname: "/", search: "?x=1", hash, username: "", password: "" },
      { pathname: "/", search: "", hash, username: "u", password: "p" },
    ]) {
      expect(
        captureIncomingMessageIntentV2(location, { replaceState: vi.fn() }, 1),
      ).toEqual({ kind: "invalid" });
    }
  });
});
