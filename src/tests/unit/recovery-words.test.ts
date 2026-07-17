import { describe, expect, it } from "vitest";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";
import recoveryWordsSource from "../../crypto/recovery-words.ts?raw";

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

  it("NFKD-canonicalizes compatibility characters and lowercase input", () => {
    const valid = codec.entropyToRecoveryWords(new Uint8Array(32));
    const compatibilityInput = valid.map(
      (word) =>
        ` ${[...word.toUpperCase()]
          .map((character) =>
            String.fromCodePoint((character.codePointAt(0) as number) + 0xfee0),
          )
          .join("")} `,
    );

    expect(codec.recoveryWordsToEntropy(compatibilityInput)).toEqual(
      new Uint8Array(32),
    );
    expect(recoveryWordsSource).toContain('word.normalize("NFKD")');
  });

  it("rejects a non-wordlist recovery word", () => {
    const valid = codec.entropyToRecoveryWords(new Uint8Array(32));
    valid[0] = "zzzzzzzz";

    expect(() => codec.recoveryWordsToEntropy(valid)).toThrow(
      "noncanonical-text",
    );
  });
});
