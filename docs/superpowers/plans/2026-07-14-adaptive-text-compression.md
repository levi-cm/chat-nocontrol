# Adaptive PPXT Text Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans`. Execute this only after `2026-07-14-recovery-runtime-ux-repair.md` is complete. This is a protocol change, so use test-driven development and stop if deployed-release state has changed.

**Goal:** Reduce the size of long, repetitive Markdown and other compressible text without adding a noticeable encryption/decryption delay, enlarging incompressible messages, or changing canonical PPXT version-1 bytes.

**Architecture:** Keep the canonical signed inner payload unchanged. For eligible messages, gzip the complete signed inner bytes inside the existing crypto worker before AES-GCM encryption, then identify that transport with a canonical PPXT version-2 outer header. Updated readers accept both uncompressed v1 and compressed v2. Writers retain v1 whenever compression is unavailable or does not clear the savings threshold.

**Tech Stack:** TypeScript, Web Workers, built-in `CompressionStream` / `DecompressionStream`, Vitest, fast-check, Playwright. Add no compression dependency.

---

## Evaluation result

**Recommendation:** Implement adaptive compression for text messages only, behind the protocol and device gates in this plan.

- It is not already implemented. `encodeSignedTextInner()` UTF-8 encodes the plaintext directly, `encryptText()` encrypts those signed-inner bytes, and PPXT currently requires `formatVersion: 1` with `flags: 0`.
- A local gzip benchmark on this machine reduced the real `Chat_NoControl_full_plan.md` fixture from `61,085` to `21,341` bytes, a `65.1%` reduction. Median gzip time was `1.443ms`; median gunzip time was `0.460ms` across ten runs.
- The same benchmark changed `61,085` random bytes into `61,123` bytes. Automatic acceptance thresholds therefore matter: incompressible content must stay v1 and must never become larger.
- The browser API runs in Web Workers and has been broadly available across engines since 2023, but exact phone browsers still remain a release test, not an assumption.
- Compression leaks something about content length and repetition. The PPXT ciphertext length is already visible, and this application has no remote request/response compression oracle. Even so, the security documentation must explicitly forbid reuse of this compressor for attacker-controlled web responses or mixed hidden-secret/chosen-input protocols.

Sources:

