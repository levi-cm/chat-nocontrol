import { describe, expect, it, vi } from "vitest";

import { routeFromHash } from "../../app/routes";
import * as base37 from "../../protocol/base37";
import { encodeBase64UrlNoPad } from "../../protocol/base64url";
import {
  captureIncomingMessageIntent,
  encodeMessageLink,
  MESSAGE_LINK_HASH_PREFIX,
  MESSAGE_LINK_MAX_ENCODED_CHARS,
  parseMessageLinkHash,
} from "../../protocol/message-link";
import {
  parseEncryptedQrText,
  PPXQ_MAXIMUM_OBJECT_SIZE,
} from "../../protocol/ppxq-outer";
import { parseEncryptedText } from "../../protocol/ppxt";
import {
  canonicalProtocolBytes,
  canonicalQrTextBytes,
} from "../helpers/canonical-protocol";

describe("canonical encrypted message links", () => {
  it("round-trips exact canonical PPXT and PPXQ bytes", async () => {
    const ppxtBytes = (await canonicalProtocolBytes()).ppxt;
    const ppxqBytes = canonicalQrTextBytes();
    const cases = [
      {
        value: { kind: "ppxt", object: parseEncryptedText(ppxtBytes) } as const,
        bytes: ppxtBytes,
      },
      {
        value: {
          kind: "ppxq",
          object: parseEncryptedQrText(ppxqBytes),
        } as const,
        bytes: ppxqBytes,
      },
    ];

    expect(MESSAGE_LINK_HASH_PREFIX).toBe("#/m/");
    expect(MESSAGE_LINK_MAX_ENCODED_CHARS).toBe(400_000);
    for (const { value, bytes } of cases) {
      const link = encodeMessageLink(
        value,
        "https://example.test/app/#/old-fragment",
      );
      expect(link).toBe(
        `https://example.test/app/${MESSAGE_LINK_HASH_PREFIX}${encodeBase64UrlNoPad(bytes)}`,
      );
      const parsed = parseMessageLinkHash(new URL(link).hash);
      expect(parsed.kind).toBe(value.kind);
      expect(
        value.kind === "ppxt"
          ? parseEncryptedText(bytes)
          : parseEncryptedQrText(bytes),
      ).toEqual(parsed.object);
    }
  });

  it.each([
    "http://example.test/app/",
    "https://user@example.test/app/",
    "https://user:pass@example.test/app/",
    "https://example.test/app/?source=message",
  ])("rejects unsafe generation base %s", async (appBase) => {
    const object = parseEncryptedText((await canonicalProtocolBytes()).ppxt);
    expect(() =>
      encodeMessageLink({ kind: "ppxt", object }, appBase),
    ).toThrow();
  });

  it("rejects noncanonical objects through canonical encoders", async () => {
    const object = parseEncryptedText((await canonicalProtocolBytes()).ppxt);
    object.checksum = object.checksum.slice();
    object.checksum[0] = (object.checksum[0] as number) ^ 1;
    expect(() =>
      encodeMessageLink({ kind: "ppxt", object }, "https://example.test/"),
    ).toThrow("checksum-mismatch");
  });

  it("rejects malformed reserved shapes and non-base64url text", () => {
    for (const hash of [
      "#/other/AAAA",
      "#/m/",
      "#/m/AAAA=",
      "#/m/AAAA/",
      "#/m/AAAA?x=1",
      "#/m/AAAA#extra",
      "#/m/AAAA/trailing",
      "#/m/A",
    ]) {
      expect(() => parseMessageLinkHash(hash), hash).toThrow();
    }
  });

  it("enforces the maximum encoded length before base64 decoding", () => {
    const atob = vi.fn(() => "");
    vi.stubGlobal("atob", atob);
    try {
      expect(() =>
        parseMessageLinkHash(
          `${MESSAGE_LINK_HASH_PREFIX}${"A".repeat(MESSAGE_LINK_MAX_ENCODED_CHARS + 1)}`,
        ),
      ).toThrow();
      expect(atob).not.toHaveBeenCalled();

      expect(() =>
        parseMessageLinkHash(
          `${MESSAGE_LINK_HASH_PREFIX}${"A".repeat(MESSAGE_LINK_MAX_ENCODED_CHARS)}`,
        ),
      ).toThrow();
      expect(atob).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects truncation, unknown magic, and checksum mutation", async () => {
    const canonical = (await canonicalProtocolBytes()).ppxt;
    const corrupted = canonical.slice();
    corrupted[corrupted.byteLength - 1] =
      (corrupted[corrupted.byteLength - 1] as number) ^ 1;
    for (const bytes of [
      canonical.slice(0, -1),
      new TextEncoder().encode("NOPE"),
      corrupted,
    ]) {
      expect(() =>
        parseMessageLinkHash(
          `${MESSAGE_LINK_HASH_PREFIX}${encodeBase64UrlNoPad(bytes)}`,
        ),
      ).toThrow();
    }
  });
});

describe("incoming message-link capture", () => {
  it("captures a valid new link as a typed intent and scrubs immediately", async () => {
    const bytes = (await canonicalProtocolBytes()).ppxt;
    const hash = `${MESSAGE_LINK_HASH_PREFIX}${encodeBase64UrlNoPad(bytes)}`;
    const replaceState = vi.fn();

    const intent = captureIncomingMessageIntent(
      {
        pathname: "/app/",
        search: "",
        hash,
        username: "",
        password: "",
      },
      { replaceState },
      1_700_000_000_123,
    );

    expect(replaceState).toHaveBeenCalledWith(null, "", "/app/#/decrypt");
    expect(intent).toEqual({
      kind: "ppxt",
      object: parseEncryptedText(bytes),
      capturedAt: 1_700_000_000_123,
    });
  });

  it("parses the captured snapshot when replaceState mutates a live location", () => {
    const bytes = canonicalQrTextBytes();
    const location = {
      pathname: "/app/",
      search: "",
      hash: `${MESSAGE_LINK_HASH_PREFIX}${encodeBase64UrlNoPad(bytes)}`,
      username: "",
      password: "",
    };
    const replaceState = vi.fn(() => {
      location.search = "";
      location.hash = "#/decrypt";
    });

    expect(
      captureIncomingMessageIntent(location, { replaceState }, 91),
    ).toEqual({
      kind: "ppxq",
      object: parseEncryptedQrText(bytes),
      capturedAt: 91,
    });
  });

  it.each(["#/m/", "#/m/not+padded=", "#/decrypt/qr/lowercase"])(
    "scrubs malformed reserved hash %s and returns no raw input",
    (hash) => {
      const replaceState = vi.fn();
      const intent = captureIncomingMessageIntent(
        {
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
      expect(intent).toEqual({ kind: "invalid" });
      expect(JSON.stringify(intent)).not.toContain(hash);
    },
  );

  it("scrubs a network-path pathname to a same-origin absolute path", () => {
    const replaceState = vi.fn();

    expect(() =>
      captureIncomingMessageIntent(
        {
          pathname: "//evil.example/",
          search: "",
          hash: "#/m/",
          username: "",
          password: "",
        },
        { replaceState },
        42,
      ),
    ).not.toThrow();
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/evil.example/#/decrypt",
    );
  });

  it("drops query data and invalidates an otherwise valid reserved link", () => {
    const bytes = canonicalQrTextBytes();
    const replaceState = vi.fn();
    const intent = captureIncomingMessageIntent(
      {
        pathname: "/app/",
        search: "?source=private",
        hash: `${MESSAGE_LINK_HASH_PREFIX}${encodeBase64UrlNoPad(bytes)}`,
        username: "",
        password: "",
      },
      { replaceState },
      42,
    );

    expect(replaceState).toHaveBeenCalledWith(null, "", "/app/#/decrypt");
    expect(intent).toEqual({ kind: "invalid" });
  });

  it.each([
    { username: "alice", password: "" },
    { username: "", password: "secret" },
  ])(
    "scrubs and rejects reserved links with credentials $username:$password",
    ({ username, password }) => {
      const bytes = canonicalQrTextBytes();
      const replaceState = vi.fn();
      const intent = captureIncomingMessageIntent(
        {
          pathname: "/app/",
          search: "",
          hash: `${MESSAGE_LINK_HASH_PREFIX}${encodeBase64UrlNoPad(bytes)}`,
          username,
          password,
        },
        { replaceState },
        42,
      );

      expect(replaceState).toHaveBeenCalledWith(null, "", "/app/#/decrypt");
      expect(intent).toEqual({ kind: "invalid" });
    },
  );

  it("leaves nonreserved locations untouched", () => {
    const replaceState = vi.fn();
    expect(
      captureIncomingMessageIntent(
        {
          pathname: "/app/",
          search: "?safe=1",
          hash: "#/encrypt",
          username: "",
          password: "",
        },
        { replaceState },
        42,
      ),
    ).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("captures and scrubs a canonical legacy PPXQ link", () => {
    const bytes = canonicalQrTextBytes();
    const replaceState = vi.fn();
    const intent = captureIncomingMessageIntent(
      {
        pathname: "/app/",
        search: "",
        hash: `#/decrypt/qr/${base37.encodeBase37Upper(bytes)}`,
        username: "",
        password: "",
      },
      { replaceState },
      73,
    );

    expect(replaceState).toHaveBeenCalledWith(null, "", "/app/#/decrypt");
    expect(intent).toEqual({
      kind: "ppxq",
      object: parseEncryptedQrText(bytes),
      capturedAt: 73,
    });
  });

  it("rejects oversized legacy payloads before entering base37 decode", () => {
    const maximumEncodedCharacters = Math.ceil(
      PPXQ_MAXIMUM_OBJECT_SIZE * (8 / Math.log2(37)),
    );
    const decode = vi.spyOn(base37, "decodeBase37Upper");
    const replaceState = vi.fn();
    try {
      const bytes = canonicalQrTextBytes();
      captureIncomingMessageIntent(
        {
          pathname: "/app/",
          search: "",
          hash: `#/decrypt/qr/${base37.encodeBase37Upper(bytes)}`,
          username: "",
          password: "",
        },
        { replaceState },
        1,
      );
      expect(decode).toHaveBeenCalledOnce();
      decode.mockClear();

      expect(
        captureIncomingMessageIntent(
          {
            pathname: "/app/",
            search: "",
            hash: `#/decrypt/qr/${"A".repeat(maximumEncodedCharacters + 1)}`,
            username: "",
            password: "",
          },
          { replaceState },
          2,
        ),
      ).toEqual({ kind: "invalid" });
      expect(replaceState).toHaveBeenLastCalledWith(null, "", "/app/#/decrypt");
      expect(decode).not.toHaveBeenCalled();
    } finally {
      decode.mockRestore();
    }
  });

  it("maps the new reserved fragment to decrypt", () => {
    expect(routeFromHash("#/m/ciphertext")).toBe("decrypt");
  });
});
