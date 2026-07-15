# Encrypted Message QR Implementation Plan

<!-- markdownlint-disable MD013 -->

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Run autonomously through safe work overnight. Do not pause for ordinary approval checkpoints. Stop only for a genuine security decision, destructive action outside listed files, or a hard external blocker. Use test-driven development and `superpowers:verification-before-completion`.

**Goal:** Add downloadable, compressed, encrypted single-QR messages; fast camera/image/link decryption; and locally persisted QR UX settings without weakening the existing hybrid cryptography.

**Architecture:** Keep normal PPXT output unchanged. Add a compact contact-referenced `PPXQ` envelope using the same ML-KEM-768 + X25519 + AES-256-GCM + Ed25519 suite. Generate PPXT and PPXQ from one logical message ID/timestamp, encode PPXQ through high-recovery QR level H, and accept either compact in-app payloads or fragment-only HTTPS camera links. Decrypt PPXQ only against an already-saved sender contact, with bounded adaptive gzip, fail-closed parsing, and transient link handling.

**Tech Stack:** Preact, TypeScript, existing crypto providers/workers, existing `qrcode` and `@zxing/browser`, existing browser-local IndexedDB/session settings, Vitest, fast-check, Playwright.

---

## Required reading and execution order

1. Read `AGENTS.md` if present and inspect the current worktree before editing.
2. Read `docs/superpowers/specs/2026-07-14-encrypted-message-qr-design.md` completely.
3. Check whether `docs/superpowers/plans/2026-07-14-recovery-runtime-ux-repair.md` and `docs/superpowers/plans/2026-07-14-adaptive-text-compression.md` are already implemented. The adaptive-compression plan declares the recovery plan as its prerequisite; honor that order if either remains pending.
4. Re-read `docs/deployed-releases.json`. If any public release now exists, preserve reader-before-writer compatibility and do not emit a new wire format until the compatible reader rollout is available.
5. Then execute this plan in order.

## Non-negotiable constraints

- Current PPXT cannot fit even an empty message into version-40/H. Do not attempt to compress ciphertext or claim otherwise.
- Never lower QR error correction below H. Never remove ML-KEM, X25519, AES-GCM, or Ed25519 to gain capacity.
- One QR only. Oversize means no download action; do not silently create a sequence.
- Normal PPXT remains available for long messages and unknown senders.
- PPXQ plaintext is released only after AEAD authentication, recipient check, known-sender lookup, Ed25519 verification, bounded decompression, and canonical UTF-8 validation.
- A normal-camera link stores ciphertext only after `#`; scrub it from the address immediately after capture.
- Settings are browser-local only. Persist preferences, never messages or pending ciphertext.
- Preserve English/German parity and keyboard/screen-reader behavior.
- Preserve user changes. Never run `git reset --hard`, `git checkout --`, or `git add -A`.

## Worktree safety

Before each task:

```bash
git status --short --branch
git diff -- <all paths listed for the task>
```

If listed files contain unrelated user edits, patch narrowly. Stage only exact task files after reviewing `git diff --cached`. Commits are allowed only for completed, verified task slices. Do not publish, tag, push, or open a PR as part of this plan.

## Locked PPXQ layout

Outer header is exactly 853 bytes:

```text
PPXQ magic                 4
formatVersion = 0x01       1
suite = 0x01               1
flags                      1  bit0=gzip, other bits rejected
mlKemCiphertext           768
ephemeralX25519PublicKey  32
salt                       32
nonce                      12
ciphertextLength uint16be  2
```

Then `ciphertext`, then 16-byte checksum. Header is AES-GCM AAD.

Signed inner before its 64-byte signature:

```text
senderFingerprint          32
recipientIdentityId        20
messageId                  16
sentAt uint64be             8
createdAt uint64be          8
originalUtf8Length uint32be 4
storedPayloadLength uint16be 2
storedPayload               N
signature                  64
```

Signature domain: `PPX/QR-TEXT/V1/SIGNATURE`.

Base transport alphabet: `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-`.

## File map

New focused units:

- `src/protocol/base37.ts`: canonical URL-safe QR-alphanumeric byte codec.
- `src/protocol/ppxq-inner.ts`: signed compact inner encoder/parser.
- `src/protocol/ppxq-outer.ts`: canonical PPXQ outer encoder/parser and constants.
- `src/protocol/ppxq.ts`: public protocol facade and text/link transport normalization.
- `src/crypto/qr-text.ts`: PPXQ encrypt/decrypt, compression selection, known-sender verification, zeroization.
- `src/components/qr/message.ts`: QR segment construction, capacity result, and PNG generation.
- `src/components/qr/image-recovery.ts`: bounded screenshot retry transforms.
- `src/components/navigation/qr-icon.tsx`: reusable QR action icon.

