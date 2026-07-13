import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { createPublicContact } from "../../protocol/ppxc";
import {
  encodeSignedTextInner,
  parseSignedTextInner,
} from "../../protocol/ppxt-inner";

describe("PPXT signed inner round trips", () => {
  it("preserves randomized Unicode plaintext and metadata", async () => {
    const sender = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(11),
      "Sender",
    );
    const contact = createPublicContact(sender, "Sender", 1n);
    fc.assert(
      fc.property(
        fc.string({ maxLength: 2048 }),
        fc.uint8Array({ minLength: 1, maxLength: 64 }),
        fc.bigInt({ min: 0n, max: 0xffff_ffff_ffff_ffffn }),
        (plaintext, messageId, time) => {
          const output = parseSignedTextInner(
            encodeSignedTextInner({
              senderContact: contact,
              signingSecretKey: sender.signingSecretKey,
              recipientId: new Uint8Array(20).fill(12),
              messageId,
              sentAt: time,
              createdAt: time,
              plaintext,
            }),
          );
          expect(output.plaintext).toBe(plaintext);
          expect(output.messageId).toEqual(messageId);
          expect(output.signatureValid).toBe(true);
        },
      ),
      { numRuns: 25 },
    );
  });
});
