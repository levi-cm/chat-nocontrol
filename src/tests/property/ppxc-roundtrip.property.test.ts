import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import {
  createPublicContact,
  encodePublicContact,
  parsePublicContact,
} from "../../protocol/ppxc";

describe("PPXC canonical round trips", () => {
  it("preserves randomized valid contacts byte-for-byte", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 _-]{0,31}$/u),
        fc.bigInt({ min: 0n, max: 0xffff_ffff_ffff_ffffn }),
        async (entropy, pseudonym, creationTime) => {
          const identity = await deriveIdentityFromEntropy(entropy, pseudonym);
          const encoded = encodePublicContact(
            createPublicContact(identity, pseudonym, creationTime),
          );
          expect(encodePublicContact(parsePublicContact(encoded))).toEqual(
            encoded,
          );
        },
      ),
      { numRuns: 25 },
    );
  });
});