Existing integration points:

- `src/workers/crypto-runner.ts`, `crypto-worker.ts`, `crypto-client.ts`: compact encrypt/decrypt jobs.
- `src/flows/encrypt/text.tsx`: same-message PPXT/PPXQ output and download actions.
- `src/flows/decrypt/index.tsx`, `classify.ts`: camera/image/link import and immediate decrypt.
- `src/components/qr/import.tsx`, `scan.ts`, `zxing.ts`: configurable controls and robust image scanning.
- `src/storage/db.ts`, `settings.ts`, `session.ts`, `src/app/App.tsx`, `src/flows/settings/index.tsx`: persistence and props.
- `src/app/routes.ts`: transient universal-link route capture.
- `src/i18n/index.ts`, `src/styles.css`: complete EN/DE and responsive/accessibility UI.

### Task 1: Characterize capacity and add failing base37/PPXQ protocol tests

**Files:**

- Create: `src/tests/unit/base37.test.ts`
- Create: `src/tests/unit/ppxq.test.ts`
- Create: `src/tests/property/ppxq-roundtrip.property.test.ts`
- Modify: `src/tests/property/truncation.property.test.ts`
- Modify: `src/tests/property/mutation.property.test.ts`
- Modify: `src/tests/property/boundary.property.test.ts`
- Modify: `src/tests/helpers/canonical-protocol.ts`
- Create: `fixtures/protocol/golden-v1-ppxq.json`

- [ ] **Step 1: Record the physical baseline in a test**

Assert current minimum PPXT bytes exceed version-40/H byte capacity and lock PPXQ fixed overhead:

```ts
expect(minimumCurrentPpxtBytes).toBeGreaterThan(1_273);
expect(PPXQ_HEADER_SIZE).toBe(853);
expect(encodedEmptyPpxq.byteLength).toBe(1_039);
```

- [ ] **Step 2: Add canonical base37 tests**

Cover empty bytes, leading zero bytes, all byte values, 1,200-byte inputs, invalid lowercase/underscore/space, noncanonical leading digits, oversize-before-allocation, and `encode(decode(text)) === text`.

- [ ] **Step 3: Add PPXQ golden and round-trip tests**

The fixture must lock every field offset, encoded bytes, checksum, and SHA-512. Tests must accept only version 1/suite 1/flags 0 or 1; reject every other pair, malformed lengths, trailing bytes, checksum changes, signature changes, wrong identity, unknown sender, and decompression output above 262,144 bytes.

- [ ] **Step 4: Add property tests**

Use fast-check for canonical base37 byte round trips, PPXQ outer round trips, every truncation point around fixed fields, one-bit mutations in header/ciphertext/checksum, and payload lengths around the exact single-QR fit boundary.

- [ ] **Step 5: Run red tests**

```bash
npx vitest run \
  src/tests/unit/base37.test.ts \
  src/tests/unit/ppxq.test.ts \
  src/tests/property/ppxq-roundtrip.property.test.ts \
  src/tests/property/truncation.property.test.ts \
  src/tests/property/mutation.property.test.ts \
  src/tests/property/boundary.property.test.ts
```

Expected: new imports/behavior fail; unrelated existing assertions remain green.

- [ ] **Step 6: Commit only characterization tests**

```bash
git add src/tests/unit/base37.test.ts src/tests/unit/ppxq.test.ts src/tests/property/ppxq-roundtrip.property.test.ts src/tests/property/truncation.property.test.ts src/tests/property/mutation.property.test.ts src/tests/property/boundary.property.test.ts src/tests/helpers/canonical-protocol.ts fixtures/protocol/golden-v1-ppxq.json
git commit -m "test: define encrypted message QR protocol"
```

### Task 2: Implement canonical base37 and PPXQ codecs

**Files:**

- Create: `src/protocol/base37.ts`
- Create: `src/protocol/ppxq-inner.ts`
- Create: `src/protocol/ppxq-outer.ts`
- Create: `src/protocol/ppxq.ts`
- Modify: `src/protocol/types.ts`
- Test: files from Task 1

- [ ] **Step 1: Implement bounded canonical base37 conversion**

Expose this exact API:

