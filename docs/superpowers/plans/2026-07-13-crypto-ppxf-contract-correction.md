# CryptoProvider and PPXF Contract Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the approved CryptoProvider and PPXF corrections fully functional, expose local encrypted-file flows, pass every Task 0-17 gate, then prepare and publish the static GitHub Pages beta.

**Architecture:** Encryption requests carry a narrow, request-owned signing capability. The crypto provider owns hybrid encapsulation. PPXF uses a fixed canonical header, ordered independently authenticated records, an AEAD-encrypted terminal manifest, and a trailing transfer checksum. File work is isolated behind codec/crypto/worker/UI layers with no output before complete validation.

**Tech Stack:** TypeScript 7, Preact 10, Vite 8, Noble ML-KEM/X25519/Ed25519/SHA-512, WebCrypto AES-256-GCM, Vitest/fast-check, Playwright/axe, GitHub Actions/Pages.

---

## File map

- `src/protocol/types.ts`: corrected public types and request-scoped signing capability.
- `src/protocol/ppxf-header.ts`: exact 884-byte header codec and header hash.
- `src/protocol/ppxf-manifest.ts`: canonical manifest commitment/signature codec.
- `src/protocol/ppxf.ts`: record and full-object serialization, strict parsing, checksum.
- `src/crypto/hybrid.ts`: provider-owned encapsulation and recipient decapsulation.
- `src/crypto/file.ts`: chunk/manifest AEAD, digest/signature validation, no-output-before-validation.
- `src/crypto/provider.ts`, `src/crypto/default-provider.ts`: interface and concrete provider boundary.
- `src/workers/file-worker.ts`, `src/workers/file-runner.ts`: typed progress/cancel execution and browser fallback.
- `src/flows/encrypt/file.tsx`, `src/flows/decrypt/file.tsx`: local EN/DE file UX.
- `src/flows/encrypt/text.tsx`, `src/flows/decrypt/index.tsx`, `src/app/App.tsx`: corrected provider use and flow composition.
- `docs/*.md`, `scripts/check-*.ts`: normative correction and removal of deliberate blocker gates.
- `src/tests/**`: exact vectors, boundaries, mutations, cancellation, UI, a11y, and release coverage.

### Task 1: Correct capability and provider contracts

**Files:**

- Modify: `src/protocol/types.ts`
- Modify: `src/crypto/provider.ts`
- Create: `src/crypto/default-provider.ts`
- Modify: `src/crypto/text.ts`
- Modify: `src/crypto/hybrid.ts`
- Modify: `src/crypto/contracts.ts`
- Test: `src/tests/unit/provider-contract.test.ts`
- Test: `src/tests/unit/hybrid.test.ts`

- [ ] **Step 1: Write failing provider tests**

```ts
test("encryptText signs using request-owned capability", async () => {
  const input = textInput({ senderSigningCapability: signingCapability(alice) });
  const encrypted = await provider.encryptText(input);
  expect((await provider.decryptText({ object: encrypted, activeIdentity: bob })).signatureValid).toBe(true);
});

test("provider creates fresh complete hybrid encapsulation", () => {
  const first = provider.createHybridEncapsulation(recipientPublicParts(bob));
  const second = provider.createHybridEncapsulation(recipientPublicParts(bob));
  expect(first.aes256Key).toHaveLength(32);
  expect(first.mlKemCiphertext).not.toEqual(second.mlKemCiphertext);
  expect(first.ephemeralX25519PublicKey).not.toEqual(second.ephemeralX25519PublicKey);
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/tests/unit/provider-contract.test.ts src/tests/unit/hybrid.test.ts`

Expected: compile/test failure because `senderSigningCapability` and provider-owned encapsulation do not exist.

- [ ] **Step 3: Implement corrected types and provider**

```ts
export interface SenderSigningCapability {
  fingerprint: Uint8Array;
  signingPublicKey: Uint8Array;
  signingSecretKey: Uint8Array;
}

export interface EncryptTextInput {
  sender: PublicContact;
  senderSigningCapability: SenderSigningCapability;
  recipient: PublicContact;
  plaintext: string;
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
}
```

