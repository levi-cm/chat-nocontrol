import { describe, expect, it } from "vitest";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { encryptText } from "../../crypto/text";
import { createPublicContact } from "../../protocol/ppxc";
import { encodeMessageLink } from "../../protocol/message-link";
import { parseIncomingMessageText } from "../../app/incoming-link-input";

async function link(): Promise<string> {
  const sender = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(1),
    "A",
  );
  const recipient = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(2),
    "B",
  );
  const object = await encryptText({
    sender: createPublicContact(sender, "A", 1n),
    senderSigningCapability: createSenderSigningCapability(sender),
    recipient: createPublicContact(recipient, "B", 2n),
    plaintext: "hello",
    messageId: new Uint8Array(16).fill(3),
    sentAt: 4n,
    createdAt: 4n,
  });
  return encodeMessageLink({ kind: "ppxt", object }, "https://app.example/");
}

describe("pasted encrypted links", () => {
  it("extracts a typed object without requiring the canonical host", async () => {
    const original = await link();
    const foreign = original.replace(
      "https://app.example/",
      "https://mirror.example/",
    );
    expect(parseIncomingMessageText(foreign)?.kind).toBe("ppxt");
  });

  it("rejects credentials and query parameters", async () => {
    const value = await link();
    const hash = new URL(value).hash;
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