```ts
export const BASE37_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-";
export function encodeBase37Upper(bytes: Uint8Array): string;
export function decodeBase37Upper(text: string, maximumBytes: number): Uint8Array;
```

Preserve leading zero bytes explicitly. Reject lowercase, alternate encodings, values over `maximumBytes`, and any text whose canonical re-encoding differs.

- [ ] **Step 2: Define discriminated PPXQ types and errors**

Add `EncryptedQrTextObject`, `EncryptQrTextInput`, and `DecryptQrTextInput`. Add a safe `unknown-sender-contact` crypto error. Keep `flags` as `0x00 | 0x01`, message ID fixed at 16 bytes, and ciphertext length bounded to uint16.

- [ ] **Step 3: Implement outer codec**

Export:

```ts
export const PPXQ_HEADER_SIZE = 853;
export const PPXQ_CHECKSUM_SIZE = 16;
export const PPXQ_MAXIMUM_OBJECT_SIZE = 65_535 + PPXQ_HEADER_SIZE + PPXQ_CHECKSUM_SIZE;
export function encodeEncryptedQrTextHeader(object: Omit<EncryptedQrTextObject, "ciphertext" | "checksum">): Uint8Array;
export function encodeEncryptedQrText(object: EncryptedQrTextObject): Uint8Array;
export function parseEncryptedQrText(bytes: Uint8Array): EncryptedQrTextObject;
```

Validate magic/version/suite/flags and all lengths before allocation. Authenticate exact version/suite/flags through AAD.

- [ ] **Step 4: Implement signed inner codec**

Export an encoder for the locked fields and a parser that takes the resolved known sender contact. Verify the Ed25519 signature over the exact unsigned bytes before returning stored payload bytes. Do not decompress or UTF-8 decode in the protocol parser.

- [ ] **Step 5: Run green protocol tests**

```bash
npx vitest run src/tests/unit/base37.test.ts src/tests/unit/ppxq.test.ts src/tests/property/ppxq-roundtrip.property.test.ts src/tests/property/truncation.property.test.ts src/tests/property/mutation.property.test.ts src/tests/property/boundary.property.test.ts
```

Expected: all Task 1 tests pass; existing PPXT golden tests remain unchanged.

- [ ] **Step 6: Commit codecs**

```bash
git add src/protocol/base37.ts src/protocol/ppxq-inner.ts src/protocol/ppxq-outer.ts src/protocol/ppxq.ts src/protocol/types.ts src/tests/unit/base37.test.ts src/tests/unit/ppxq.test.ts src/tests/property/ppxq-roundtrip.property.test.ts src/tests/property/truncation.property.test.ts src/tests/property/mutation.property.test.ts src/tests/property/boundary.property.test.ts src/tests/helpers/canonical-protocol.ts fixtures/protocol/golden-v1-ppxq.json
git commit -m "feat: add compact encrypted QR message protocol"
```

### Task 3: Add adaptive PPXQ encryption/decryption worker jobs

**Files:**

- Create: `src/crypto/qr-text.ts`
- Modify: `src/crypto/text-compression.ts` if created by prerequisite plan
- Modify: `src/crypto/provider.ts`
- Modify: `src/crypto/default-provider.ts`
- Modify: `src/workers/crypto-runner.ts`
- Modify: `src/workers/crypto-worker.ts`
- Modify: `src/workers/crypto-client.ts`
- Create: `src/tests/unit/qr-text-crypto.test.ts`
- Modify: `src/tests/unit/crypto-runner.test.ts`
- Modify: `src/tests/property/crypto-interop.property.test.ts`
- Modify: `src/tests/unit/secret-failure-cleanup.test.ts`

- [ ] **Step 1: Write failing crypto tests**

Cover raw short UTF-8, beneficial gzip, gzip larger than raw, Unicode, maximum original length, wrong recipient, missing sender contact, wrong matching fingerprint, signature mutation after recomputed public checksum, GCM mutation, corrupt gzip, decompression bomb, worker cancellation, and zeroization on every failure.

- [ ] **Step 2: Reuse bounded gzip helper without making it mandatory**

If `supportsGzipStreams()` is false or gzip throws during encryption, retain raw UTF-8. If flag 1 arrives without decompression support, fail closed with the existing safe unsupported-compression guidance. Use gzip only when `compressed.byteLength < raw.byteLength`.

- [ ] **Step 3: Implement compact encryption**