Change `encryptText` to one argument, validate capability/contact equality, sign with the request seed, and keep hybrid/key zeroization in `finally`. Implement `DefaultCryptoProvider` by delegating every mandatory interface method to protocol/crypto modules; no UI/storage concrete primitive calls.

- [ ] **Step 4: Verify GREEN and contract gate**

Run: `npx vitest run src/tests/unit/provider-contract.test.ts src/tests/unit/hybrid.test.ts src/tests/unit/ppxt.test.ts && npm run test:provider-contract`

Expected: all tests pass and `CryptoProvider contract OK` prints.

### Task 2: Implement strict PPXF header, manifest, records, and checksum

**Files:**

- Create: `src/protocol/ppxf-header.ts`
- Create: `src/protocol/ppxf-manifest.ts`
- Create: `src/protocol/ppxf.ts`
- Modify: `src/protocol/types.ts`
- Modify: `src/protocol/bytes.ts`
- Test: `src/tests/unit/ppxf.test.ts`
- Test: `src/tests/unit/file-order.test.ts`
- Test: `src/tests/unit/file-manifest.test.ts`
- Test: `src/tests/property/file-chunks.property.test.ts`
- Test: `src/tests/property/file-boundary.property.test.ts`

- [ ] **Step 1: Write failing exact-layout tests**

```ts
test("PPXF header is exactly 884 bytes", () => {
  expect(encodeFileHeader(validHeader()).byteLength).toBe(884);
});

test("PPXF checksum covers header, records, and encrypted manifest", () => {
  const bytes = encodeEncryptedFileObject(validEncryptedFileObject());
  expect(parseEncryptedFileObject(bytes)).toEqual(validEncryptedFileObject());
  bytes[900] ^= 1;
  expect(() => parseEncryptedFileObject(bytes)).toThrowError("checksum-mismatch");
});

test("PPXF rejects reordered data records", () => {
  expect(() => encodeEncryptedFileObject(objectWithOrder([1, 0]))).toThrowError("impossible-length");
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:chunks; npm run test:order; npm run test:manifest; npm run test:file-limits`

Expected: failure because named test files/codecs are absent.

- [ ] **Step 3: Implement canonical codecs**

Use strict big-endian codecs. Add `readUint16BE`/`writeUint16BE`. Enforce header constants, file/chunk limits, contiguous indexes, exact ciphertext lengths, terminal index `0xffffffff`, no trailing records, 18,000-byte manifest cap, and checksum-before-return.

```ts
export const PPXF_HEADER_BYTES = 884;
export const PPXF_CHUNK_BYTES = 1_048_576;
export const PPXF_FILE_MAX_BYTES = 104_857_600n;
export const PPXF_MANIFEST_MAX_BYTES = 18_000;
```

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:chunks && npm run test:order && npm run test:manifest && npm run test:file-limits`

Expected: all named suites pass.

### Task 3: Implement PPXF encryption and fail-closed decryption

**Files:**

- Create: `src/crypto/file.ts`
- Modify: `src/crypto/provider.ts`
- Modify: `src/crypto/default-provider.ts`
- Test: `src/tests/unit/file-crypto.test.ts`
- Test: `src/tests/property/ppxf-roundtrip.property.test.ts`
- Test: `fixtures/protocol/ppxf-v1.json`

- [ ] **Step 1: Write failing crypto tests**

```ts
test.each([0, 1, 1_048_575, 1_048_576, 1_048_577])(
  "round-trips %i plaintext bytes",
  async (length) => {
    const input = fileInput(new Uint8Array(length));
    const encrypted = await encryptFile(input);
    const decrypted = await decryptFile({ object: encrypted, activeIdentity: bob });
    expect(new Uint8Array(await decrypted.blob.arrayBuffer())).toEqual(new Uint8Array(length));
  },
);

