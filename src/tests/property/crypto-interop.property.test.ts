import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decryptAesGcm, encryptAesGcm } from "../../crypto/webcrypto";

describe("WebCrypto interoperability", () => {
  it("round-trips randomized AES-256-GCM inputs with AAD", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        fc.uint8Array({ minLength: 12, maxLength: 12 }),
        fc.uint8Array({ maxLength: 4096 }),
        fc.uint8Array({ maxLength: 256 }),
        async (key, nonce, plaintext, aad) => {
          const ciphertext = await encryptAesGcm(key, nonce, plaintext, aad);
          await expect(
            decryptAesGcm(key, nonce, ciphertext, aad),
          ).resolves.toEqual(plaintext);
        },
      ),
      { numRuns: 25 },
    );
  });
});