Use existing `encapsulateHybrid`, AES-256-GCM, checksum, and signing primitives. Sign stored raw/gzip bytes with the locked inner metadata, encrypt the signed inner with the 853-byte header as AAD, and wipe raw, compressed, inner, shared secrets, AES key, and signing capability in `finally` after ownership transfer.

- [ ] **Step 4: Implement compact decryption in fail-closed order**

1. Canonically parse outer.
2. Hybrid-decapsulate for active identity.
3. AES-GCM authenticate/decrypt.
4. Parse bounded fixed inner lengths.
5. Find exact sender fingerprint in `knownSenders`.
6. Verify Ed25519 and recipient identity.
7. Verify original length bound.
8. Decompress only after signature verification when flag 1.
9. Require exact decoded length and canonical fatal UTF-8.
10. Return the real saved `PublicContact` as `senderContact`.

- [ ] **Step 5: Add worker contracts**

Expose cancellable `startEncryptQrTextJob()` and `startDecryptQrTextJob()`. Transfer payload buffers where safe. Pass known public contacts only; never move vault/passphrase state outside the established worker contract.

- [ ] **Step 6: Run focused tests**

```bash
npx vitest run src/tests/unit/qr-text-crypto.test.ts src/tests/unit/crypto-runner.test.ts src/tests/property/crypto-interop.property.test.ts src/tests/unit/secret-failure-cleanup.test.ts
```

Expected: PPXQ and PPXT both pass; no existing provider contract changes unexpectedly.

- [ ] **Step 7: Commit crypto integration**

```bash
git add src/crypto/qr-text.ts src/crypto/text-compression.ts src/crypto/provider.ts src/crypto/default-provider.ts src/workers/crypto-runner.ts src/workers/crypto-worker.ts src/workers/crypto-client.ts src/tests/unit/qr-text-crypto.test.ts src/tests/unit/crypto-runner.test.ts src/tests/property/crypto-interop.property.test.ts src/tests/unit/secret-failure-cleanup.test.ts
git commit -m "feat: encrypt compact QR messages in worker"
```

### Task 4: Implement exact QR transports, capacity checks, and PNG downloads

**Files:**

- Create: `src/components/qr/message.ts`
- Create: `src/components/navigation/qr-icon.tsx`
- Modify: `src/components/qr/generate.ts`
- Modify: `src/components/media/blob-url.ts`
- Create: `src/tests/unit/message-qr.test.ts`
- Modify: `src/tests/unit/qr-image-bounds.test.ts`
- Modify: `src/tests/property/qr-degradation.property.test.ts`

- [ ] **Step 1: Write failing transport/capacity tests**

Cover compact text `PPX1:MESSAGE:<BASE37>`, normal-camera link `<app-base>#/decrypt/qr/<BASE37>`, exact canonical parse, non-HTTPS rejection for link generation, malformed foreign text rejection, and cross-host scanned-link extraction without navigation.

- [ ] **Step 2: Build explicit QR segments**

Expose:

```ts
export type MessageQrTransport = "app" | "link";
export type MessageQrCapacity =
  | { fits: true; version: number; text: string; segments: QRCode.QRCodeSegment[] }
  | { fits: false; encodedBytesOver: number };

export function prepareMessageQr(bytes: Uint8Array, transport: MessageQrTransport, appBase: string): MessageQrCapacity;
export function generateMessageQrPng(capacity: Extract<MessageQrCapacity, { fits: true }>): Promise<Blob>;
```

For app mode, use one alphanumeric segment. For link mode, use one byte-mode HTTPS prefix segment plus one base37 alphanumeric segment. Call the actual `qrcode` encoder with `{ errorCorrectionLevel: "H" }`; allow it to choose the smallest version. Reject overflow beyond version 40.

- [ ] **Step 3: Lock render quality**

Generate a 2,048 by 2,048 PNG, four-module quiet zone, pure black modules, pure white background, no logo, no transparency, no styling damage. No caller can override H.

- [ ] **Step 4: Add download helper and QR icon**

Use safe Blob/object-URL cleanup. Filenames are `encrypted-message-app-YYYYMMDD-HHmmss.png` and `encrypted-message-link-YYYYMMDD-HHmmss.png`. Icon is decorative inside a fully translated text button.

- [ ] **Step 5: Test exact boundaries**

Generate the largest fitting object and one-byte-over object for each transport. Decode generated PNGs through ZXing and require exact text equality. Assert reported version is 1–40 and error correction is H.

- [ ] **Step 6: Run and commit**