test("releases no output when manifest signature is invalid", async () => {
  const encrypted = await encryptFile(fileInput(Uint8Array.of(1, 2, 3)));
  encrypted.manifest.ciphertext[0] ^= 1;
  await expect(decryptFile({ object: encrypted, activeIdentity: bob })).rejects.toThrow("wrong-identity-or-corruption");
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/tests/unit/file-crypto.test.ts src/tests/property/ppxf-roundtrip.property.test.ts`

Expected: failure because `src/crypto/file.ts` is absent.

- [ ] **Step 3: Implement chunk/manifest cryptography**

Use `noncePrefix || uint32be(index)` and exact AAD from the approved design. Hash input incrementally with `sha512.create()`. Sign manifest commitment with Ed25519. During decryption, parse/checksum first, decrypt into private Blob parts, validate manifest metadata/digest/signature, then create `DecryptedFileOutput`. Collapse all crypto/auth failures to `wrong-identity-or-corruption`.

- [ ] **Step 4: Verify GREEN and golden gate**

Run: `npx vitest run src/tests/unit/file-crypto.test.ts src/tests/property/ppxf-roundtrip.property.test.ts && npm run test:ppx-golden`

Expected: all PPX families and PPXF contract/golden checks pass.

### Task 4: Implement typed worker progress, cancellation, and memory policy

**Files:**

- Create: `src/workers/file-runner.ts`
- Create: `src/workers/file-worker.ts`
- Modify: `src/crypto/contracts.ts`
- Test: `src/tests/unit/file-runner.test.ts`
- Test: `src/tests/unit/memory-budget.test.ts`
- Test: `src/tests/e2e/file-cancel.spec.ts`

- [ ] **Step 1: Write failing cancel/memory tests**

```ts
test("cancel emits cancelled and never completed", async () => {
  const events = await runAndCancel(fileRequest(2_097_152));
  expect(events.some((event) => event.kind === "cancelled")).toBe(true);
  expect(events.some((event) => event.kind === "completed")).toBe(false);
});

test("runner retains at most one plaintext chunk", async () => {
  const peak = await measurePeakPlaintextRetention(3 * 1_048_576);
  expect(peak).toBeLessThanOrEqual(1_048_576);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:cancel; npm run test:memory`

Expected: failure because worker/runner and tests are absent.

- [ ] **Step 3: Implement typed runner and worker**

Dispatch only existing `PPXWorkerRequest` discriminants. Track cancelled request IDs, check cancellation before/after every async chunk operation, emit exact progress stages and byte counts, wipe request-owned secret copies, discard partial parts, and emit only `completed`, safe `error`, or `cancelled` terminal events.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:cancel && npm run test:memory && npx vitest run src/tests/unit/worker-contracts.test.ts src/tests/unit/file-runner.test.ts`

Expected: all worker contract/cancel/memory tests pass.

### Task 5: Implement EN/DE file encrypt/decrypt UI

**Files:**

- Create: `src/flows/encrypt/file.tsx`
- Create: `src/flows/decrypt/file.tsx`
- Modify: `src/flows/encrypt/text.tsx`
- Modify: `src/flows/decrypt/index.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/styles.css`
- Test: `src/tests/e2e/encrypt-file.spec.ts`
- Test: `src/tests/e2e/decrypt-file.spec.ts`
- Test: `src/tests/e2e/file-cancel.spec.ts`
- Test: `src/tests/e2e/en-de.spec.ts`
- Test: `src/tests/accessibility/flows.spec.ts`

- [ ] **Step 1: Write failing Playwright flows**

```ts
test("encrypts and decrypts one file locally", async ({ page }) => {
  await unlockAliceAndImportBob(page);
  await page.getByLabel("File to encrypt").setInputFiles({ name: "hello.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await page.getByRole("button", { name: "Encrypt file locally" }).click();
  const download = await page.waitForEvent("download");
  expect(download.suggestedFilename()).toBe("hello.txt.ppxfile");
});

test("German file controls remain reachable at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/encrypt");
  await page.getByLabel("Language").selectOption("de");
  await expect(page.getByLabel("Zu verschlüsselnde Datei")).toBeVisible();
});
```

- [ ] **Step 2: Verify RED**

Run: `npx playwright test src/tests/e2e/encrypt-file.spec.ts src/tests/e2e/decrypt-file.spec.ts --project=desktop-chromium`

Expected: controls absent.

- [ ] **Step 3: Implement file flows**

Add one local file picker, normalized filename/caption, MIME hint, 100 MiB preflight, recipient reuse, progress/cancel, `.ppxfile` download, encrypted-file import, safe unknown-sender warning, local image/audio/video preview, download-only fallback, and Blob URL cleanup. Replace `fileUnavailable` copy. Keep all strings keyed and semantically aligned in EN/DE.

- [ ] **Step 4: Verify GREEN and a11y**

Run: `npm run test:en-de && npm run test:accessibility && npx playwright test src/tests/e2e/encrypt-file.spec.ts src/tests/e2e/decrypt-file.spec.ts`

Expected: all five browser/device projects pass.

### Task 6: Correct normative docs and release gates

**Files:**

- Modify: `Chat_NoControl_full_plan.md`
- Modify: `docs/security-architecture.md`
- Modify: `docs/protocol-v1.md`
- Modify: `docs/implementation-plan.md`
- Modify: `docs/testing-and-release.md`
- Modify: `docs/user-guide.en.md`
- Modify: `docs/user-guide.de.md`
- Modify: `docs/implementation-status.md`
- Modify: `scripts/check-crypto-provider-contract.ts`
- Modify: `scripts/check-ppxf-contract.ts`
- Modify: `package.json`
- Test: `scripts/check-doc-terminology.ts`

- [ ] **Step 1: Turn blocker scripts into conformance checks**

Require corrected exact fields/signatures, encrypted manifest record, trailing checksum, and canonical placement. Success messages are `CryptoProvider contract OK` and `PPXF contract OK`.

- [ ] **Step 2: Update every normative copy together**

Apply the approved design identically to master, protocol, security, implementation, testing, and EN/DE user docs. Remove stale “docs-only”, “implementation not started”, and PPXF-unavailable claims. Preserve “public beta / unaudited” and prohibited security claims.

- [ ] **Step 3: Verify docs/contracts**

Run: `npm run docs:check && npm run test:provider-contract && npm run test:ppx-golden`

Expected: zero exit status and both contract OK messages.

### Task 7: Full acceptance, publish, tag, and Pages readiness

**Files:**

- Modify as failures require: `.github/workflows/ci.yml`, `.github/workflows/pages.yml`, `.github/workflows/release.yml`, `README.md`, `scripts/verify-release.ts`
- Evidence: `output/playwright/final-visual/*`

- [ ] **Step 1: Run fresh canonical verification**

Run: `npm run verify`

Expected: every ordered command exits zero, including file chunk/order/manifest/limit/cancel/memory, 200+ Playwright flows, release/SBOM/reproducibility/dependency review, and build.

- [ ] **Step 2: Run live visual/network/console QA**

Start: `npm run dev -- --host 127.0.0.1`

Use Playwright CLI for EN/DE desktop/mobile encrypt/decrypt/file/recovery screens. Save screenshots under `output/playwright/final-visual/`. Require zero console errors, zero failed requests, zero external requests, no horizontal overflow, usable keyboard/touch/focus/reduced-motion behavior, and clean axe results.

- [ ] **Step 3: Audit publish scope and secrets**

Run: `git status --porcelain=v1 -uall`, `git diff --check`, secret-pattern scans, and two read-only verification reviews when authorization/policy permits. Stage explicit intended project paths only; exclude caches, credentials, reports, and ignored visual artifacts.

- [ ] **Step 4: Commit and sign release tag**

Create a terse Conventional Commit for the verified initial main state. Create signed annotated tag `v0.1.0-beta.1`. Verify commit/tag signatures locally and rerun `npm run test:release` against the tagged HEAD.

- [ ] **Step 5: Protect and push main/tag**

Fetch remote main, confirm ancestry/no movement, push `HEAD:main`, then push `v0.1.0-beta.1`. Never force-push. Confirm remote branch/tag hashes match local hashes.

- [ ] **Step 6: Verify Pages readiness**

Confirm Pages workflow targets the static `dist` artifact with the repository base path, no secrets/backend, correct CSP, artifact upload/deploy permissions, and expected GitHub Pages URL derivation. Report any repository-setting click still required by GitHub.
