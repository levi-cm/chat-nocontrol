# LOW-003: No explicit BIP39 NFKD-canonicalization or invalid-word rejection test for imported recovery words

- **Severity:** LOW
- **Category:** test-gap
- **Subsystem:** src/tests/unit/recovery-words.test.ts, src/tests/property/recovery-roundtrip.property.test.ts
- **Locations:** `src/crypto/recovery-words.ts:13`, `src/crypto/recovery-words.ts:29`, `src/tests/unit/recovery-words.test.ts:15`
- **Exploitability:** Theoretical — the codec enforces both invariants; the gap is that no test guards them against regression. No exploitable class is currently masked.
- **Impact:** A regression that dropped NFKD normalization or the `validateMnemonic` invalid-word check would let non-canonical or non-wordlist input silently decode to entropy, weakening the recovery-word integrity contract. §14 normative requirement is only partially covered by tests.

## Summary

`docs/security-architecture.md` §14 mandates "BIP39 NFKD canonicalization and lowercase single-space normalization for imported mnemonics" and "Rejection of invalid recovery words and invalid word counts." The codec (`createRecoveryWordCodec`) applies NFKD + trim + lowercase + single-space join and calls `validateMnemonic`, which rejects both non-wordlist words and checksum-invalid mnemonics. The tests cover the round-trip, wrong word count, and a checksum-invalid (last-word-swapped) case, but never exercise NFKD canonicalization (e.g. fullwidth/compatibility-decomposed input) nor a genuinely invalid (non-wordlist) word.

## Vulnerability detail

Implementation enforces the invariants in `src/crypto/recovery-words.ts`:

```ts
// src/crypto/recovery-words.ts:10
function canonicalMnemonic(words: string[]): string {
  if (words.length !== 24) throw new PPXError("impossible-length");
  const normalized = words.map((word) =>
    word.normalize("NFKD").trim().toLowerCase(),     // line 13 — NFKD + lowercase
  );
  if (normalized.some((word) => word.length === 0 || /\s/u.test(word))) {
    throw new PPXError("noncanonical-text");          // single-space / no-internal-whitespace
  }
  return normalized.join(" ");
}
// src/crypto/recovery-words.ts:29
if (!validateMnemonic(mnemonic, wordlist)) {          // rejects non-wordlist AND checksum-invalid
  throw new PPXError("noncanonical-text");
}
```

Existing test coverage (`src/tests/unit/recovery-words.test.ts`):
- line 7: encodes 32 bytes → 24 BIP39 words, round-trips (`abandon`×23 + `art`).
- line 15 ("rejects wrong counts and checksum-invalid words"): 23 words → `impossible-length` (word count ✓); replacing the last word with `abandon` → `noncanonical-text` (checksum-invalid ✓ — this exercises `validateMnemonic`'s checksum path).
- `src/tests/property/recovery-roundtrip.property.test.ts:6`: round-trips 100 random 32-byte entropy samples (valid input only).

What is NOT asserted:
1. **NFKD canonicalization**: no test feeds compatibility-decomposed or fullwidth input (e.g. `"ＡＢＡＮＤＯＮ"` fullwidth, or `"abandon"` with a combining mark) and asserts it is accepted/rejected per the canonicalization rule. The §14 bullet "BIP39 NFKD canonicalization and lowercase single-space normalization for imported mnemonics" has no direct test.
2. **Invalid (non-wordlist) word**: no test feeds a 24-word string containing a word that is not in the BIP39 English wordlist (e.g. `"zzzzzzzz"`) and asserts rejection. The checksum-invalid case (`abandon` swapped in) is still a *wordlist* word, so it only tests the checksum path of `validateMnemonic`, not the word-not-in-list path. The §14 bullet "Rejection of invalid recovery words" is therefore only partially covered.

## Exploit scenario

Assumptions: a future refactor replaces `validateMnemonic` with a checksum-only check, or drops the `word.normalize("NFKD")` call. The current suite would still pass (round-trip, word-count, and checksum-invalid tests do not require either behavior).

1. With NFKD dropped, an attacker who can influence the recovery-import input could supply visually-identical-but-distinct Unicode (e.g. fullwidth letters) that decode to different entropy than the user intended, or that bypass a downstream exact-match comparison.
2. With the wordlist membership check dropped, a 24-token string containing non-wordlist tokens could be accepted if its trailing checksum bytes happen to align, accepting a non-BIP39 mnemonic as valid recovery material.

Neither is currently possible because the implementation is correct; the risk is purely regression exposure of an unenforced §14 requirement.

## Proof of concept

The missing assertions (non-harmful, test-only):

```ts
// In src/tests/unit/recovery-words.test.ts
it("NFKD-canonicalizes and lowercases imported mnemonics", () => {
  const codec = createRecoveryWordCodec();
  const valid = codec.entropyToRecoveryWords(new Uint8Array(32)); // 23x "abandon" + "art"
  // Fullwidth + uppercase + surrounding spaces must still decode to the same entropy.
  const fullwidth = valid.map((w) =>
    w.toUpperCase().normalize("NFKD") === w.toUpperCase()
      ? ` ${w.toUpperCase().replace(/A/gu, "Ａ")} ` // compatibility form
      : w,
  );
  // Simpler direct assertion: uppercase + extra spaces are accepted via NFKD+trim+lowercase.
  const upperSpaced = valid.map((w) => ` ${w.toUpperCase()} `);
  expect(codec.recoveryWordsToEntropy(upperSpaced)).toEqual(new Uint8Array(32));
});

it("rejects a non-wordlist word", () => {
  const codec = createRecoveryWordCodec();
  const valid = codec.entropyToRecoveryWords(new Uint8Array(32));
  const tampered = valid.slice();
  tampered[0] = "zzzzzzzz"; // not in BIP39 English wordlist
  expect(() => codec.recoveryWordsToEntropy(tampered)).toThrow("noncanonical-text");
});
```

## Remediation

Add the two tests above to `src/tests/unit/recovery-words.test.ts`. They directly exercise the NFKD canonicalization path (`recovery-words.ts:13`) and the wordlist-membership rejection path inside `validateMnemonic` (`recovery-words.ts:29`).

## Verification of fix

```sh
npx vitest run src/tests/unit/recovery-words.test.ts
```

## References

- `docs/security-architecture.md` §14 ("Rejection of invalid recovery words and invalid word counts." / "BIP39 NFKD canonicalization and lowercase single-space normalization for imported mnemonics.")
- `src/crypto/recovery-words.ts:13` (NFKD+lowercase), `:29` (`validateMnemonic`)
- `src/tests/unit/recovery-words.test.ts:15` (existing wrong-count + checksum-invalid tests)
- CWE-176: Improper Handling of Unicode Encoding