```bash
npx vitest run src/tests/unit/message-qr.test.ts src/tests/unit/qr-image-bounds.test.ts src/tests/property/qr-degradation.property.test.ts
git add src/components/qr/message.ts src/components/navigation/qr-icon.tsx src/components/qr/generate.ts src/components/media/blob-url.ts src/tests/unit/message-qr.test.ts src/tests/unit/qr-image-bounds.test.ts src/tests/property/qr-degradation.property.test.ts
git commit -m "feat: generate high-recovery message QR downloads"
```

### Task 5: Persist QR UX settings locally

**Files:**

- Modify: `src/storage/db.ts`
- Modify: `src/storage/settings.ts`
- Modify: `src/storage/session.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/flows/settings/index.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/styles.css`
- Modify: `src/tests/unit/storage.test.ts`
- Modify: `src/tests/unit/app-shell.test.tsx`
- Modify: `src/tests/e2e/appearance-settings.spec.ts`
- Modify: `src/tests/accessibility/i18n.test.ts`

- [ ] **Step 1: Write failing normalization/persistence tests**

Lock defaults and malformed-value fallbacks:

```ts
qrExportMode: "both";
qrImportControls: "both";
qrAutoDecrypt: true;
```

Test IndexedDB reload, session-only fallback, old settings records with missing fields, invalid strings, and Erase Local Data reset.

- [ ] **Step 2: Extend settings types without a DB migration**

Add optional stored fields and required normalized `AppSettings` fields:

```ts
export type QrExportMode = "app" | "link" | "both";
export type QrImportControls = "camera" | "image" | "both";
```

Use the existing `settings/preferences` record. Do not create a parallel `localStorage` source of truth.

- [ ] **Step 3: Wire App state and persistence atomically**

Include new values in initial load, degraded storage fallback, session writes, IndexedDB writes, erase reset, `SettingsFlow`, `EncryptTextFlow`, and `DecryptFlow`. Update every object literal that constructs `AppSettings` so TypeScript detects omissions.

- [ ] **Step 4: Add accessible settings group**

Add a “Message QR” group with:

- Export: In-app QR / Phone camera link / Show both.
- Import controls: Camera / Screenshot or image / Show both.
- Auto-decrypt valid message QRs toggle, default on, with copy explaining all work remains local and authenticated.

Add complete English/German strings and keep native labels/selects/toggle semantics.

- [ ] **Step 5: Run and commit**

```bash
npx vitest run src/tests/unit/storage.test.ts src/tests/unit/app-shell.test.tsx src/tests/accessibility/i18n.test.ts
npx playwright test src/tests/e2e/appearance-settings.spec.ts
git add src/storage/db.ts src/storage/settings.ts src/storage/session.ts src/app/App.tsx src/flows/settings/index.tsx src/i18n/index.ts src/styles.css src/tests/unit/storage.test.ts src/tests/unit/app-shell.test.tsx src/tests/e2e/appearance-settings.spec.ts src/tests/accessibility/i18n.test.ts
git commit -m "feat: save message QR preferences locally"
```

### Task 6: Add QR downloads to encrypted text output

**Files:**

- Modify: `src/flows/encrypt/text.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/styles.css`
- Modify: `src/tests/unit/ui-change-request.test.tsx`
- Modify: `src/tests/e2e/encrypt-text.spec.ts`
- Modify: `src/tests/e2e/en-de.spec.ts`
- Modify: `src/tests/accessibility/flows.spec.ts`

- [ ] **Step 1: Write failing UI tests**

Assert one logical message ID/timestamps feed PPXT and PPXQ; PPXT copy/save remains unchanged; enabled fitting transport buttons appear with QR icon and text; no QR preview image appears; disabled settings hide their actions; oversize transports hide buttons and show encoded-byte overage; ordinary encryption still succeeds if compact QR generation fails.

- [ ] **Step 2: Run standard and compact jobs from shared metadata**

Create `messageId`, `sentAt`, and `createdAt` once. Start PPXT and PPXQ jobs with separate signing-capability copies, cancel both together, and retain PPXT success even when PPXQ is unavailable. Store only the current result; clear it when sender, recipient, or plaintext changes.

- [ ] **Step 3: Evaluate both actual transports after PPXQ completion**

Use `prepareMessageQr()` with the current app base. Never estimate from plaintext length. For each selected setting, show a download button only when the actual encoder fits. If it does not fit, show “Encrypted QR is N encoded bytes too large; shorten the message.” Do not claim exact characters because compression is nonlinear.

- [ ] **Step 4: Add recipient-contact guidance**