- [WHATWG Compression Standard](https://compression.spec.whatwg.org/)
- [MDN CompressionStream constructor](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream)
- [MDN DecompressionStream constructor](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream)

## Locked protocol decisions

- PPXT v1 remains byte-for-byte unchanged and continues to require `formatVersion = 0x01`, `suite = 0x01`, and `flags = 0x00`.
- Compressed text uses `formatVersion = 0x02`, `suite = 0x01`, and `flags = 0x01`. In v2, bit 0 means that the AES-GCM plaintext is one complete gzip member containing the canonical signed-inner bytes. Every other v2 flag value is rejected.
- Do not repurpose a v1 reserved flag. The existing protocol documentation and golden fixture require v1 flags to be zero.
- Keep `PPXT_HEADER_SIZE = 855`; the version and flag bytes already exist. Both exact bytes remain authenticated as AES-GCM AAD.
- The signature domain and signed-inner encoding remain `PPX/TEXT/V1/SIGNATURE`. Compression wraps the already signed bytes and does not create a second representation of signed content.
- No Markdown parsing or dictionary is used. The decision is based only on encoded byte size, so it also helps repetitive plain text and source code.
- Attempt compression only when signed-inner size is at least `1,024` bytes.
- Emit v2 only when gzip saves at least both `64` bytes and `10%` of the signed-inner size:

```ts
const minimumSavings = Math.max(64, Math.ceil(inner.byteLength * 0.1));
const useCompressed = compressed.byteLength <= inner.byteLength - minimumSavings;
```

- Below the threshold, on unsupported runtimes, or when compression throws, emit canonical v1. Compression failure must never make ordinary encryption fail.
- Decompression failure, trailing gzip data, output over the signed-inner maximum, or unavailable gzip support for an incoming v2 message fails closed. It must never fall back to parsing compressed bytes as v1.
- File payloads, recovery artifacts, contacts, and browser vaults are out of scope.

## Compatibility and rollout gate

`docs/deployed-releases.json` contains no deployments at plan time. Re-read it immediately before implementation.

- If it is still empty, ship v1 reader compatibility and v2 reader/writer support together before the first public release.
- If any deployment exists, split rollout into two releases: first deploy v2 decoding with v2 emission disabled, then enable v2 writing only after the reader release is the supported minimum. Record the minimum compatible version in both user guides.
- Old apps continue reading all v1 messages. They will reject v2 messages, so do not enable v2 emission without satisfying the rollout rule.

## Worktree safety

The worktree contains user changes. Do not reset, checkout, or replace files wholesale. Before every task, inspect `git diff -- <paths>`. Stage only the files listed for that task.

### Task 1: Add failing compression and protocol-v2 tests

**Files:**
- Create: `src/tests/unit/text-compression.test.ts`
- Modify: `src/tests/property/ppxt-outer-roundtrip.property.test.ts`
- Modify: `src/tests/property/truncation.property.test.ts`
- Modify: `src/tests/property/mutation.property.test.ts`
- Modify: `src/tests/property/boundary.property.test.ts`
- Modify: `src/tests/unit/protocol-goldens.test.ts`
- Modify: `src/tests/unit/crypto-runner.test.ts`
- Modify: `src/tests/helpers/canonical-protocol.ts`
- Create: `fixtures/protocol/golden-v2-ppxt.json`

- [ ] Preserve the committed v1 PPXT bytes and SHA-512 unchanged. Treat any v1 fixture diff as a failure.
- [ ] Add deterministic v2 header/outer/armor fixtures with `formatVersion = 2`, `flags = 1`, fixed ciphertext bytes, full encoded bytes, and SHA-512.
- [ ] Add failing exact-pair tests: accept only v1/flag0 and v2/flag1; reject v1/flag1, v2/flag0, v2 unknown bits, and versions above 2.
- [ ] Add failing gzip helper tests for empty input, `1,023/1,024/1,025` byte boundaries, Unicode Markdown, random bytes, corrupt gzip, truncated gzip, trailing gzip data, and a compressed bomb whose decoded output crosses `264,000` bytes.
- [ ] Add a worker round trip for compressible Markdown and an assertion that an incompressible message remains v1.
- [ ] Run the focused tests and confirm only the new behavior fails:

```bash
npx vitest run \
  src/tests/unit/text-compression.test.ts \
  src/tests/property/ppxt-outer-roundtrip.property.test.ts \
  src/tests/property/truncation.property.test.ts \
  src/tests/property/mutation.property.test.ts \
  src/tests/property/boundary.property.test.ts \
  src/tests/unit/protocol-goldens.test.ts \
  src/tests/unit/crypto-runner.test.ts
```

Expected: new v2/compression assertions fail; v1 goldens remain green.

- [ ] Commit only the failing tests and new fixture contract:

```bash
git add src/tests/unit/text-compression.test.ts src/tests/property/ppxt-outer-roundtrip.property.test.ts src/tests/property/truncation.property.test.ts src/tests/property/mutation.property.test.ts src/tests/property/boundary.property.test.ts src/tests/unit/protocol-goldens.test.ts src/tests/unit/crypto-runner.test.ts src/tests/helpers/canonical-protocol.ts fixtures/protocol/golden-v2-ppxt.json
git commit -m "test: define adaptive PPXT compression contract"
```

### Task 2: Implement bounded gzip helpers

**Files:**
- Create: `src/crypto/text-compression.ts`
- Modify: `src/protocol/ppxt-inner.ts`
- Test: `src/tests/unit/text-compression.test.ts`

- [ ] Export the existing inner limits rather than duplicating numbers:

```ts
export const PPXT_MAXIMUM_PLAINTEXT_SIZE = 262_144;
export const PPXT_MAXIMUM_INNER_SIZE = 264_000;
```

- [ ] Implement `supportsGzipStreams()` by constructing both `CompressionStream("gzip")` and `DecompressionStream("gzip")` inside a guarded try/catch. Do not infer support from property presence alone.
- [ ] Implement `gzipBytes(input)` and `gunzipBytesBounded(input, maximumOutputBytes)` using stream readers. Sum output chunks before concatenation, cancel immediately when the limit is crossed, reject malformed/truncated/trailing gzip, and never use `Response(...).arrayBuffer()` for decompression because it cannot enforce the output limit while reading.
- [ ] Keep compression inside the existing crypto worker. Do not move any private bytes to the UI thread.
- [ ] Zeroize temporary chunks and concatenated arrays in all success, rejection, and cancellation paths after ownership transfers.
- [ ] Run:

```bash
npx vitest run src/tests/unit/text-compression.test.ts src/tests/property/boundary.property.test.ts
```

Expected: helper tests pass, including the decompression limit.

- [ ] Commit:

```bash
git add src/crypto/text-compression.ts src/protocol/ppxt-inner.ts src/tests/unit/text-compression.test.ts src/tests/property/boundary.property.test.ts
git commit -m "feat: add bounded worker text compression"
```

### Task 3: Add canonical PPXT v2 outer and armor codecs

**Files:**
- Modify: `src/protocol/types.ts`
- Modify: `src/protocol/ppxt-outer.ts`
- Modify: `src/protocol/ppxt-armor.ts`
- Modify: `src/tests/helpers/canonical-protocol.ts`
- Modify: `src/tests/property/ppxt-outer-roundtrip.property.test.ts`
- Modify: `src/tests/property/parser-roundtrip.property.test.ts`
- Modify: `src/tests/property/truncation.property.test.ts`
- Modify: `src/tests/property/mutation.property.test.ts`
- Modify: `src/tests/unit/protocol-goldens.test.ts`
- Modify: `fixtures/protocol/golden-v2-ppxt.json`

- [ ] Replace the loose version/flag pair with a discriminated union:

```ts
type PPXTEnvelopeVersion =
  | { formatVersion: 0x01; flags: 0x00 }
  | { formatVersion: 0x02; flags: 0x01 };

export type EncryptedTextObject = EncryptedTextObjectBase & PPXTEnvelopeVersion;
```

- [ ] Make header encoding write the object's actual canonical pair. Make parsing accept only the two locked pairs. Keep all length, checksum, no-recipient-hint, and unknown-suite checks unchanged.
- [ ] Change armor to write `Version: 1` or `Version: 2` from the parsed outer object. Decode only those values and require the armor version to equal the binary object version before canonical re-encoding.
- [ ] Keep the v1 fixture byte-for-byte stable and add the fixed v2 fixture separately.
- [ ] Run:

```bash
npx vitest run \
  src/tests/property/ppxt-outer-roundtrip.property.test.ts \
  src/tests/property/parser-roundtrip.property.test.ts \
  src/tests/property/truncation.property.test.ts \
  src/tests/property/mutation.property.test.ts \
  src/tests/unit/protocol-goldens.test.ts
```

Expected: both canonical versions pass; invalid pairs fail closed.

- [ ] Commit:

```bash
git add src/protocol/types.ts src/protocol/ppxt-outer.ts src/protocol/ppxt-armor.ts src/tests/helpers/canonical-protocol.ts src/tests/property/ppxt-outer-roundtrip.property.test.ts src/tests/property/parser-roundtrip.property.test.ts src/tests/property/truncation.property.test.ts src/tests/property/mutation.property.test.ts src/tests/unit/protocol-goldens.test.ts fixtures/protocol/golden-v2-ppxt.json
git commit -m "feat: add canonical compressed PPXT v2 envelope"
```

### Task 4: Integrate adaptive compression into text encryption

**Files:**
- Modify: `src/crypto/text.ts`
- Modify: `src/crypto/provider.ts`
- Modify: `src/crypto/default-provider.ts`
- Modify: `src/protocol/types.ts`
- Modify: `src/flows/decrypt/index.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/tests/unit/crypto-runner.test.ts`
- Modify: `src/tests/property/ppxt-inner-roundtrip.property.test.ts`
- Modify: `src/tests/property/crypto-interop.property.test.ts`
- Modify: `src/tests/e2e/encrypt-text.spec.ts`
- Modify: `src/tests/e2e/decrypt-smart-input.spec.ts`

- [ ] After `encodeSignedTextInner()`, try gzip only when the inner is at least `1,024` bytes and the runtime supports both stream constructors.
- [ ] Compare the complete gzip result with the locked dual threshold. Encrypt the gzip bytes with v2/flag1 only when accepted; otherwise wipe the candidate and encrypt the original inner with v1/flag0.
- [ ] Use the selected version/flags when building the header before AES-GCM so the compression marker is authenticated as AAD.
- [ ] On decrypt, parse and authenticate the outer object first. For v1, parse the decrypted bytes directly. For v2, gunzip with `PPXT_MAXIMUM_INNER_SIZE`, then parse and verify the canonical signed inner.
- [ ] Preserve the generic wrong-identity-or-corruption result for malformed authenticated content. Add a specific safe `unsupported-compression` result only when a valid v2 envelope reaches a runtime without gzip streams; the UI copy should tell the user to update/open the message in a supported browser without implying corruption.
- [ ] Ensure `finally` wipes the original inner, compression candidate, selected AES plaintext, decrypted compressed bytes, decompressed inner, hybrid secrets, and signing capability without double-owning buffers.
- [ ] Do not add a compression toggle, badge, spinner, or extra step to the user interface. This remains transparent and adaptive.
- [ ] Run:

```bash
npx vitest run src/tests/unit/crypto-runner.test.ts src/tests/property/ppxt-inner-roundtrip.property.test.ts src/tests/property/crypto-interop.property.test.ts
npx playwright test src/tests/e2e/encrypt-text.spec.ts src/tests/e2e/decrypt-smart-input.spec.ts
```

Expected: v1 and v2 round-trip; repetitive Markdown selects v2; short/random text stays v1.

- [ ] Commit:

```bash
git add src/crypto/text.ts src/crypto/provider.ts src/crypto/default-provider.ts src/protocol/types.ts src/flows/decrypt/index.tsx src/i18n/index.ts src/tests/unit/crypto-runner.test.ts src/tests/property/ppxt-inner-roundtrip.property.test.ts src/tests/property/crypto-interop.property.test.ts src/tests/e2e/encrypt-text.spec.ts src/tests/e2e/decrypt-smart-input.spec.ts
git commit -m "feat: compress beneficial text messages adaptively"
```

### Task 5: Document the wire format and security tradeoff

**Files:**
- Modify: `docs/protocol-v1.md`
- Create: `docs/protocol-v2.md`
- Modify: `docs/security-architecture.md`
- Modify: `docs/testing-and-release.md`
- Modify: `docs/user-guide.en.md`
- Modify: `docs/user-guide.de.md`
- Modify: `docs/implementation-status.md`
- Modify: `docs/deployed-releases.json` only through the existing release workflow, never by hand during feature development

- [ ] Leave the v1 specification intact except for a forward link to v2. Define the exact v2 version/flag pair, gzip member rules, adaptive threshold, unchanged inner/signature domain, AAD binding, decompression bound, and canonical armor version.
- [ ] State compatibility plainly: updated apps read v1 and v2; old apps read v1 only.
- [ ] Add the compression length-leak analysis to the security architecture. Explain why no network oracle exists in the current manual message workflow and ban future use where attacker-chosen text is compressed with hidden secrets and ciphertext length is observable across repeated requests.
- [ ] Document that compression is automatic, content-agnostic, limited to text, and may leave already compact text unchanged.
- [ ] Run the Markdown/link checks already defined by the repository.
- [ ] Commit:

```bash
git add docs/protocol-v1.md docs/protocol-v2.md docs/security-architecture.md docs/testing-and-release.md docs/user-guide.en.md docs/user-guide.de.md docs/implementation-status.md
git commit -m "docs: specify adaptive PPXT v2 compression"
```

### Task 6: Prove phone compatibility and imperceptible overhead

**Files:**
- Create: `scripts/benchmark-text-compression.ts`
- Modify: `package.json`
- Modify: `src/tests/release/performance.spec.ts`
- Modify: `src/tests/release/device-matrix.spec.ts`
- Modify: `docs/testing-and-release.md`

- [ ] Add a deterministic benchmark corpus:
  - short conversational text;
  - the real `Chat_NoControl_full_plan.md` sample;
  - repeated Markdown near `262,144` bytes;
  - high-entropy Unicode text near the limit;
  - already-compressed/base64-like text.
- [ ] Report input bytes, gzip bytes, chosen v1/v2, percentage saved, compression time, decompression time, and full encrypt/decrypt time. Never print the corpus content or private keys.
- [ ] Benchmark inside the actual worker path, not only a Node helper.
- [ ] Test desktop Helium, desktop Firefox, phone Chromium, and phone Firefox over HTTPS.
- [ ] Release gates on every supported phone:
  - exact gzip stream support is present;
  - compressible `256KiB` input has compression p95 at or below `25ms`;
  - decompression p95 is at or below `25ms`;
  - full text encrypt/decrypt p95 regression is at or below `5%` compared with v1;
  - random/incompressible input emits v1 and output is never larger than the current format;
  - UI remains responsive because work stays off the main thread.
- [ ] Do not encode microsecond timing as a CI assertion. CI checks output choice and size deterministically; recorded real-device evidence enforces timing.
- [ ] If any supported phone misses the timing gate, ship v2 decoding only and leave v2 emission disabled until the gate passes. Do not loosen the threshold silently.
- [ ] Commit:

```bash
git add scripts/benchmark-text-compression.ts package.json src/tests/release/performance.spec.ts src/tests/release/device-matrix.spec.ts docs/testing-and-release.md
git commit -m "test: gate PPXT compression on real-device latency"
```

### Task 7: Full verification and release review

**Files:**
- Modify only files required by failures found during this task.

- [ ] Run:

```bash
npm run typecheck
npm run lint
npm run format:check
npx vitest run src/tests/unit/text-compression.test.ts src/tests/unit/protocol-goldens.test.ts src/tests/unit/crypto-runner.test.ts src/tests/property/ppxt-inner-roundtrip.property.test.ts src/tests/property/ppxt-outer-roundtrip.property.test.ts src/tests/property/parser-roundtrip.property.test.ts src/tests/property/truncation.property.test.ts src/tests/property/mutation.property.test.ts src/tests/property/boundary.property.test.ts src/tests/property/crypto-interop.property.test.ts
npx playwright test src/tests/e2e/encrypt-text.spec.ts src/tests/e2e/decrypt-smart-input.spec.ts src/tests/release/performance.spec.ts src/tests/release/device-matrix.spec.ts
npm run build
npm run verify:quality
```

- [ ] Confirm `fixtures/protocol/golden-v1.json` is unchanged from the pre-feature commit.
- [ ] Confirm v2 corruption, truncation, unknown flags, decompression bombs, and unsupported runtime fail closed with no plaintext output.
- [ ] Confirm v1 messages created before this change decrypt in the new build.
- [ ] Confirm `docs/deployed-releases.json` and the rollout mode still match the compatibility decision.
- [ ] Obtain the repository's required independent security review evidence before release. A missing review remains a release blocker, not a reason to bypass `verify:quality`.

## Acceptance summary

- Repetitive Markdown is substantially smaller; the representative local sample saves about 65%.
- Short or incompressible text remains canonical PPXT v1 and never grows.
- Compression and decompression run in the existing worker and satisfy the `25ms` p95 phone gates.
- PPXT v1 bytes and signatures remain unchanged and readable.
- Compressed messages have one canonical PPXT v2 representation with authenticated version/flag bytes.
- Decompression is strictly bounded before signed-inner parsing.
- No new compression package, user setting, animation, or workflow step is added.
- The compatibility and compression length-leak tradeoffs are documented and release-gated.
