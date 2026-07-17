import { beforeAll, describe, expect, it } from "vitest";
import {
  deriveIdentityV2FromEntropy,
  createSenderSigningCapabilityV2,
} from "../../crypto/identity-v2";
import { encryptTextV2 } from "../../crypto/text-v2";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import {
  decodeTextArmorV2,
  encodeTextArmorV2,
} from "../../protocol/ppxt-armor-v2";
import {
  captureIncomingMessageIntentV2,
  encodeMessageLinkV2,
  parseMessageLinkHashV2,
} from "../../protocol/message-link-v2";
import type { EncryptedTextObjectV2 } from "../../protocol/types-v2";

const bytes = (length: number, value: number) =>
  new Uint8Array(length).fill(value);

describe("Cat-5 text V2 copy transports", () => {
  let full: EncryptedTextObjectV2;
  let compact: EncryptedTextObjectV2;

  beforeAll(async () => {
    const senderIdentity = await deriveIdentityV2FromEntropy(bytes(32, 0x81));
    const recipientIdentity = await deriveIdentityV2FromEntropy(
      bytes(32, 0x82),
    );
    const sender = createPublicContactV2(
      senderIdentity,
      "A",
      1n,
      bytes(32, 0x83),
    );
    const recipient = createPublicContactV2(
      recipientIdentity,
      "B",
      2n,
      bytes(32, 0x84),
    );
    const make = (compact: boolean) =>
      encryptTextV2({
        compact,
        sender,
        senderSigningCapability:
          createSenderSigningCapabilityV2(senderIdentity),
        recipient,
        plaintext: "",
        messageId: bytes(16, 0x85),
        sentAt: 3n,
        createdAt: 4n,
      });
    full = await make(false);
    compact = await make(true);
  });

  it("round-trips canonical full PPX-PQ-5 armor with digest and bytes", () => {
    const armor = encodeTextArmorV2(full);
    expect(armor).toContain("Version: 2");
    expect(armor).toContain("Suite: PPX-PQ-5");
    expect(armor).toContain("Bytes: 15163");
    expect(decodeTextArmorV2(armor)).toEqual(full);
    expect(() => encodeTextArmorV2(compact)).toThrow("noncanonical-text");
    expect(() => decodeTextArmorV2(`${armor}x`)).toThrow();
  });

  it("round-trips PPXT and PPXM only through bounded fragment links", () => {
    for (const value of [
      { kind: "ppxt" as const, object: full },
      { kind: "ppxm" as const, object: compact },
    ]) {
      const url = encodeMessageLinkV2(value, "https://example.test/app/");
      expect(url).toContain("#/m/");
      const hash = new URL(url).hash;
      expect(parseMessageLinkHashV2(hash)).toEqual(value);
      if (value.kind === "ppxm") {
        expect(hash.length).toBeGreaterThan(8_400);
        expect(hash.length).toBeLessThan(8_600);
      }
    }
    expect(() =>
      encodeMessageLinkV2(
        { kind: "ppxm", object: compact },
        "http://example.test/",
      ),
    ).toThrow("noncanonical-text");
  });

  it("scrubs fragment immediately and rejects unsafe location metadata", () => {
    const hash = new URL(
      encodeMessageLinkV2(
        { kind: "ppxm", object: compact },
        "https://example.test/app/",
      ),
    ).hash;
    const replacements: string[] = [];
    expect(
      captureIncomingMessageIntentV2(
        { pathname: "/app/", search: "", hash, username: "", password: "" },
        {
          replaceState: (_data, _unused, url) => replacements.push(String(url)),
        },
        123,
      ),
    ).toMatchObject({ kind: "ppxm", capturedAt: 123 });
    expect(replacements).toEqual(["/app/#/decrypt"]);
    expect(
      captureIncomingMessageIntentV2(
        {
          pathname: "/app/",
          search: "?leak=1",
          hash,
          username: "",
          password: "",
        },
        { replaceState: () => undefined },
        123,
      ),
    ).toEqual({ kind: "invalid" });
  });
});