Near QR actions, state that the recipient must already have the sender's public contact to verify/decrypt this compact QR. Keep this calm, not a destructive red warning.

- [ ] **Step 5: Run and commit**

```bash
npx vitest run src/tests/unit/ui-change-request.test.tsx
npx playwright test src/tests/e2e/encrypt-text.spec.ts src/tests/e2e/en-de.spec.ts src/tests/accessibility/flows.spec.ts
git add src/flows/encrypt/text.tsx src/app/App.tsx src/i18n/index.ts src/styles.css src/tests/unit/ui-change-request.test.tsx src/tests/e2e/encrypt-text.spec.ts src/tests/e2e/en-de.spec.ts src/tests/accessibility/flows.spec.ts
git commit -m "feat: download encrypted messages as QR images"
```

### Task 7: Add fast camera, screenshot, and universal-link decryption

**Files:**

- Create: `src/components/qr/image-recovery.ts`
- Modify: `src/components/qr/import.tsx`
- Modify: `src/components/qr/scan.ts`
- Modify: `src/components/qr/zxing.ts`
- Modify: `src/flows/decrypt/classify.ts`
- Modify: `src/flows/decrypt/index.tsx`
- Modify: `src/workers/scan-runner.ts`
- Modify: `src/workers/scan-worker.ts`
- Modify: `src/workers/scan-client.ts`
- Modify: `src/app/routes.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/styles.css`
- Create: `src/tests/unit/message-qr-link.test.ts`
- Modify: `src/tests/unit/scan-worker.test.ts`
- Modify: `src/tests/accessibility/qr-import-camera.test.tsx`
- Modify: `src/tests/e2e/qr-flow.spec.ts`
- Modify: `src/tests/e2e/decrypt-smart-input.spec.ts`

- [ ] **Step 1: Write failing scanner/link tests**

Cover compact payload, generated HTTPS link, unsupported foreign QR, camera result, PNG/JPEG/WebP screenshot upload, auto-decrypt on/off, wrong identity, unknown sender contact, locked identity with pending link, payload scrub, duplicate hashchange prevention, and camera/image control visibility settings.

- [ ] **Step 2: Extend classification safely**

Add `encrypted-message` to `ClassifiedQrPayload`. Parse both `PPX1:MESSAGE:<BASE37>` and exact `https://.../#/decrypt/qr/<BASE37>` shapes. In-app scan extracts payload but never navigates to scanned URLs. Enforce PPXQ maximum size before base37 allocation.

- [ ] **Step 3: Add two explicit decrypt controls**

Default UI shows “Scan QR” and “Choose screenshot or image” as separate translated controls. Respect `qrImportControls`. Retain image upload when camera is insecure, denied, absent, or busy. Stop camera tracks immediately after a result, cancel, route change, identity lock, or unmount.

- [ ] **Step 4: Implement bounded screenshot retries**

Keep existing file byte/dimension/pixel limits. Try original first. On failure, decode once and retry:

1. centered square crops at 90%, 75%, 60%, 45%, 33%, and 25% of the short edge;
2. upscale each crop so one source pixel maps to an integer 2–6 pixel block, capped at 2,048 square;
3. original color, grayscale, autocontrast, and two adaptive threshold variants;
4. stop immediately on first exact valid classification.

Release all canvases, bitmap/image objects, object URLs, and temporary pixel buffers. Do not exceed a fixed 32 decode attempts or 2 seconds on reference desktop CI.

- [ ] **Step 5: Auto-decrypt valid results**

When enabled, parse PPXQ and start worker decryption immediately. Show progress/cancel and normal authenticated sender result. When disabled, keep encrypted payload transient and require the existing Decrypt button. Map unknown sender to explicit “Import this sender's public contact first”; do not reveal plaintext.

- [ ] **Step 6: Capture and scrub normal-camera links**

Make `routeFromHash()` recognize `#/decrypt/qr/<BASE37>`. At app startup/hashchange, copy only the bounded payload into an in-memory pending state and immediately call `history.replaceState(null, "", "#/decrypt")`. Never store it in IndexedDB, session storage, logs, diagnostics, or service-worker cache keys. If identity is locked, retain only until unlock/erase/navigation cancellation; then decrypt according to `qrAutoDecrypt`.

- [ ] **Step 7: Add degradation fixtures**

Generate deterministic 1,080 by 1,920 portrait fixtures with centered message QRs, JPEG quality loss, resampling blur, and contrast loss. Acceptance:

