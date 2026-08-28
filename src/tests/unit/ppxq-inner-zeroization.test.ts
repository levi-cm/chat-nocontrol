import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import * as nobleProvider from "../../crypto/noble-provider";
import {
  encodeSignedQrTextInner,
  parseSignedQrTextInner,
} from "../../protocol/ppxq-inner";
import { createPublicContact } from "../../protocol/ppxc";

afterEach(() => vi.restoreAllMocks());

async function fixture() {
  const identity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(111),
    "Alice",
  );
  return {
    capability: createSenderSigningCapability(identity),
    sender: createPublicContact(identity, "Alice", 1n),
    storedPayload: new TextEncoder().encode("sensitive PPXQ payload"),
  };
}

function expectZeroized(bytes: Uint8Array | undefined): void {
  expect(bytes).toBeDefined();
  expect(bytes?.every((byte) => byte === 0)).toBe(true);
}

describe("PPXQ inner plaintext buffer zeroization", () => {
  it("zeroizes the signing message after successful encoding", async () => {
    const { capability, sender, storedPayload } = await fixture();
    const original = nobleProvider.signEd25519;
    let signingMessage: Uint8Array | undefined;
    vi.spyOn(nobleProvider, "signEd25519").mockImplementation(
      (message, secretKey) => {
        signingMessage = message;
        return original(message, secretKey);
      },
    );

    encodeSignedQrTextInner({
      senderFingerprint: sender.fingerprint,
      signingSecretKey: capability.signingSecretKey,
      recipientId: new Uint8Array(20).fill(2),
      messageId: new Uint8Array(16).fill(3),
      sentAt: 4n,
      createdAt: 5n,
      originalUtf8Length: storedPayload.byteLength,
      storedPayload,
    });

    expectZeroized(signingMessage);
  });

  it("zeroizes the signing message when signing throws", async () => {
    const { capability, sender, storedPayload } = await fixture();
    let signingMessage: Uint8Array | undefined;
    vi.spyOn(nobleProvider, "signEd25519").mockImplementation((message) => {
      signingMessage = message;
      throw new Error("signing failed");
    });

    expect(() =>
      encodeSignedQrTextInner({
        senderFingerprint: sender.fingerprint,
        signingSecretKey: capability.signingSecretKey,
        recipientId: new Uint8Array(20).fill(2),
        messageId: new Uint8Array(16).fill(3),
        sentAt: 4n,
        createdAt: 5n,
        originalUtf8Length: storedPayload.byteLength,
        storedPayload,
      }),
    ).toThrow("signing failed");

    expectZeroized(signingMessage);
  });

  it("zeroizes the verification message after success and failure", async () => {
    const { capability, sender, storedPayload } = await fixture();
    const encoded = encodeSignedQrTextInner({
      senderFingerprint: sender.fingerprint,
      signingSecretKey: capability.signingSecretKey,
      recipientId: new Uint8Array(20).fill(2),
      messageId: new Uint8Array(16).fill(3),
      sentAt: 4n,
      createdAt: 5n,
      originalUtf8Length: storedPayload.byteLength,
      storedPayload,
    });
    const original = nobleProvider.verifyEd25519;
    const messages: Uint8Array[] = [];
    vi.spyOn(nobleProvider, "verifyEd25519")
      .mockImplementationOnce((signature, message, publicKey) => {
        messages.push(message);
        return original(signature, message, publicKey);
      })
      .mockImplementationOnce((_signature, message) => {
        messages.push(message);
        return false;
      });

    expect(
      Array.from(parseSignedQrTextInner(encoded, [sender]).storedPayload),
    ).toEqual(Array.from(storedPayload));
    expect(() => parseSignedQrTextInner(encoded, [sender])).toThrow(
      "invalid-signature",
    );
    expect(messages).toHaveLength(2);
    for (const message of messages) expectZeroized(message);
  });
});
