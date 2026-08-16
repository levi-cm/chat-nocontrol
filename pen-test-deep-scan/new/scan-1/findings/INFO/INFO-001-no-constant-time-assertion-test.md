# INFO-001: No test asserts constant-time behavior of the secret comparison primitive

- **Severity:** INFO
- **Category:** test-gap
- **Subsystem:** src/protocol/checksum.ts (equalBytes), src/tests/unit/**
- **Locations:** `src/protocol/checksum.ts:7`, `src/tests/unit/primitive-vectors.test.ts`, `src/tests/unit/ppxc.test.ts`
- **Exploitability:** Theoretical — `equalBytes` is a textbook XOR-accumulate constant-time compare with no early exit; the implementation is correct. The gap is observational: no test pins the constant-time property, so a regression to a short-circuiting compare would not be caught.
- **Impact:** None currently. A future regression to `left[i] !== right[i] ? false : ...` (early-return) would re-introduce a timing oracle on secret comparisons (checksums, AEAD tags, fingerprints, recipientIds). The blast radius is large (`equalBytes` is referenced across 54 crypto/protocol files).

## Summary

`equalBytes` is the single comparison primitive used for every secret-bearing equality check (checksum verification, AEAD-tag-equivalent checks via checksum16, recipientId binding, fingerprint matching). It is implemented constant-time. The prior audit's claim that `equalBytes` is constant-time and used everywhere is re-verified here as correct. No test, however, asserts the constant-time property; this is a best-practice observation, not an exploitable finding.

## Vulnerability detail

`src/protocol/checksum.ts:7`:
```ts
export function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left[index] as number) ^ (right[index] as number);
  }
  return difference === 0;
}
```

This is the standard constant-time compare: the length check is public, the loop always runs to completion, and the accumulator is reduced once at the end. There is no data-dependent branch or early return on the secret bytes. `equalBytes` is used at every integrity gate — e.g. `parseLockedVault` checksum (`ppxv.ts:102`), `parseEncryptedFileObject` checksum (`ppxf.ts:207`), recipientId binding (`file.ts:563`, `:862`), forged-self-signature detection (`ppxc.ts`), and PPXT armor digest (`ppxt-armor.ts:85`).

What is NOT asserted: no test measures that two inputs differing at the last byte take the same number of operations as two inputs differing at the first byte, nor does any test static-check that the compare lacks an early return. `src/tests/unit/primitive-vectors.test.ts` covers KAT values; `src/tests/unit/ppxc.test.ts:73` covers forged-signature rejection — neither pins timing behavior.

## Exploit scenario

Assumptions: a future "performance" refactor rewrites `equalBytes` to short-circuit (`if (left[i] !== right[i]) return false`). No current test would fail.

1. The short-circuiting compare introduces a timing side channel on checksum/tag verification.
2. An attacker who can measure decryption-time differences (e.g. via a co-located timing probe, or repeated decrypt attempts observable over a message-link channel) could distinguish "first byte differs" from "last byte differs," leaking information about the correct checksum/tag bytes.
3. Over many queries this could permit a forgery-by-timing attack against the checksum gate that protects AEAD output.

This is theoretical for an in-browser app (timing resolution is coarse and the checksum is SHA-512-derived, not a direct MAC tag), hence INFO.

## Proof of concept

A property-style timing-invariance test (non-harmful, test-only — measures equal operation count, not wall-clock time, to avoid flakiness):

```ts
// Sketch: assert the compare performs the same number of byte accesses regardless
// of where the first difference lies. Instrument via a counter spy on indexed access.
it("equalBytes touches every byte regardless of difference position", () => {
  const a = new Uint8Array(32).fill(1);
  const diffFirst = a.slice(); diffFirst[0] ^= 1;
  const diffLast  = a.slice(); diffLast[31] ^= 1;
  let accesses = 0;
  const desc = Object.getOwnPropertyDescriptor(Uint8Array.prototype, Symbol.iterator);
  // ... count indexed reads during equalBytes(a, diffFirst) vs equalBytes(a, diffLast)
  //   and assert the counts are equal.
});
```

A simpler, lower-flakiness alternative is a static lint rule or a frozen-snapshot test that asserts the `equalBytes` source still contains no `return` inside the loop and still uses a single post-loop reduction.

## Remediation

Optional hardening, not a fix for a present vulnerability:
- Add a snapshot/source-shape test asserting `equalBytes` has no early return inside its loop (pins the property against accidental refactor), OR
- Adopt a static-analysis lint rule that flags short-circuiting comparisons on `Uint8Array`.

No runtime behavior change is required.

## Verification of fix

```sh
npx vitest run src/tests/unit/<new-ct-shape-test>.test.ts
```

## References

- `docs/security-architecture.md` §14 ("Best-effort zeroization checks where feasible." — constant-time is the sibling property)
- `src/protocol/checksum.ts:7` (equalBytes, XOR-accumulate, no early exit)
- CWE-208: Observable Timing Discrepancy (the class a future regression would reintroduce)
- CWE-697: Incorrect Comparison