- QR versions 1–15 decode at 20% screenshot width and JPEG quality 0.35.
- QR versions 16–30 decode at 30% width and quality 0.45.
- QR versions 31–40 decode at 40% width and quality 0.55.
- A deliberately sub-pixel/destroyed fixture fails honestly within bounds.

- [ ] **Step 8: Run and commit**

```bash
npx vitest run src/tests/unit/message-qr-link.test.ts src/tests/unit/scan-worker.test.ts src/tests/property/qr-degradation.property.test.ts src/tests/accessibility/qr-import-camera.test.tsx
npx playwright test src/tests/e2e/qr-flow.spec.ts src/tests/e2e/decrypt-smart-input.spec.ts
git add src/components/qr/image-recovery.ts src/components/qr/import.tsx src/components/qr/scan.ts src/components/qr/zxing.ts src/flows/decrypt/classify.ts src/flows/decrypt/index.tsx src/workers/scan-runner.ts src/workers/scan-worker.ts src/workers/scan-client.ts src/app/routes.ts src/app/App.tsx src/i18n/index.ts src/styles.css src/tests/unit/message-qr-link.test.ts src/tests/unit/scan-worker.test.ts src/tests/property/qr-degradation.property.test.ts src/tests/accessibility/qr-import-camera.test.tsx src/tests/e2e/qr-flow.spec.ts src/tests/e2e/decrypt-smart-input.spec.ts
git commit -m "feat: scan and decrypt message QR codes"
```

### Task 8: Document protocol, security, UX, and device evidence

**Files:**

- Create: `docs/protocol-qr-message-v1.md`
- Create: `docs/qr-message-device-matrix.md`
- Modify: `docs/protocol-v1.md`
- Modify: `docs/security-architecture.md`
- Modify: `docs/threat-model.md`
- Modify: `docs/product-spec.md`
- Modify: `docs/ux-content-spec.md`
- Modify: `docs/accessibility-i18n.md`
- Modify: `docs/testing-and-release.md`
- Modify: `docs/user-guide.en.md`
- Modify: `docs/user-guide.de.md`
- Modify: `docs/implementation-status.md`
- Modify: `README.md`

- [ ] **Step 1: Specify exact PPXQ bytes**

Document every offset, canonical pair, signature domain, AAD, checksum, compression rule, parser order, known-sender requirement, base37 algorithm, in-app prefix, mixed-segment link, capacity limits, and examples generated from committed goldens.

- [ ] **Step 2: Document honest limits and security**

State that current PPXT cannot fit level H, four A4 pages are not guaranteed, capacity depends on compression, normal-camera links may need the app/network cache, fragments are scrubbed, sender contact must preexist, compression exposes coarse length, and no server stores messages.

- [ ] **Step 3: Document settings and user flows in EN/DE**

Describe both download modes, camera/image controls, immediate decrypt default, how to disable it, oversize feedback, unknown-sender recovery, offline behavior, and browser-local settings reset.

- [ ] **Step 4: Build device evidence matrix**

Rows:

- Android 11 phone, current supported Chrome.
- iPhone X, latest iOS/Safari available to that hardware.
- Current Xiaomi flagship/recent Chrome.
- Desktop Chromium.
- Desktop Firefox.
- WebKit Playwright profile.

Columns: app QR image, screenshot import, in-app camera, normal-camera link, locked-to-unlocked link, low-quality fixture, settings reload, offline cached app. Mark physical rows `not run - hardware unavailable` when unavailable; never relabel emulation as physical proof.

- [ ] **Step 5: Run docs checks and commit**

```bash
npm run docs:check
npx prettier --check README.md docs/protocol-qr-message-v1.md docs/qr-message-device-matrix.md docs/protocol-v1.md docs/security-architecture.md docs/threat-model.md docs/product-spec.md docs/ux-content-spec.md docs/accessibility-i18n.md docs/testing-and-release.md docs/user-guide.en.md docs/user-guide.de.md docs/implementation-status.md
git add docs/protocol-qr-message-v1.md docs/qr-message-device-matrix.md docs/protocol-v1.md docs/security-architecture.md docs/threat-model.md docs/product-spec.md docs/ux-content-spec.md docs/accessibility-i18n.md docs/testing-and-release.md docs/user-guide.en.md docs/user-guide.de.md docs/implementation-status.md README.md
git commit -m "docs: specify encrypted message QR workflow"
```

### Task 9: Cross-browser, offline, accessibility, and full verification

**Files:**

