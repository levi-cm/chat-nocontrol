import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";

describe("recovery word round-trip property", () => {
  it("round-trips every 32-byte entropy sample", () => {
    const codec = createRecoveryWordCodec();
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        (entropy) => {
          const words = codec.entropyToRecoveryWords(entropy);
          expect(words).toHaveLength(24);
          expect(codec.recoveryWordsToEntropy(words)).toEqual(entropy);
        },
      ),
      { numRuns: 100 },
    );
  });
});
