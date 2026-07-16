import { beforeAll, describe, expect, it } from "vitest";

import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { decryptQrText, encryptQrText } from "../../crypto/qr-text";
import { decryptText, encryptText } from "../../crypto/text";
import {
  encodeMessageLink,
  parseMessageLinkHash,
} from "../../protocol/message-link";
import { createPublicContact } from "../../protocol/ppxc";
import {
  encodeEncryptedQrText,
  parseEncryptedQrText,
} from "../../protocol/ppxq-outer";
import { PPXQ_MAXIMUM_ORIGINAL_UTF8_SIZE } from "../../protocol/ppxq-inner";
import { encodeEncryptedText, parseEncryptedText } from "../../protocol/ppxt";
import { PPXT_MAXIMUM_PLAINTEXT_SIZE } from "../../protocol/ppxt-inner";
import type { DerivedIdentity, PublicContact } from "../../protocol/types";

const encoder = new TextEncoder();
const APP_BASE = "https://example.test/app/";
const EMOJI_SEQUENCES = ["😀", "👍🏽", "🇩🇪", "e\u0301", "👨‍👩‍👧‍👦"] as const;

interface Fixture {
  alice: DerivedIdentity;
  bob: DerivedIdentity;
  sender: PublicContact;
  recipient: PublicContact;
}

let fixture: Fixture;

beforeAll(async () => {
  const alice = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(0xa1),
    "Alice",
  );
  const bob = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(0xb2),
    "Bob",
  );
  fixture = {
    alice,
    bob,
    sender: createPublicContact(alice, "Alice", 1n),
    recipient: createPublicContact(bob, "Bob", 2n),
  };
});

function encryptionMetadata(messageIdByte: number) {
  return {
    sender: fixture.sender,
    senderSigningCapability: createSenderSigningCapability(fixture.alice),
    recipient: fixture.recipient,
    messageId: new Uint8Array(16).fill(messageIdByte),
    sentAt: 3n,
    createdAt: 3n,
  };
}

describe("emoji encrypted-message regressions", () => {
  it("preserves emoji sequences through canonical PPXT bytes and message links", async () => {
    const plaintext = EMOJI_SEQUENCES.join(" | ");
    const encrypted = await encryptText({
      ...encryptionMetadata(0x11),
      plaintext,
    });
    const canonical = parseEncryptedText(encodeEncryptedText(encrypted));
    const link = encodeMessageLink(
      { kind: "ppxt", object: canonical },
      APP_BASE,
    );
    const parsed = parseMessageLinkHash(new URL(link).hash);

    expect(parsed.kind).toBe("ppxt");
    if (parsed.kind !== "ppxt") throw new Error("expected PPXT message link");
    expect(encodeEncryptedText(parsed.object)).toEqual(
      encodeEncryptedText(canonical),
    );
    await expect(
      decryptText({ object: parsed.object, activeIdentity: fixture.bob }),
    ).resolves.toMatchObject({ plaintext });
    for (const sequence of EMOJI_SEQUENCES) {
      expect(plaintext).toContain(sequence);
    }
  });

  it("preserves emoji sequences through canonical PPXQ bytes and message links", async () => {
    const plaintext = EMOJI_SEQUENCES.join(" | ");
    const encrypted = await encryptQrText({
      ...encryptionMetadata(0x22),
      plaintext,
    });
    const canonical = parseEncryptedQrText(encodeEncryptedQrText(encrypted));
    const link = encodeMessageLink(
      { kind: "ppxq", object: canonical },
      APP_BASE,
    );
    const parsed = parseMessageLinkHash(new URL(link).hash);

    expect(parsed.kind).toBe("ppxq");
    if (parsed.kind !== "ppxq") throw new Error("expected PPXQ message link");
    expect(encodeEncryptedQrText(parsed.object)).toEqual(
      encodeEncryptedQrText(canonical),
    );
    await expect(
      decryptQrText({
        object: parsed.object,
        activeIdentity: fixture.bob,
        knownSenders: [fixture.sender],
      }),
    ).resolves.toMatchObject({ plaintext });
    for (const sequence of EMOJI_SEQUENCES) {
      expect(plaintext).toContain(sequence);
    }
  });

  it("applies the 256 KiB PPXT limit to UTF-8 bytes, including four-byte emoji", async () => {
    const exact = "😀".repeat(PPXT_MAXIMUM_PLAINTEXT_SIZE / 4);
    const over = `${exact}😀`;
    expect(encoder.encode(exact)).toHaveLength(PPXT_MAXIMUM_PLAINTEXT_SIZE);
    expect(encoder.encode(over)).toHaveLength(PPXT_MAXIMUM_PLAINTEXT_SIZE + 4);

    const encrypted = await encryptText({
      ...encryptionMetadata(0x33),
      plaintext: exact,
    });
    const parsed = parseEncryptedText(encodeEncryptedText(encrypted));
    await expect(
      decryptText({ object: parsed, activeIdentity: fixture.bob }),
    ).resolves.toMatchObject({ plaintext: exact });

    await expect(
      encryptText({ ...encryptionMetadata(0x34), plaintext: over }),
    ).rejects.toThrow("impossible-length");
  });

  it("applies the 256 KiB PPXQ limit to UTF-8 bytes, including four-byte emoji", async () => {
    const exact = "😀".repeat(PPXQ_MAXIMUM_ORIGINAL_UTF8_SIZE / 4);
    const over = `${exact}😀`;
    expect(encoder.encode(exact)).toHaveLength(PPXQ_MAXIMUM_ORIGINAL_UTF8_SIZE);
    expect(encoder.encode(over)).toHaveLength(
      PPXQ_MAXIMUM_ORIGINAL_UTF8_SIZE + 4,
    );

    const encrypted = await encryptQrText({
      ...encryptionMetadata(0x44),
      plaintext: exact,
    });
    const parsed = parseEncryptedQrText(encodeEncryptedQrText(encrypted));
    await expect(
      decryptQrText({
        object: parsed,
        activeIdentity: fixture.bob,
        knownSenders: [fixture.sender],
      }),
    ).resolves.toMatchObject({ plaintext: exact });

    await expect(
      encryptQrText({ ...encryptionMetadata(0x45), plaintext: over }),
    ).rejects.toThrow("impossible-length");
  });
});