- Modify only files required by evidence-backed failures.
- Modify: `src/tests/release/device-matrix.spec.ts`
- Modify: `src/tests/release/offline.spec.ts`
- Modify: `src/tests/release/network-denial.spec.ts`
- Modify: `src/tests/accessibility/interaction-matrix.spec.ts`

- [ ] **Step 1: Add release tests**

Prove QR encode/decode without network after app cache, image fallback without camera, universal-link fragment absent from request logs, no message persistence after reload, settings persistence after reload, keyboard-only controls, live progress/errors, focus recovery, and no serious axe violations.

- [ ] **Step 2: Run focused cross-browser profiles**

Use repository Playwright projects when available. At minimum run Chromium and WebKit mobile profiles plus desktop Chromium. If Firefox is configured, run it too.

```bash
npx playwright test src/tests/e2e/qr-flow.spec.ts src/tests/e2e/encrypt-text.spec.ts src/tests/e2e/decrypt-smart-input.spec.ts src/tests/release/device-matrix.spec.ts src/tests/release/offline.spec.ts src/tests/release/network-denial.spec.ts src/tests/accessibility/interaction-matrix.spec.ts
```

- [ ] **Step 3: Run full deterministic verification**

```bash
npm run typecheck
npm run lint
npm run format:check
npm run docs:check
npm run test:ppx-golden
npm run test:parser-property
npm run test:mutations
npm run test:truncations
npm run test:boundaries
npm run test:qr-degradation
npm run test:i18n
npm run build
npm run verify:quality
git diff --check
```

Every command must exit zero. Fix root causes; do not weaken assertions, bounds, error correction, crypto, or device gates.

- [ ] **Step 4: Run release gate without bypassing it**

```bash
npm run verify
```

If it stops only at the repository's independent-review evidence gate, record the exact blocker. Do not fabricate or weaken independent review evidence.

- [ ] **Step 5: Perform local runtime QA**

Start the existing HTTPS/Tailscale dev flow through `npm run dev`. Verify current listener and URL, then exercise on available local browsers:

1. settings default and reload;
2. short uncompressed app QR;
3. compressible QR;
4. link QR and fragment scrub;
5. screenshot import and immediate decrypt;
6. camera denial with image fallback;
7. oversize output;
8. unknown sender failure;
9. offline cached import.

Capture no plaintext or private keys in logs/screenshots. Stop only the server started for this task unless the repository's established workflow requires it to remain available for user QA.

- [ ] **Step 6: Review exact change scope**

```bash
git status --short
git diff --stat
git diff --check
git log --oneline --decorate -12
```

Confirm no unrelated files, secrets, caches, generated reports, or user artifacts were staged.

- [ ] **Step 7: Obtain independent review where allowed**

Request one protocol/security review and one UX/accessibility review against the design and acceptance list. Address evidence-backed findings, rerun affected focused tests, then rerun `npm run verify:quality`. Do not call an AI review “independent security review” for release-gate purposes.

## Completion contract

Implementation is complete only when:

- PPXT remains compatible and PPXQ goldens/properties pass.
- Compact encryption retains full hybrid/authentication primitives.
- Compression is adaptive, bounded, and optional on unsupported devices.
- Both enabled QR transport modes use error correction H and smallest fitting version.
- No oversize download action exists.
- Camera/image/link paths decrypt locally and immediately by default.
- Link ciphertext is transient and scrubbed from the URL.
- Unknown sender/wrong identity/tampering/decompression failures reveal no plaintext.
- Settings persist locally, migrate old records, and erase correctly.
- EN/DE, accessibility, offline, and automated browser gates pass.
- Physical-device rows are honestly marked and completed before release when hardware exists.
- `npm run verify:quality` passes. Any independent-review release gate remains explicit rather than bypassed.

## Overnight persistence rules

- Continue from one task to the next without asking for permission.
- When a test fails, use `superpowers:systematic-debugging`; find the first real cause and repair it.
- Try safe workarounds for unavailable ports, stale dev servers, browser cache, flaky camera mocks, and missing optional physical hardware.
- Retry flaky verification only after gathering evidence; do not mask deterministic failures with retries.
- Do not reduce security, QR H correction, screenshot fixtures, bounds, or test assertions to obtain green output.
- Do not publish, push, tag, or alter independent-review evidence.
- If context compacts, reopen this plan, inspect completed commits/tests, and resume at the first unchecked step.
- End with concise status: completed tasks, tests run and results, remaining external blockers, physical-device evidence state, and exact files/commits.
