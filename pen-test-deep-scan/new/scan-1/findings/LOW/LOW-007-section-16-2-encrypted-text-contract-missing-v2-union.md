# LOW-007: §16.2 EncryptedTextObject contract lists only v1 while code ships v2 union

- **Severity:** LOW
- **Category:** spec-drift
- **Subsystem:** docs/security-architecture.md §16.2 + src/protocol/types.ts + src/protocol/ppxt-outer.ts
- **Locations:** `docs/security-architecture.md:§16.2` (lines 526-538), `src/protocol/types.ts:132-145`, `src/protocol/ppxt-outer.ts:15-24,93-105`
- **Exploitability:** Theoretical — the v2 security behavior (AAD binds version+flags, decompression bounded to 264000 bytes, fail closed before plaintext release) IS normatively documented in `docs/protocol-v2.md` and summarized in `docs/security-architecture.md:§10` (lines 294-301). The drift is purely that the §16.2 "Normative contracts" block was not updated to reflect the v2 variant, so a contract-conformance check built from §16.2 would reject valid v2 objects.
- **Impact:** The documented guarantee was: §16 is labeled "Normative contracts" and §16.2 fixes `EncryptedTextObject` with `formatVersion: 0x01`. The code's `EncryptedTextObject` is a union that also permits `{ formatVersion: 0x02; flags: 0x01 }`. Concrete effect: the normative type contract is stale; a parser/serializer conformance test generated from §16.2 alone would not exercise or accept v2 objects, and a reviewer reading only §16.2 would believe `formatVersion` is fixed at `0x01`.

## Summary

`docs/security-architecture.md` §16.2 normatively declares `EncryptedTextObject` with `formatVersion: 0x01` and a plain `flags: number`. The shipped `src/protocol/types.ts:144-145` defines `EncryptedTextObject` as a union over `{ formatVersion: 0x01; flags: 0x00 } | { formatVersion: 0x02; flags: 0x01 }`, and `src/protocol/ppxt-outer.ts:93-105` enforces that exact v1/v2 pair on parse. The v2 transport is normatively specified in `docs/protocol-v2.md` and acknowledged in §10 (lines 294-301), but the §16.2 contract block — which the task checklist flags for exact field/type matching — was never updated.

## Vulnerability detail

Doc claim — `docs/security-architecture.md:§16.2` (lines 526-538):

> ```ts
> export interface EncryptedTextObject {
>   magic: 'PPXT';
>   formatVersion: 0x01;
>   suite: 0x01;
>   flags: number;
>   mlKemCiphertext: Uint8Array; // 768 bytes
>   ephemeralX25519PublicKey: Uint8Array; // 32 bytes
>   salt: Uint8Array; // 32 bytes
>   nonce: Uint8Array; // 12 bytes
>   ciphertextLength: number;
>   ciphertext: Uint8Array;
>   checksum: Uint8Array; // 16 bytes
> }
> ```

Code reality — `src/protocol/types.ts:132-145`:

```ts
interface EncryptedTextObjectBase {
  magic: "PPXT";
  suite: 0x01;
  mlKemCiphertext: Uint8Array;
  ephemeralX25519PublicKey: Uint8Array;
  salt: Uint8Array;
  nonce: Uint8Array;
  ciphertextLength: number;
  ciphertext: Uint8Array;
  checksum: Uint8Array;
}

export type EncryptedTextObject = EncryptedTextObjectBase &
  ({ formatVersion: 0x01; flags: 0x00 } | { formatVersion: 0x02; flags: 0x01 });
```

`src/protocol/ppxt-outer.ts:15-24` accepts exactly `(version 1, flags 0) | (version 2, flags 1)` and rejects everything else, and `src/protocol/ppxt-outer.ts:93-105` mirrors that on parse. The §16.2 contract only describes the v1 member. Note §10 (lines 294-301) and `docs/protocol-v2.md` do document v2 security behavior, so this is a stale contract block, not an undocumented protocol extension.

## Exploit scenario

1. A release-gate conformance test is generated from the §16.2 contract (the doc is labeled "Normative contracts").
2. The test asserts every serialized `EncryptedTextObject` has `formatVersion === 0x01`.
3. `src/crypto/text.ts:82-97` emits a v2 object (`{ formatVersion: 2, flags: 1 }`) whenever gzip saves ≥ max(64, 10%) bytes, which is the documented adaptive behavior.
4. The §16.2-grounded test fails on legitimate v2 traffic, or a reviewer reading only §16.2 concludes v2 is unsupported and removes the v2 parse branch, reintroducing a v2 fail-open regression.

Assumptions: no runtime exploit; this is a contract-accuracy gap. The v2 security guarantees themselves are documented elsewhere and upheld by the code.

## Proof of concept

See `pen-test-deep-scan/new/scan-1/pocs/LOW-007.md` — a non-harmful diff between the §16.2 `EncryptedTextObject` interface and `src/protocol/types.ts:132-145`, plus the v2 emit site at `src/crypto/text.ts:82-97`.

## Remediation

Fix the doc to match the code: replace the single `formatVersion: 0x01` interface in §16.2 with the union form `({ formatVersion: 0x01; flags: 0x00 } | { formatVersion: 0x02; flags: 0x01 })` and cross-reference `docs/protocol-v2.md` for the v2 AAD/decompression rules. (The code is the intended, documented-in-protocol-v2 behavior; the §16.2 block is simply stale.)

## Verification of fix

`npm run format:check` on `docs/security-architecture.md` and a manual diff confirming the §16.2 `EncryptedTextObject` matches `src/protocol/types.ts:144-145`.

## References

`docs/security-architecture.md:§16.2` (lines 526-538), `docs/security-architecture.md:§10` (lines 294-301), `docs/protocol-v2.md:8-39`, `src/protocol/types.ts:132-145`, `src/protocol/ppxt-outer.ts:15-24,93-105`, `src/crypto/text.ts:82-97`. CWE-1078 / CWE-1164 (documentation-accuracy / contract-drift).
