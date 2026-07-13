import { describe, expect, it } from "vitest";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";

describe("PPX recovery words", () => {
  const codec = createRecoveryWordCodec();

  it("encodes exactly 32 entropy bytes as 24 English BIP39 words", () => {
    const words = codec.entropyToRecoveryWords(new Uint8Array(32));
    expect(words).toHaveLength(24);
    expect(words.slice(0, 23)).toEqual(new Array(23).fill("abandon"));
    expect(words[23]).toBe("art");
    expect(codec.recoveryWordsToEntropy(words)).toEqual(new Uint8Array(32));
  });

  it("rejects wrong counts and checksum-invalid words", () => {
    const valid = codec.entropyToRecoveryWords(new Uint8Array(32));
    expect(() => codec.recoveryWordsToEntropy(valid.slice(0, 23))).toThrow(
      "impossible-length",
    );
    expect(() =>
      codec.recoveryWordsToEntropy([...valid.slice(0, 23), "abandon"]),
    ).toThrow("noncanonical-text");
  });
});
