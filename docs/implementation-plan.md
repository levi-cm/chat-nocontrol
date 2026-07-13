# Chat NoControl v1 Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.
> **Authority:** Highest implementation planning authority for Chat NoControl v1. This plan is subordinate to `Chat_NoControl_full_plan.md`, `docs/protocol-v1.md`, `docs/security-architecture.md`, and the other normative topic docs.
> **Version:** 1.0-draft
> **Status:** Implementation substantially complete; verification and release blocked by independent review
> **Last verified:** 2026-07-13
> **Depends on:** [../Chat_NoControl_full_plan.md](../Chat_NoControl_full_plan.md), [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [product-spec.md](product-spec.md), [design-spec.md](design-spec.md), [ux-content-spec.md](ux-content-spec.md), [accessibility-i18n.md](accessibility-i18n.md), [testing-and-release.md](testing-and-release.md), [github-pages-deployment.md](github-pages-deployment.md), [implementation-substitutions.md](implementation-substitutions.md), [references.md](references.md), [user-guide.en.md](user-guide.en.md), [user-guide.de.md](user-guide.de.md), [chat-control-explainer.en.md](chat-control-explainer.en.md), [chat-control-explainer.de.md](chat-control-explainer.de.md)
> **Supersedes:** The original WebLibre plan is historical only. This implementation plan is the working v1 execution and verification guide.

# 0. Goal

Build Chat NoControl v1 as a static, backend-free, browser-first PWA that implements the normative PPX protocol family, the local identity and contact model, encrypted text and file flows, offline caching of versioned shell assets only, and EN/DE accessibility-safe user flows.

This plan records the complete Tasks 0-17 execution contract. A task is not
release-complete merely because code exists; its named automated and manual
gates must pass with current evidence.

Important gate:

- The approved Apple-like direction is recorded in `docs/apple-visual-spec.md`.
- Tasks 13-16 must preserve that visual direction together with semantic layout,
  accessibility, responsive behavior, reduced motion, and high-zoom reflow.

Authority rule:

- If a detail is not stated here, the normative topic docs decide it.
- If this plan ever conflicts with `protocol-v1.md` or `security-architecture.md`, the normative docs win and this plan must be updated before implementation proceeds.

# 1. Environment and dependency pins

The implementation target is pinned to the exact 2026-07-12 versions below. These versions are part of the release contract and may not be silently changed.

Runtime and toolchain:

- Node `22.23.1`
- npm `12.0.0`
- `.node-version` must contain exactly `22.23.1`; this is the reproducible build/runtime pin.
- `package.json` must declare `"engines": { "node": "^22.12.0 || >=24.0.0" }` only as a consumer compatibility range. The `engines` range is not an exact pin and does not override `.node-version` for reproducible builds.

Core app stack:

- `typescript` `7.0.2`
- `preact` `10.29.7`
- `vite` `8.1.4`
- `@preact/preset-vite` `2.10.5`

Crypto, QR, storage:

- `@noble/post-quantum` `0.6.1`
- `@noble/curves` `2.2.0`
- `@noble/hashes` `2.2.0`
- `@scure/bip39` `2.2.0`
- `qrcode` `1.5.4`
- `@types/qrcode` `1.5.6`
- `@zxing/browser` `0.2.1`
- `idb` `8.0.3`
- `vite-plugin-pwa` `1.3.0`

Testing and verification:

- `vitest` `4.1.10`
- `@vitest/coverage-v8` `4.1.10`
- `fast-check` `4.9.0`
- `@testing-library/preact` `3.2.4`
- `@testing-library/user-event` `14.6.1`
- `jsdom` `29.1.1`
- `fake-indexeddb` `6.2.5`
- `@playwright/test` `1.61.1`
- `axe-core` `4.12.1`
- `@axe-core/playwright` `4.12.1`

Linting, formatting, scripting:

- `eslint` `10.7.0`
- `@eslint/js` `10.0.1`
- `typescript-eslint` `8.63.0`
- `globals` `17.7.0`
- `prettier` `3.9.5`
- `tsx` `4.23.0`
- `markdownlint-cli2` `0.23.0`

Security and release constraint:

- These exact versions must be written into `package.json` and `package-lock.json`.
- Any later change to those versions requires explicit security review.
- Dependency review is part of the release plan, not a follow-up afterthought.

# 2. Planned file tree and responsibilities

This is the planned source tree for the implementation. The goal is small, focused modules with stable ownership boundaries. The tree below intentionally maps to the master docs and the required future package layout.

```text
.
├─ .github/
│  ├─ workflows/
│  │  ├─ ci.yml                     # typecheck/lint/test/build/release gates
│  │  ├─ pages.yml                  # GitHub Pages deploy contract
│  │  ├─ release.yml                # release tagging, SBOM, provenance, artifacts
│  │  └─ security-review.yml        # dependency review / release review gate
├─ docs/
│  └─ implementation-plan.md        # this file; normative topic docs already exist
├─ fixtures/
│  ├─ crypto/                       # known-answer and interop vectors
│  ├─ protocol/                     # PPXC/PPXV/PPXR/PPXT/PPXF goldens
│  ├─ qr/                           # QR degradation, capacity, and scanner fixtures
│  ├─ import/                       # recovery words, BIP39, collision, and malformed imports
│  └─ files/                        # file chunking, boundary, and manifest fixtures
├─ public/
│  ├─ icons/                        # app icons and maskable variants
│  ├─ manifest.webmanifest          # PWA manifest
│  └─ robots.txt                    # static site policy
├─ scripts/
│  ├─ check-doc-terminology.ts      # baseline docs terminology and link checks
│  ├─ generate-vectors.ts           # fixture generation from canonical source data
│  ├─ verify-release.ts             # release evidence and provenance checks
│  ├─ build-sbom.ts                 # SBOM generation wrapper
│  ├─ package-release.ts            # archive / artifact packaging
│  ├─ check-reproducibility.ts      # clean-build artifact comparison
│  └─ check-dependencies.ts         # dependency-review release gate
├─ src/
│  ├─ app/
│  │  ├─ App.tsx                    # shell composition and route wiring
│  │  ├─ routes.ts                  # hash routes and initial destination rules
│  │  ├─ state.ts                   # app-level state machine
│  │  └─ bootstrap.ts               # runtime setup, locale, storage, service worker
│  ├─ components/
│  │  ├─ navigation/                # mobile bottom nav and desktop rail
│  │  ├─ cards/                     # PPXC, PPXV, PPXR semantic card views
│  │  ├─ forms/                     # inputs, counters, confirmation, validation
│  │  ├─ dialogs/                   # warnings, confirmations, technical details
│  │  ├─ qr/                        # render, scan, classify, degrade, and import
│  │  ├─ media/                     # preview, playback, download fallback
│  │  └─ feedback/                  # progress, banners, toasts, live regions
│  ├─ flows/
│  │  ├─ identity/                  # create, import, export, remember, delete
│  │  ├─ contacts/                  # import, merge, nickname, collision, delete
│  │  ├─ encrypt/                   # text and file encryption
│  │  ├─ decrypt/                   # smart routing and safe failure handling
│  │  └─ help/                      # help/about/diagnostics/chat-control explainer
│  ├─ protocol/
│  │  ├─ types.ts                   # PPX object types and error unions
│  │  ├─ bytes.ts                   # strict byte reader/writer and limits
│  │  ├─ text.ts                    # NFKC, MIME, filename, caption normalization
│  │  ├─ base45.ts                  # uppercase Base45 codec
│  │  ├─ base64url.ts               # armor codec and wrapping helpers
│  │  ├─ checksum.ts                # SHA-512 truncation helpers
│  │  ├─ ppxc.ts                    # public contact codec and validation
│  │  ├─ ppxv.ts                    # locked vault codec
│  │  ├─ ppxr.ts                    # recovery object codec
│  │  ├─ ppxt.ts                    # encrypted text public codec orchestration
│  │  ├─ ppxt-inner.ts              # signed encrypted-text inner payload codec
│  │  ├─ ppxt-outer.ts              # strict encrypted-text outer payload codec
│  │  ├─ ppxt-armor.ts              # canonical text armor encoder/parser
│  │  └─ ppxf.ts                    # encrypted file codec, chunk and manifest codec
│  ├─ crypto/
│  │  ├─ provider.ts                # CryptoProvider and RecoveryWordCodec interfaces
│  │  ├─ contracts.ts               # authoritative PPX worker request/event unions
│  │  ├─ noble-provider.ts          # Noble/WebCrypto-backed provider
│  │  ├─ webcrypto.ts               # WebCrypto wrapper and feature detection
│  │  ├─ identity.ts                # deriveIdentity, fingerprinting, public contact creation
│  │  ├─ recovery-words.ts          # BIP39 recovery word codec
│  │  ├─ hybrid.ts                  # ML-KEM/X25519 encapsulation and AEAD key derivation
│  │  ├─ text.ts                    # encrypt/decrypt text internals
│  │  ├─ file.ts                    # encrypt/decrypt file internals
│  │  ├─ vault.ts                   # scrypt/AES-GCM vault lock and unlock helpers
│  │  └─ zeroize.ts                 # best-effort wiping utilities
│  ├─ storage/
│  │  ├─ db.ts                      # IndexedDB open/migrate/close
│  │  ├─ contacts.ts                # public contacts persistence
│  │  ├─ vault.ts                   # encrypted identity vault persistence
│  │  ├─ settings.ts                # locale, choice, and UI state
│  │  ├─ session.ts                 # session-only fallback state
│  │  └─ erase.ts                   # delete vault, delete contacts, erase-all
│  ├─ workers/
│  │  ├─ crypto-worker.ts           # long-running crypto jobs, cancel, progress
│  │  ├─ file-worker.ts             # chunked file processing with bounded memory
│  │  ├─ scan-worker.ts             # QR scanning and classification assistance
│  │  └─ shared.ts                  # worker dispatch helpers using crypto/contracts.ts
│  ├─ sw/
│  │  ├─ service-worker.ts          # shell caching and update detection
│  │  ├─ cache-policy.ts            # versioned asset allowlist and denial logic
│  │  └─ update.ts                  # version banner state and safe update prompts
│  ├─ diagnostics/
│  │  ├─ report.ts                  # local diagnostics assembly
│  │  ├─ sanitize.ts                # strip sensitive values and paths
│  │  └─ issue-link.ts              # user-reviewed GitHub issue draft link generation
│  ├─ i18n/
│  │  ├─ index.ts                   # locale registration and keyed lookup
│  │  ├─ en.ts                      # English resources
│  │  ├─ de.ts                      # German resources
│  │  ├─ keys.ts                    # shared string keys and interpolation shapes
│  │  └─ format.ts                  # locale-aware dates, times, numbers, plurals
│  └─ tests/
│     ├─ unit/                      # unit tests for bytes, protocol, crypto wrappers
│     ├─ property/                   # property-based protocol and normalization tests
│     ├─ e2e/                       # Playwright identity/encrypt/decrypt/contact flows
│     ├─ accessibility/             # axe, keyboard, zoom, focus, screen reader checks
│     └─ release/                   # provenance, pages, update, sbom, reproducibility
├─ .editorconfig
├─ .gitignore
├─ .node-version
├─ LICENSE
├─ package.json
├─ package-lock.json
├─ README.md
├─ SECURITY.md
├─ CONTRIBUTING.md
├─ tsconfig.json
├─ tsconfig.node.json
├─ vite.config.ts
├─ vitest.config.ts
└─ eslint.config.js
```

Module ownership rules:

- `src/protocol` owns canonical parsing and serialization only.
- `src/crypto` owns primitive use and key derivation only.
- `src/storage` stores only encrypted vaults, public contacts, and user-approved local settings.
- `src/workers` owns long-running and memory-bounded tasks.
- `src/app` owns route composition and state machine orchestration.
- `src/components` stays presentational and accessible.
- `src/flows` binds UI to protocol, crypto, storage, and workers.
- `src/sw` owns offline shell and update contract only.
- `src/diagnostics` sanitizes reports locally and never auto-submits anything.
- `src/i18n` is the only user-visible string source.

# 3. Exact public interfaces to preserve

Implementation agents must not invent different names for the core contracts. The future code should expose these exact interfaces and types where the normative docs require them.

```ts
export interface CryptoProvider {
  deriveIdentity(masterEntropy: Uint8Array): Promise<DerivedIdentity>;
  createPublicContact(identity: DerivedIdentity, pseudonym: string, creationTime: bigint): PublicContact;
  parsePublicContact(bytes: Uint8Array): PublicContact;
  createHybridEncapsulation(params: {
    recipientFingerprint: Uint8Array;
    recipientKemPublicKey: Uint8Array;
    recipientX25519PublicKey: Uint8Array;
  }): HybridEncapsulation;
  encryptText(input: EncryptTextInput): Promise<EncryptedTextObject>;
  decryptText(input: DecryptTextInput): Promise<DecryptedTextOutput>;
  encryptFile(input: EncryptFileInput, hooks?: FileCryptoHooks): Promise<EncryptedFileObject>;
  encryptFileToBlob(input: EncryptFileInput, hooks?: FileCryptoHooks): Promise<EncryptedFileBlobOutput>;
  decryptFile(input: DecryptFileInput, hooks?: FileCryptoHooks): Promise<DecryptedFileOutput>;
  lockVault(input: LockVaultInput): Promise<LockedVaultObject>;
  unlockVault(input: UnlockVaultInput): Promise<DerivedIdentity>;
}

export interface RecoveryWordCodec {
  entropyToRecoveryWords(entropy32: Uint8Array): string[];
  recoveryWordsToEntropy(words: string[]): Uint8Array;
}

export interface SenderSigningCapability {
  fingerprint: Uint8Array;
  signingPublicKey: Uint8Array;
  signingSecretKey: Uint8Array;
}

export type PPXParseError =
  | 'unknown-format-version'
  | 'unknown-suite'
  | 'unknown-flags'
  | 'impossible-length'
  | 'duplicate-field'
  | 'trailing-bytes'
  | 'noncanonical-text'
  | 'oversize-before-allocation'
  | 'checksum-mismatch';

export type PPXCryptoError =
  | 'wrong-identity-or-corruption'
  | 'wrong-passphrase-or-corruption'
  | 'invalid-aead'
  | 'invalid-signature'
  | 'invalid-hybrid-encapsulation'
  | 'invalid-passphrase'
  | 'corrupted-vault';
```

The object interfaces in `docs/protocol-v1.md` and `docs/security-architecture.md` are also normative. The implementation must keep their field names and length limits intact, including the file chunk size `1048576`, the text limit `262144`, the file limit `104857600`, the public contact cap `1008`, and the scrypt parameters `N=65536`, `r=8`, `p=2`.

# 4. Execution contract

The implementation is expected to follow TDD. Every task below uses the same sequence:

1. Write or update a failing test.
2. Verify the test fails for the intended reason.
3. Implement the minimum code needed.
4. Verify the test passes and the related regressions remain green.

The plan intentionally separates "functional scaffolding" from "visual polish". The lack of a user-approved visual spec does not block architecture, semantics, accessibility wiring, or protocol work.

Do not treat any command below as already run. They are future commands and expected outcomes.

# 5. TDD task list

## 0) Bootstrap repository, preserve docs baseline, and gate implementation authorization

Prerequisites:

- User authorization to begin implementation.
- Confirmation that the current docs baseline remains the source of truth.
- No source code scaffold exists yet; this task creates the repository foundation.

Create/modify/test paths:

- Create: `package.json`, `package-lock.json`, `.gitignore`, `.editorconfig`, `.node-version`, `README.md`, `LICENSE` if missing in the initialized repo context, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `scripts/check-doc-terminology.ts`.
- Modify: none during bootstrap; amendments to `docs/implementation-plan.md` require a separately reviewed plan correction.
- Test: `scripts/check-doc-terminology.ts` and the future `npm run docs:check` command.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: draft `scripts/check-doc-terminology.ts` so it rejects missing required product terms, missing authority links, and broken dependency references in `docs/*.md`.
- [ ] Verify-fail: run the future `npm run docs:check` and confirm it fails before the bootstrap files exist.
- [ ] Implement: initialize the repository structure, add exact npm scripts, lock the pinned toolchain, and add a baseline docs terminology checker.
- [ ] Verify-pass: rerun `npm run docs:check` and confirm it passes once the baseline files and required docs are present.

Key implementation shape:

```json
{
  "engines": {
    "node": "^22.12.0 || >=24.0.0"
  },
  "scripts": {
    "docs:check": "tsx scripts/check-doc-terminology.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "unit": "vitest run --coverage",
    "test": "npm run typecheck && npm run lint && npm run format:check && npm run unit",
    "test:primitive-vectors": "vitest run src/tests/unit/primitive-vectors.test.ts",
    "test:ppx-golden": "vitest run src/tests/unit/ppx-golden.test.ts",
    "test:parser-property": "vitest run src/tests/property/parser-roundtrip.property.test.ts",
    "test:parser-fuzz": "vitest run src/tests/property/fuzz-100k.property.test.ts",
    "test:mutations": "vitest run src/tests/property/mutation.property.test.ts",
    "test:truncations": "vitest run src/tests/property/truncation.property.test.ts",
    "test:boundaries": "vitest run src/tests/property/boundary.property.test.ts",
    "test:qr-degradation": "vitest run src/tests/property/qr-degradation.property.test.ts",
    "test:bip39": "vitest run src/tests/unit/recovery-words.test.ts src/tests/property/recovery-roundtrip.property.test.ts",
    "test:storage": "vitest run src/tests/unit/storage.test.ts",
    "test:session-only": "playwright test src/tests/e2e/session-only.spec.ts",
    "test:chunks": "vitest run src/tests/property/file-chunks.property.test.ts",
    "test:order": "vitest run src/tests/unit/file-order.test.ts",
    "test:manifest": "vitest run src/tests/unit/file-manifest.test.ts",
    "test:file-limits": "vitest run src/tests/property/file-boundary.property.test.ts",
    "test:cancel": "playwright test src/tests/e2e/file-cancel.spec.ts",
    "test:memory": "vitest run src/tests/unit/memory-budget.test.ts",
    "test:en-de": "playwright test src/tests/e2e/en-de.spec.ts",
    "test:e2e": "playwright test",
    "test:unknown-sender": "vitest run src/tests/unit/unknown-sender.test.ts",
    "test:accessibility": "vitest run src/tests/accessibility && playwright test src/tests/accessibility",
    "test:i18n": "vitest run src/tests/unit/i18n.test.ts src/tests/accessibility/i18n.test.ts",
    "test:offline": "playwright test src/tests/release/offline.spec.ts",
    "test:update-banner": "playwright test src/tests/release/update-banner.spec.ts",
    "test:network-denial": "playwright test src/tests/release/network-denial.spec.ts",
    "test:release": "tsx scripts/verify-release.ts",
    "test:sbom": "tsx scripts/build-sbom.ts --verify",
    "test:reproducibility": "tsx scripts/check-reproducibility.ts",
    "test:dependency-review": "tsx scripts/check-dependencies.ts",
    "verify": "npm run docs:check && npm run test && npm run test:primitive-vectors && npm run test:ppx-golden && npm run test:parser-property && npm run test:parser-fuzz && npm run test:mutations && npm run test:truncations && npm run test:boundaries && npm run test:qr-degradation && npm run test:bip39 && npm run test:storage && npm run test:session-only && npm run test:chunks && npm run test:order && npm run test:manifest && npm run test:file-limits && npm run test:cancel && npm run test:memory && npm run test:en-de && npm run test:e2e && npm run test:unknown-sender && npm run test:accessibility && npm run test:i18n && npm run test:offline && npm run test:update-banner && npm run test:network-denial && npm run test:release && npm run test:sbom && npm run test:reproducibility && npm run test:dependency-review"
  }
}
```

Task 0 defines the complete command surface immediately. `docs:check`, `typecheck`, `lint`, `format:check`, and the bootstrap-relevant portion of `test` become green as their inputs land; every specialized script is expected to exit non-zero while its named test files, fixtures, browser projects, or release helper are still absent. A script may be declared before its owning task creates those inputs, but it must never silently skip missing coverage. `test` remains the baseline composite and is never used as a Vitest filter target; `verify` is the complete ordered release gate.

Exact checks to codify:

- Required product terms appear in the docs baseline: `identity`, `public contact`, `private recovery card`, `encrypted text`, `encrypted file`.
- `Chat_NoControl_full_plan.md` and the topic docs are linked from the implementation plan metadata.
- No future code claims the app exists before implementation starts.
- The repo root remains docs-first until the future init task runs after authorization.

Exact commands and expected outcomes:

- `npm run docs:check` -> exits non-zero until baseline docs and manifest exist, then exits zero.
- `git init` -> creates the repository only after implementation authorization.
- `npm install` -> writes the pinned `package-lock.json` from the exact dependency versions.
- `npm run typecheck` -> fails until the scaffold is present, then becomes a baseline gate.

Acceptance checklist:

- The repo has a reproducible Node/package baseline.
- Docs terminology checks exist and are wired into scripts.
- Git initialization is deferred until implementation authorization.
- No source files beyond baseline scaffold are created in this step.

Future commit message:

- `chore: bootstrap Chat NoControl v1 implementation scaffold`

## 1) Build the Preact/Vite shell and quality gates

Prerequisites:

- Task 0 complete.
- Exact dependency pins are locked.
- Apply the approved Apple-inspired system from `docs/apple-visual-spec.md`
  while preserving semantic shell structure and opaque material fallbacks.

Create/modify/test paths:

- Create: `src/app/App.tsx`, `src/app/routes.ts`, `src/app/state.ts`, `src/app/bootstrap.ts`, `src/components/navigation/*`, `src/i18n/*`, `public/manifest.webmanifest`, `public/icons/*`.
- Modify: `package.json`, `README.md`, `vite.config.ts`, `eslint.config.js`, `vitest.config.ts`, `docs/accessibility-i18n.md` to record the implemented shell and build alignment.
- Test: `src/tests/unit/app-shell.test.tsx`, `src/tests/accessibility/navigation.test.ts`, `src/tests/e2e/bootstrap.spec.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: render the app shell without navigation, locale setup, or route wiring and confirm tests fail.
- [ ] Verify-fail: run `npm run typecheck`, `npm run lint`, and the shell test suite before wiring the app.
- [ ] Implement: add the shell, hash routes, locale bootstrap, service worker registration hook, and strict TypeScript config.
- [ ] Verify-pass: rerun all baseline checks and confirm the shell mounts, routes resolve, and the app stays backend-free.

Key interfaces and config:

```ts
export type RouteName = 'encrypt' | 'decrypt' | 'contacts' | 'identity' | 'help';

export interface AppState {
  locale: 'en' | 'de';
  route: RouteName;
  activeIdentityId: Uint8Array | null;
  storageMode: 'persistent' | 'session-only';
}
```

```ts
export const ROUTES: Record<RouteName, string> = {
  encrypt: '#/encrypt',
  decrypt: '#/decrypt',
  contacts: '#/contacts',
  identity: '#/identity',
  help: '#/help',
};
```

Exact shell rules:

- Desktop uses a left rail.
- Mobile uses bottom navigation.
- The first functional destination after identity readiness is `Encrypt`.
- The first screen for a new user is `Create identity / Import identity`.
- The app must not depend on remote URLs, remote fonts, or third-party scripts.

Exact commands and expected outcomes:

- `npm run typecheck` -> no TypeScript errors once shell contracts exist.
- `npm run lint` -> no style or import boundary violations.
- `npm run test` -> the shell, route, and locale bootstrap tests pass.

Acceptance checklist:

- App shell renders on both desktop and mobile viewports.
- Hash routing is in place.
- ESLint, Prettier, Vitest, Playwright, and CI gates are wired.
- No remote resource dependency exists in the shell.

Future commit message:

- `feat: add Chat NoControl shell and quality gates`

## 2) Implement strict byte reader/writer, limits, normalization, Base45, and base64url

Prerequisites:

- Task 1 complete.
- Protocol limits from `protocol-v1.md` are treated as hard constraints.

Create/modify/test paths:

- Create: `src/protocol/types.ts`, `src/protocol/bytes.ts`, `src/protocol/text.ts`, `src/protocol/base45.ts`, `src/protocol/base64url.ts`, `src/protocol/checksum.ts`.
- Test: `src/tests/unit/bytes.test.ts`, `src/tests/property/text-normalization.property.test.ts`, `src/tests/property/base45.property.test.ts`, `src/tests/property/base64url.property.test.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: write byte-read/write tests that exceed every limit and confirm they fail before implementation.
- [ ] Verify-fail: exercise NFKC normalization, filename sanitization, MIME sanitization, and overlong UTF-8 inputs.
- [ ] Implement: add a strict reader/writer with preallocation guards, exact byte-length checks, and canonical encoding helpers.
- [ ] Verify-pass: run property tests confirming round-trip stability and rejection of malformed inputs.

Key public interfaces:

```ts
export interface ByteReader {
  readBytes(length: number): Uint8Array;
  readUint8(): number;
  readUint32BE(): number;
  readUint64BE(): bigint;
  remaining(): number;
}

export interface ByteWriter {
  writeBytes(bytes: Uint8Array): void;
  writeUint8(value: number): void;
  writeUint32BE(value: number): void;
  writeUint64BE(value: bigint): void;
  toBytes(): Uint8Array;
}

export function normalizePseudonym(input: string): string;
export function normalizeFilename(input: string): string;
export function normalizeMimeHint(input: string): string;
export function normalizeCaption(input: string): string;
export function encodeBase45Upper(bytes: Uint8Array): string;
export function decodeBase45Upper(text: string): Uint8Array;
export function encodeBase64UrlNoPad(bytes: Uint8Array): string;
export function decodeBase64UrlNoPad(text: string): Uint8Array;
```

Exact normalization rules:

- Pseudonym uses Unicode NFKC, trims Unicode whitespace, rejects control characters, bidi overrides, line separators, and null bytes, and must be `1..48` UTF-8 bytes after normalization.
- Filename normalization is protocol-aware and must keep the output `<=255` UTF-8 bytes.
- MIME hints are advisory only and must be ASCII `<=127` bytes.
- Caption normalization must produce `0..16384` UTF-8 bytes, with empty string meaning absent.

Exact commands and expected outcomes:

- `npm run unit -- bytes` -> property tests confirm all canonical inputs round-trip.
- `npm run unit -- text-normalization` -> invalid Unicode and oversize text reject with deterministic errors.
- `npm run unit -- base45` -> uppercase Base45 encoding matches RFC 9285 expectations.

Acceptance checklist:

- Reader/writer reject impossible lengths before allocation.
- Normalization is canonical and reusable across protocol and UI layers.
- Base45 and base64url are isolated utilities with property tests.

Future commit message:

- `feat: add strict byte and text codecs`

## 3) Implement CryptoProvider, Noble/WebCrypto provider, and primitive vectors

Prerequisites:

- Task 2 complete.
- Exact crypto dependencies are pinned and available.
- Implementation must stay worker-safe and provider-based.

Create/modify/test paths:

- Create: `src/crypto/provider.ts`, `src/crypto/default-provider.ts`, `src/crypto/webcrypto.ts`, `src/crypto/noble-provider.ts`, `src/crypto/contracts.ts`, `src/crypto/zeroize.ts`, `scripts/generate-vectors.ts`, `fixtures/crypto/*`.
- Modify: `src/protocol/types.ts` to export the crypto object and safe error types referenced by `src/crypto/contracts.ts`.
- Test: `src/tests/unit/crypto-provider.test.ts`, `src/tests/unit/primitive-vectors.test.ts`, `src/tests/unit/worker-contracts.test.ts`, `src/tests/property/crypto-interop.property.test.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: write known-answer vector tests for SHA-512, HKDF-SHA-512, scrypt, X25519, Ed25519, AES-256-GCM, and ML-KEM-512.
- [ ] Verify-fail: ensure concrete library calls are not reachable from UI or storage code.
- [ ] Implement: provide `DefaultCryptoProvider` backed by Noble and WebCrypto,
  request-owned signing capabilities, and provider-owned hybrid encapsulation.
- [ ] Verify-pass: run all vectors and confirm worker-safe APIs do not leak browser-only assumptions into protocol code; typecheck every worker boundary against the exact `PPXWorkerRequest` and `PPXWorkerEvent` unions.

Key interfaces:

```ts
export interface DerivedIdentity {
  suite: 0x01;
  creationTime: bigint;
  masterEntropy: Uint8Array;
  kemPublicKey: Uint8Array;
  kemSecretKey: Uint8Array;
  x25519PublicKey: Uint8Array;
  x25519SecretKey: Uint8Array;
  signingPublicKey: Uint8Array;
  signingSecretKey: Uint8Array;
  fingerprint: Uint8Array;
  identityId: Uint8Array;
  pseudonym: string;
}
```

```ts
export function createNobleCryptoProvider(): CryptoProvider;
export function createWebCryptoAdapter(): CryptoProvider | null;
export function deriveFingerprint(input: {
  suite: 0x01;
  kemPublicKey: Uint8Array;
  x25519PublicKey: Uint8Array;
  signingPublicKey: Uint8Array;
}): Uint8Array;
```

`src/crypto/contracts.ts` must contain these exact authoritative unions, without alternate `type`, `phase`, or ad hoc message shapes:

```ts
export type PPXWorkerRequest =
  | {
      kind: 'encrypt-text';
      requestId: string;
      input: EncryptTextInput;
    }
  | {
      kind: 'decrypt-text';
      requestId: string;
      input: DecryptTextInput;
    }
  | {
      kind: 'encrypt-file';
      requestId: string;
      input: EncryptFileInput;
    }
  | {
      kind: 'decrypt-file';
      requestId: string;
      input: DecryptFileInput;
    }
  | {
      kind: 'unlock-vault';
      requestId: string;
      input: UnlockVaultInput;
    }
  | {
      kind: 'lock-vault';
      requestId: string;
      input: LockVaultInput;
    }
  | {
      kind: 'cancel';
      requestId: string;
    };

export type PPXWorkerEvent =
  | {
      kind: 'progress';
      requestId: string;
      stage: 'parse' | 'derive' | 'encrypt' | 'decrypt' | 'sign' | 'serialize';
      completedBytes: bigint;
      totalBytes: bigint;
      chunkIndex?: number;
    }
  | {
      kind: 'completed';
      requestId: string;
      result:
        | EncryptedTextObject
        | EncryptedFileObject
        | EncryptedFileBlobOutput
        | LockedVaultObject
        | DerivedIdentity;
    }
  | {
      kind: 'completed';
      requestId: string;
      result: DecryptedTextOutput | DecryptedFileOutput;
    }
  | {
      kind: 'error';
      requestId: string;
      code: PPXSafeWorkerError;
    }
  | {
      kind: 'cancelled';
      requestId: string;
    };

export type PPXSafeWorkerError = PPXParseError | PPXCryptoError;
```

The authoritative file transport types are:

```ts
export interface DecryptFileInput {
  object: EncryptedFileObject | Blob;
  activeIdentity: DerivedIdentity;
}

export interface EncryptedFileBlobOutput {
  blob: Blob;
  plaintextLength: bigint;
  encodedLength: bigint;
}
```

The `Blob` request/result path is required for bounded worker memory. It does
not alter the PPXF wire object or permit partial output before validation.

Exact algorithm constraints:

- SHA-512 and HKDF-SHA-512 use the ASCII labels from the normative docs without re-casing.
- scrypt must use `N=65536`, `r=8`, `p=2`, and a `16` byte salt for vault encryption.
- AES-256-GCM must use `32` byte keys and `12` byte nonces.
- `ML-KEM-512`, `X25519`, and `Ed25519` are mandatory primitives.
- Zeroization is best effort only and never claimed as guaranteed memory erasure.

Exact commands and expected outcomes:

- `npm run test:primitive-vectors` -> every vector fixture passes.
- `npm run unit -- crypto-interop` -> provider outputs match canonical fixture data.

Acceptance checklist:

- Crypto code is behind `CryptoProvider`.
- Primitive vectors exist for every required primitive.
- Worker-safe use is preserved.
- `src/crypto/contracts.ts` is the single source of truth for worker messages and exactly matches `security-architecture.md`.

Future commit message:

- `feat: add provider-based crypto layer`

## 4) Implement deterministic identity, BIP39 recovery words, fingerprint, and word-import pseudonym handling

Prerequisites:

- Task 3 complete.
- Recovery words must use the English BIP39 word list only.

Create/modify/test paths:

- Create: `src/crypto/recovery-words.ts`, `src/crypto/identity.ts`, `fixtures/import/*`.
- Modify: `src/crypto/provider.ts` only if helper wiring is needed.
- Test: `src/tests/unit/recovery-words.test.ts`, `src/tests/property/recovery-roundtrip.property.test.ts`, `src/tests/unit/identity-fingerprint.test.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: confirm 32-byte entropy does not yet round-trip to exactly 24 valid English words.
- [ ] Verify-fail: ensure PBKDF2-based mnemonic-to-seed logic is unreachable for PPX key derivation.
- [ ] Implement: derive the identity from 32 bytes of entropy, build the 24-word reversible recovery codec, and support re-pseudonymized imports.
- [ ] Verify-pass: assert the same entropy always yields the same fingerprint and identity ID.

Key public interfaces:

```ts
export interface RecoveryWordsImportInput {
  words: string[];
  pseudonym: string;
  importedAt: bigint;
}

export interface RecoveryWordsImportOutput {
  identity: DerivedIdentity;
  publicContact: PublicContact;
  importedAt: bigint;
}
```

Exact behavior:

- Recovery words are a reversible encoding of the 32-byte master entropy only.
- Recovery words are English-only and must be exactly 24 words.
- Mnemonic normalization uses NFKD and single ASCII spaces.
- `pseudonym` is public, separate from the fingerprint, and must be normalized independently.
- Word import creates a new signed `PPXC` for the same fingerprint, but never claims the import time is the original creation time. `PPXV` and `PPXR` imports preserve their embedded pseudonym and creation time.

Exact commands and expected outcomes:

- `npm run test:bip39` -> valid mnemonics round-trip, invalid word counts fail, checksum-invalid cases fail.
- `npm run unit -- identity-fingerprint` -> repeated derivations are stable.

Acceptance checklist:

- BIP39 English recovery words are supported exactly as required.
- Identity fingerprint is deterministic and pseudonym-independent.
- Word import preserves local metadata only for its new import time; `PPXV` and `PPXR` preserve their embedded identity metadata.

Future commit message:

- `feat: add identity derivation and recovery word codec`

## 5) Implement exact PPXC codec, self-signature, 1008-byte cap, and QR capacity checks

Prerequisites:

- Task 4 complete.
- The public contact object layout is fixed by `protocol-v1.md`.

Create/modify/test paths:

- Create: `src/protocol/ppxc.ts`, `src/components/cards/public-contact-card.tsx`, `fixtures/protocol/ppxc/*.bin`, `fixtures/protocol/ppxc/*.json` decoded-shape manifests.
- Modify: `src/protocol/types.ts`.
- Test: `src/tests/unit/ppxc.test.ts`, `src/tests/property/ppxc-roundtrip.property.test.ts`, `src/tests/unit/ppxc-qr-capacity.test.ts`, including full-shape assertions for every binary fixture and decoded-shape manifest.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: encode a PPXC payload that exceeds 1008 bytes and confirm the codec rejects it.
- [ ] Verify-fail: corrupt the self-signature, checksum, or version byte and confirm parse rejection; also prove the fixture test fails when any required `PublicContact` field is missing, renamed, or has the wrong runtime type.
- [ ] Implement: build exact PPXC serialization, parsing, signature verification, and QR prefix handling.
- [ ] Verify-pass: confirm all canonical fixtures encode/decode, expose the complete `PublicContact` shape below with exact property names and runtime types, and fit the QR capacity constraints.

Key interfaces:

```ts
export interface PublicContact {
  magic: 'PPXC';
  formatVersion: 0x01;
  suite: 0x01;
  creationTime: bigint;
  pseudonym: string;
  kemPublicKey: Uint8Array;
  x25519PublicKey: Uint8Array;
  signingPublicKey: Uint8Array;
  selfSignature: Uint8Array;
  checksum: Uint8Array;
  fingerprint: Uint8Array;
  identityId: Uint8Array;
}
```

Exact protocol details:

- The self-signature uses the `PPX/CONTACT/V1/SIGNATURE` domain label.
- The signed byte string is `domainLabel || all preceding bytes`.
- `PPXC` maximum size is `1008` bytes.
- QR transport prefix is `PPX1:CONTACT:`.
- QR transport uses uppercase Base45.
- The first 20 bytes of the fingerprint are the displayed identity ID.

Exact commands and expected outcomes:

- `npm run unit -- ppxc` -> canonical fixtures pass and oversized variants fail.
- `npm run unit -- ppxc-qr-capacity` -> every allowed PPXC fits the declared capacity envelope.

Acceptance checklist:

- PPXC serialization is canonical.
- Every PPXC fixture test asserts all twelve `PublicContact` fields, their exact names, and their exact runtime types; partial-shape assertions are insufficient.
- The public contact is self-authenticating and capped correctly.
- QR export/import uses the exact prefix and encoding rules.

Future commit message:

- `feat: add PPXC codec and QR transport`

## 6) Implement PPXV and PPXR codecs, scrypt vault flow, and generic failure behavior

Prerequisites:

- Task 5 complete.
- Vault unlock must remain generic on failure.

Create/modify/test paths:

- Create: `src/protocol/ppxv.ts`, `src/protocol/ppxr.ts`, `src/crypto/vault.ts`, `src/flows/identity/import-vault.ts`.
- Modify: `src/crypto/provider.ts` to wire the exact vault lock/unlock inputs and outputs through the provider boundary.
- Test: `src/tests/unit/ppxv.test.ts`, `src/tests/unit/ppxr.test.ts`, `src/tests/property/vault-roundtrip.property.test.ts`, `src/tests/unit/vault-failure.test.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: confirm an invalid passphrase and corrupted vault both fail without revealing which one happened.
- [ ] Verify-fail: reject malformed `PPXV` fields, impossible lengths, or invalid `PPXR` checksums.
- [ ] Implement: serialize locked vaults and dangerous recovery records exactly as specified.
- [ ] Verify-pass: confirm lock and unlock round-trip with the fixed scrypt and AES-GCM parameters.

Key interfaces:

```ts
export interface LockedVaultObject {
  magic: 'PPXV';
  formatVersion: 0x01;
  suite: 0x01;
  flags: number;
  kdfId: 0x01;
  scryptN: 65536;
  scryptR: 8;
  scryptP: 2;
  salt: Uint8Array;
  nonce: Uint8Array;
  ciphertextLength: number;
  ciphertext: Uint8Array;
  checksum: Uint8Array;
}

export interface RecoveryObject {
  magic: 'PPXR';
  formatVersion: 0x01;
  suite: 0x01;
  flags: number;
  masterEntropy: Uint8Array;
  creationTime: bigint;
  pseudonym: string;
  checksum: Uint8Array;
}
```

Exact behavior:

- PPXV is the encrypted local vault.
- PPXR is explicitly dangerous and unencrypted.
- Vault unlock failures collapse to `wrong-passphrase-or-corruption`.
- Recovery export transport uses `PPX1:RECOVERY:`.

Exact commands and expected outcomes:

- `npm run unit -- ppxv` -> lock/unlock canonical fixtures pass.
- `npm run unit -- ppxr` -> recovery object round-trips and checksum failures reject.

Acceptance checklist:

- Vault persistence is encrypted only.
- Recovery export is obvious-danger treatment.
- Failure semantics are generic and safe.

Future commit message:

- `feat: add vault and recovery codecs`

## 7) Implement QR generation/scanning/classification, card rendering, and degradation fixtures

Prerequisites:

- Task 6 complete.
- Public/private semantic distinction must be obvious without hover or color alone.

Create/modify/test paths:

- Create: `src/components/qr/generate.ts`, `src/components/qr/scan.ts`, `src/components/qr/qr-view.tsx`, `src/components/cards/private-export-card.tsx`, `src/flows/decrypt/classify.ts`, `src/workers/scan-worker.ts`, `fixtures/qr/*`.
- Modify: `src/components/cards/public-contact-card.tsx`, `src/components/navigation/*` to expose the QR scan and export entry points.
- Test: `src/tests/property/qr-classification.property.test.ts`, `src/tests/property/qr-degradation.property.test.ts`, `src/tests/e2e/qr-flow.spec.ts`, `src/tests/accessibility/qr-card.test.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: classify malformed QR armor, damaged codes, and wrong prefixes before implementation.
- [ ] Verify-fail: ensure public contact, private vault, and dangerous recovery surfaces are visually and semantically distinct.
- [ ] Implement: generate and scan QR payloads, classify `PPX1:CONTACT:`, `PPX1:PRIVATE:`, and `PPX1:RECOVERY:` by exact prefix/object family, and render the appropriate card treatment without implementing any PPXT codec or armor behavior.
- [ ] Verify-pass: confirm degradation fixtures fail safely and public contact semantics remain non-dangerous.

Key interfaces:

```ts
export type ClassifiedQrPayload =
  | { kind: 'public-contact'; prefix: 'PPX1:CONTACT:'; payload: Uint8Array }
  | { kind: 'private-vault'; prefix: 'PPX1:PRIVATE:'; payload: Uint8Array }
  | { kind: 'recovery'; prefix: 'PPX1:RECOVERY:'; payload: Uint8Array };

export function classifyQrPayload(raw: string): ClassifiedQrPayload;
```

QR and card semantics:

- Public contact card title is `Public contact`.
- Private export labels must use the danger-first treatment.
- `PPXV` and `PPXR` must never resemble `PPXC`.
- Scanner classification must route by exact prefix and object family, not by guesswork.

Exact commands and expected outcomes:

- `npm run unit -- qr-classification` -> exact supported QR prefixes route to the correct object family and malformed or unknown prefixes reject.
- `npm run test:qr-degradation` -> damaged payloads fail closed.

Acceptance checklist:

- QR generation, scanning, and classification are exact and strict.
- Card rendering preserves semantic danger distinction.
- Scanner classification is deterministic.
- Task 7 does not create or modify `src/protocol/ppxt.ts`, any PPXT inner/outer/armor module, or `fixtures/protocol/ppxt/*`.

Future commit message:

- `feat: add QR handling and semantic cards`

## 8) Implement hybrid encapsulation and PPXT inner/outer text armor with no recipient hint

Prerequisites:

- Task 6 complete for PPXC/PPXV/PPXR protocol dependencies.
- Task 7 complete for reusable QR/card classification primitives; Task 8 remains the sole owner of PPXT codec, inner payload, outer payload, armor, fixtures, and hybrid integration.
- Outer PPXT must not reveal a stable sender hint.

Create/modify/test paths:

- Create: `src/crypto/hybrid.ts`, `src/crypto/text.ts`, `src/protocol/ppxt.ts`, `src/protocol/ppxt-inner.ts`, `src/protocol/ppxt-outer.ts`, `src/protocol/ppxt-armor.ts`, `fixtures/protocol/ppxt/*.bin`, `fixtures/protocol/ppxt/*.txt`.
- Modify: `src/crypto/provider.ts` to integrate the hybrid helper through `CryptoProvider`; `src/flows/decrypt/classify.ts` only to route valid encrypted-text armor after the PPXT armor parser accepts it.
- Test: `src/tests/unit/hybrid.test.ts`, `src/tests/unit/ppxt.test.ts`, `src/tests/unit/ppxt-armor.test.ts`, `src/tests/property/ppxt-inner-roundtrip.property.test.ts`, `src/tests/property/ppxt-outer-roundtrip.property.test.ts`, `src/tests/unit/unknown-sender.test.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: confirm the outer PPXT object contains no stable recipient hint and no sender metadata, and make canonical binary and armor fixtures fail before the codec modules exist.
- [ ] Verify-fail: reject invalid hybrid encapsulations, bad AEAD tags, and invalid signatures.
- [ ] Implement: derive hybrid keys from ML-KEM-512 and X25519 through the provider-integrated helper, build and parse the signed PPXT inner payload, build and parse the strict PPXT outer payload, and encode/decode the exact text armor format.
- [ ] Verify-pass: confirm every PPXT binary and armor fixture round-trips, unknown-sender decrypt still works after valid cryptographic verification with explicit warning semantics, and all PPXT ownership remains in Task 8 paths.

Key interfaces and labels:

```ts
export interface EncryptedTextObject {
  magic: 'PPXT';
  formatVersion: 0x01;
  suite: 0x01;
  flags: number;
  mlKemCiphertext: Uint8Array;
  ephemeralX25519PublicKey: Uint8Array;
  salt: Uint8Array;
  nonce: Uint8Array;
  ciphertextLength: number;
  ciphertext: Uint8Array;
  checksum: Uint8Array;
}

export interface DecryptTextOutput {
  senderContact: PublicContact;
  recipientId: Uint8Array;
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
  plaintext: string;
  signatureValid: true;
}
```

Exact architecture rules:

- The sender `PPXC` contact must be embedded inside the encrypted content.
- The outer PPXT object does not carry a stable sender hint.
- The hybrid key derivation must use the exact `PPX/ENCRYPT/V1/HYBRID` label.
- Decryption failure collapses to the generic wrong-identity-or-corruption path.

Exact text armor rules:

- Header marker: `-----BEGIN PPX ENCRYPTED TEXT-----`
- Footer marker: `-----END PPX ENCRYPTED TEXT-----`
- Armor headers: `Version`, `Suite`, `Bytes`, `Digest`
- Body is base64url without padding, wrapped at 72 characters.

Exact commands and expected outcomes:

- `npm run unit -- hybrid` -> shared-secret combination and AEAD key derivation match fixtures.
- `npm run unit -- ppxt` -> canonical binary PPXT fixtures and strict inner/outer codecs round-trip.
- `npm run unit -- ppxt-armor` -> canonical armor fixtures round-trip and malformed headers, padding, wrapping, lengths, and digests reject.
- `npm run test:unknown-sender` -> valid but unfamiliar senders decrypt with warning state.

Acceptance checklist:

- Hybrid encapsulation is strict and internal-only helpers are preserved.
- Task 8 exclusively owns every PPXT codec, inner/outer payload, armor, fixture, and hybrid-helper integration path.
- Text armor round-trips exactly and rejects non-canonical input.
- Unknown-sender handling is explicit and safe.

Future commit message:

- `feat: add hybrid text encryption flow`

## 9) Implement PPXF codecs, chunking, AAD, nonces, terminal manifest, and golden fixtures

Prerequisites:

- Task 8 complete.
- File handling must obey the bounded memory and no-output-before-validation rules.

Create/modify/test paths:

- Create: `src/protocol/ppxf.ts`, `src/crypto/file.ts`, `fixtures/protocol/ppxf/*.bin`, `fixtures/files/*`.
- Modify: `src/crypto/provider.ts` only for PPXF helper integration through the existing provider boundary.
- Test: `src/tests/unit/ppxf.test.ts`, `src/tests/unit/ppx-golden.test.ts`, `src/tests/property/ppxf-roundtrip.property.test.ts`, `src/tests/property/file-chunks.property.test.ts`, `src/tests/unit/file-order.test.ts`, `src/tests/unit/file-manifest.test.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: reject invalid chunk indexes, bad manifest signatures, and bad total file lengths before any preview is shown.
- [ ] Verify-fail: confirm truncated or reordered chunk sets fail validation.
- [ ] Implement: model the file header, chunk records, and terminal manifest exactly, including AAD and the terminal `0xffffffff` chunk index.
- [ ] Verify-pass: confirm golden fixtures, chunk digest checks, and manifest validation all pass.

Key interfaces:

```ts
export interface FileHeader {
  magic: 'PPXF';
  formatVersion: 0x01;
  suite: 0x01;
  flags: 0;
  recipientId: Uint8Array;
  mlKemCiphertext: Uint8Array;
  ephemeralX25519PublicKey: Uint8Array;
  noncePrefix: Uint8Array;
  salt: Uint8Array;
  declaredChunkCount: number;
  chunkSize: 1048576;
  totalFileLength: bigint;
}

export interface ChunkRecord {
  chunkIndex: number;
  plaintextLength: number;
  ciphertext: Uint8Array;
}

export interface FileManifest {
  magic: 'PPXF';
  formatVersion: 0x01;
  suite: 0x01;
  chunkIndex: 0xffffffff;
  senderContact: PublicContact;
  recipientId: Uint8Array;
  filename: string;
  mimeHint: string;
  caption: string;
  fileLength: bigint;
  chunkCount: number;
  fullPlaintextDigest: Uint8Array;
  signature: Uint8Array;
}

export interface EncryptedManifestRecord {
  chunkIndex: 0xffffffff;
  plaintextLength: number;
  ciphertext: Uint8Array;
}

export interface EncryptedFileObject {
  header: FileHeader;
  chunks: ChunkRecord[];
  manifest: EncryptedManifestRecord;
  checksum: Uint8Array;
}
```

Exact file rules:

- Files are chunked at `1048576` bytes.
- File size range is `0..104857600` bytes.
- Filename and caption normalization must be strict and canonical.
- No preview or download is allowed until all chunks, the final manifest, digest, and signature validate.
- AAD binds the immutable outer header, chunk index, plaintext length, declared chunk count, and total file length.
- The fixed header is exactly 884 bytes and contains all public hybrid encapsulation values.
- Every record contains index, plaintext length, ciphertext length, and ciphertext plus tag.
- The encrypted terminal record is last at `0xffffffff`; manifest plaintext is capped at 18000 bytes.
- The trailing checksum is `SHA-512(canonicalHeader || allCanonicalDataRecords || canonicalTerminalRecord)[0..16)`.

Exact commands and expected outcomes:

- `npm run unit -- ppxf` -> all canonical file fixtures pass.
- `npm run test:ppx-golden` -> the complete PPXC/PPXV/PPXR/PPXT/PPXF golden set matches canonical fixtures.
- `npm run test:chunks` -> chunk construction and reassembly follow the PPXF contract.
- `npm run test:order` -> reordered, repeated, or missing chunks reject.
- `npm run test:manifest` -> manifest commitment and signature validation are correct.

Acceptance checklist:

- File encryption is bounded-memory and exact.
- Manifest validation is terminal and mandatory.
- File object golden fixtures exist.

Future commit message:

- `feat: add file object codec and manifest validation`

## 10) Implement file workers, progress, cancel, bounded memory, and zero output before validation

Prerequisites:

- Task 9 complete.
- Worker boundaries must remain explicit.

Create/modify/test paths:

- Create: `src/workers/file-worker.ts`, `src/workers/shared.ts`, `src/workers/crypto-worker.ts`, `src/flows/encrypt/file.ts`, `src/flows/decrypt/file.ts`, `src/components/feedback/progress.tsx`.
- Modify: `src/crypto/file.ts` to expose bounded worker operations without changing the worker contract types.
- Test: `src/tests/unit/file-worker.test.ts`, `src/tests/property/file-boundary.property.test.ts`, `src/tests/e2e/file-cancel.spec.ts`, `src/tests/unit/memory-budget.test.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: confirm the worker does not emit usable output before validation finishes.
- [ ] Verify-fail: cancel a long file job mid-stream and confirm partial output is discarded.
- [ ] Implement: import `PPXWorkerRequest` and `PPXWorkerEvent` from `src/crypto/contracts.ts`, stream via `Blob.slice`, keep memory bounded, dispatch only on `kind`, preserve `requestId`, emit the exact `stage` values, return only safe `code` errors, and emit the authoritative `completed` or `cancelled` events.
- [ ] Verify-pass: exercise 0-byte, 1-byte, boundary, and 100 MiB files and verify correct behavior.

Authoritative contract use:

```ts
import type { PPXWorkerEvent, PPXWorkerRequest } from '../crypto/contracts';

export function handleWorkerRequest(
  request: PPXWorkerRequest,
  emit: (event: PPXWorkerEvent) => void,
): Promise<void>;
```

Task 10 must not define `WorkerProgressMessage`, `WorkerCancelMessage`, or any competing worker-message interface. It consumes the exact Task 3 unions unchanged.

Exact behavior:

- File operations restart from the beginning after interruption.
- The worker does not hoard plaintext copies.
- `Cancel` safely stops the current operation.
- Zero output before validation is a hard rule, not a suggestion.

Exact commands and expected outcomes:

- `npm run unit -- file-worker` -> progress, cancel, and memory-bounded path checks pass.
- `npm run test:file-limits` -> 0/1/boundary/100 MiB constraints are enforced.

Acceptance checklist:

- Worker boundaries are real.
- Every request/event uses the authoritative `kind`, `requestId`, `stage`, safe error, `completed`, and `cancelled` contract from `src/crypto/contracts.ts`.
- Progress is meaningful.
- Cancel discards partial output and never leaks invalid artifacts.

Future commit message:

- `feat: add bounded file workers`

## 11) Implement IndexedDB contacts, vault, settings, session-only fallback, and erase-all

Prerequisites:

- Task 10 complete.
- Storage behavior must be reversible, minimal, and session-safe when persistent storage is denied.

Create/modify/test paths:

- Create: `src/storage/db.ts`, `src/storage/contacts.ts`, `src/storage/vault.ts`, `src/storage/settings.ts`, `src/storage/session.ts`, `src/storage/erase.ts`.
- Modify: `src/app/state.ts` to expose storage mode and erase-all state without introducing UI flows early.
- Test: `src/tests/unit/storage.test.ts`, `src/tests/e2e/session-only.spec.ts`, `src/tests/e2e/erase-all.spec.ts`, `src/tests/unit/migration.test.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: deny storage access and confirm the app still works in session-only mode.
- [ ] Verify-fail: confirm no plaintext identity, decrypted file cache, or message history is ever persisted.
- [ ] Implement: store only public contacts, encrypted vaults, and user-approved local settings, with granular delete and erase-all.
- [ ] Verify-pass: run storage migrations and confirm idempotent contact merge behavior.

Key interfaces:

```ts
export interface StorageState {
  mode: 'persistent' | 'session-only';
  hasVault: boolean;
  contactCount: number;
  locale: 'en' | 'de';
}
```

Exact behavior:

- Public contacts persist by default unless the user chooses session-only or deletes them.
- The session-only path must work when storage is unavailable or denied.
- Repeat import of the same key merges rather than duplicates.
- Same pseudonym with different keys warns and remains separate.
- Local nicknames are private to the device.
- Confirmed erase-all removes contacts, vault, and local settings.

Exact commands and expected outcomes:

- `npm run test:storage` -> persistent and denied-storage paths behave correctly.
- `npm run test:session-only` -> session-only leaves no durable data.

Acceptance checklist:

- Storage schema is explicit and migratable.
- Denied storage does not break core operation.
- No history is stored.

Future commit message:

- `feat: add contacts, vault, and session storage`

## 12) Implement identity session behavior, auto-lock, clipboard best effort, and app state

Prerequisites:

- Task 11 complete.
- Identity state must remain locally bounded and lockable.

Create/modify/test paths:

- Create: `src/flows/identity/session.ts`, `src/flows/identity/clipboard.ts`, `src/flows/identity/lock.ts`, `src/components/dialogs/lock-warning.tsx`.
- Modify: `src/app/state.ts`.
- Test: `src/tests/unit/identity-session.test.ts`, `src/tests/e2e/auto-lock.spec.ts`, `src/tests/unit/clipboard-best-effort.test.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: ensure auto-lock is absent before implementation and then add it as a deliberate state transition.
- [ ] Verify-fail: confirm clipboard clearing is best effort only and never treated as guaranteed deletion.
- [ ] Implement: track active identity state, idle lock timing, clipboard copy/clear signals, and unlock relays.
- [ ] Verify-pass: ensure the state machine preserves the first-operational destination and lock behavior.

Key interfaces:

```ts
export interface IdentitySessionState {
  unlocked: boolean;
  activeIdentityId: Uint8Array | null;
  lockScheduledAt: bigint | null;
  clipboardClearAt: bigint | null;
}
```

Exact behavior:

- Lock now is explicit.
- Clipboard clearing is best effort after 60 seconds.
- No secure deletion guarantee may be claimed.
- The app must keep a coherent state machine for open decrypted content, active identity, and update banners.

Exact commands and expected outcomes:

- `npm run unit -- identity-session` -> lock, unlock, and state transitions pass.
- `npm run unit -- clipboard-best-effort` -> copy and clear policies behave as documented.

Acceptance checklist:

- Identity session state is explicit.
- Auto-lock is predictable and testable.
- Clipboard policy stays honest and minimal.

Future commit message:

- `feat: add identity session and auto-lock state`

## 13) Implement i18n EN/DE keyed resources, accessibility-safe components, responsive shell, and navigation state

Prerequisites:

- Task 12 complete.
- Visual styling follows the approved Apple-like mobile/desktop specification;
  semantics, accessibility, reflow, reduced motion, and contrast remain hard
  gates.

Create/modify/test paths:

- Create: `src/components/forms/*`, `src/components/feedback/live-region.tsx`, `src/components/feedback/error-summary.tsx`.
- Modify: `src/i18n/index.ts`, `src/i18n/en.ts`, `src/i18n/de.ts`, `src/i18n/keys.ts`, `src/i18n/format.ts`, `src/components/navigation/*`, `src/app/App.tsx`, `src/app/state.ts`, `src/components/feedback/progress.tsx`.
- Test: `src/tests/accessibility/i18n.test.ts`, `src/tests/unit/i18n.test.ts`, `src/tests/e2e/locale-switch.spec.ts`, `src/tests/e2e/en-de.spec.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: remove a required locale key and confirm the keyed resource system fails safely.
- [ ] Verify-fail: confirm English and German warnings are semantically equivalent and not silently softened.
- [ ] Implement: add keyed resource lookup, locale formatting, accessible component primitives, and responsive navigation state.
- [ ] Verify-pass: confirm `html lang` updates, locale switching works, and the mobile/desktop navigation structure matches the docs.

Key interfaces:

```ts
export type Locale = 'en' | 'de';

export interface I18nBundle {
  locale: Locale;
  t: <K extends keyof MessageKeys>(key: K, params?: MessageParams<K>) => string;
}
```

Exact behavior:

- English is fallback.
- German uses informal `du`.
- All user-visible strings come from keyed resources.
- Protocol strings and magic values remain untranslated.
- The accessibility layer must support keyboard complete operation, screen readers, 200% zoom, reduced motion, and visible focus.

Exact commands and expected outcomes:

- `npm run test:i18n` -> copy parity and fallback rules pass.
- `npm run test:en-de` -> complete English and German Playwright flows remain semantically aligned.
- `npm run test:accessibility` -> semantic component behavior is still reachable by keyboard and assistive tech.

Acceptance checklist:

- EN/DE keyed resources are complete and aligned.
- Responsive shell is semantic and accessible.
- Visual polish must conform to the approved Apple-inspired visual spec.

Future commit message:

- `feat: add localization and accessible shell scaffolding`

## 14) Implement identity and contacts UI flows, including PPXV/PPXR, words, confirmation, remember choice, QR imports, collisions, deletion, and advanced fingerprint

Prerequisites:

- Task 13 complete.
- Semantic danger styling for private export surfaces must remain obvious.

Create/modify/test paths:

- Create: `src/flows/identity/create.tsx`, `src/flows/identity/import.tsx`, `src/flows/contacts/manage.tsx`, `src/components/cards/contact-management-card.tsx`, `src/components/dialogs/confirmation.tsx`.
- Modify: `src/components/cards/public-contact-card.tsx`, `src/components/cards/private-export-card.tsx`, `src/i18n/en.ts`, `src/i18n/de.ts` for final flow text and helper text.
- Test: `src/tests/e2e/identity-create.spec.ts`, `src/tests/e2e/identity-import.spec.ts`, `src/tests/e2e/contacts.spec.ts`, `src/tests/unit/contact-collision.test.ts`, `src/tests/accessibility/identity-flow.test.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: confirm the UI does not allow finishing identity setup without exporting recovery material.
- [ ] Verify-fail: ensure the keyboard/switch export confirmation path is equally deliberate and not time-based.
- [ ] Implement: build the create/import flows for `PPXV`, `PPXR`, and 24 words, with remember choice, collision warnings, and delete flows.
- [ ] Verify-pass: confirm public contact display shows pseudonym above QR and that advanced fingerprint search works.

Key flow rules:

- Create identity or import identity is the first screen.
- The recovery export is mandatory before setup can finish.
- The UI must ask separately whether to remember the private identity locally.
- If storage is unavailable, session-only fallback is automatic.
- Public contacts are imported in Contacts.
- The user can delete a contact, delete a vault, or erase everything.

Exact commands and expected outcomes:

- `npm run test:e2e -- src/tests/e2e/identity-create.spec.ts` -> create flow forces recovery export and remember choice.
- `npm run test:e2e -- src/tests/e2e/identity-import.spec.ts` -> locked vault, PPXR, and recovery words all import correctly.
- `npm run test:e2e -- src/tests/e2e/contacts.spec.ts` -> merge, nickname, delete, and fingerprint-search UI paths pass.
- `npm run unit -- contact-collision` -> deterministic collision and merge rules pass in Vitest.

Acceptance checklist:

- Identity setup is impossible to finish without recovery export.
- Imports are exact and collision-safe.
- Contact management is complete and non-destructive by default.

Future commit message:

- `feat: add identity and contacts flows`

## 15) Implement encrypt/decrypt text and file flows, smart input, unknown sender, media preview/download, and Blob URL cleanup

Prerequisites:

- Task 14 complete.
- Decrypt must route smart input safely before revealing content.

Create/modify/test paths:

- Create: `src/flows/encrypt/text.tsx`, `src/flows/encrypt/file.tsx`, `src/flows/decrypt/index.tsx`, `src/components/media/*`.
- Modify: `src/flows/decrypt/classify.ts`, `src/flows/encrypt/file.ts`, `src/flows/decrypt/file.ts`, `src/components/feedback/progress.tsx`.
- Test: `src/tests/e2e/encrypt-text.spec.ts`, `src/tests/e2e/encrypt-file.spec.ts`, `src/tests/e2e/decrypt-smart-input.spec.ts`, `src/tests/unit/blob-url-cleanup.test.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: confirm smart input does not misroute or reveal plaintext before validation completes.
- [ ] Verify-fail: ensure unknown sender produces the explicit warning after valid decryption.
- [ ] Implement: build recipient selection, text/file encryption, decrypt routing, media preview gating, and Blob URL revocation.
- [ ] Verify-pass: confirm the correct UI handles images, audio, video, and safe-download-only documents.

Key interfaces and limits:

```ts
export interface EncryptTextInput {
  sender: PublicContact;
  senderSigningCapability: SenderSigningCapability;
  recipient: PublicContact;
  plaintext: string;
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
}

export interface EncryptFileInput {
  sender: PublicContact;
  senderSigningCapability: SenderSigningCapability;
  recipient: PublicContact;
  file: Blob;
  filename: string;
  mimeHint: string;
  caption: string;
  fileLength: bigint;
}
```

Exact behavior:

- Text plaintext limit is `256 KiB`.
- File size limit is `100 MiB`.
- Caption optional limit is `16 KiB`.
- Images may preview only after full authentication.
- Audio and video may preview only after full authentication and must stay contained.
- Documents and unsupported media use safe download only.
- Blob URLs must be revoked after use.

Exact commands and expected outcomes:

- `npm run test:e2e -- src/tests/e2e/encrypt-text.spec.ts` -> recipient selection and armored output behave correctly.
- `npm run test:e2e -- src/tests/e2e/encrypt-file.spec.ts` -> file encryption round-trips and restarts from scratch on interruption.
- `npm run test:e2e -- src/tests/e2e/decrypt-smart-input.spec.ts` -> text/file routing is automatic and safe.
- `npm run unit -- blob-url-cleanup` -> the Vitest lifecycle test proves every preview/download object URL is revoked.

Acceptance checklist:

- Text and file flows satisfy all limits and warnings.
- Unknown sender semantics are explicit.
- Media handling remains safe and bounded.

Future commit message:

- `feat: add encrypt and decrypt workflows`

## 16) Implement Help/About/diagnostics/chat-control explainer/offline PWA/GitHub Pages Actions/meta CSP/update prompt/no network

Prerequisites:

- Task 15 complete.
- Diagnostics must stay local until user review.

Create/modify/test paths:

- Create: `src/flows/help/*`, `src/diagnostics/*`, `src/sw/*`, `.github/workflows/ci.yml`, `.github/workflows/pages.yml`, `.github/workflows/release.yml`, `.github/workflows/security-review.yml`, `public/robots.txt`, `SECURITY.md`, `CONTRIBUTING.md`, `scripts/verify-release.ts`, `scripts/build-sbom.ts`, `scripts/package-release.ts`, `scripts/check-reproducibility.ts`, `scripts/check-dependencies.ts`.
- Modify: `public/manifest.webmanifest`, `README.md`, `src/app/bootstrap.ts`.
- Test: `src/tests/e2e/help-diagnostics.spec.ts`, `src/tests/release/offline.spec.ts`, `src/tests/release/update-banner.spec.ts`, `src/tests/release/network-denial.spec.ts`.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: confirm diagnostics are not auto-submitted and the help surface does not claim remote support.
- [ ] Verify-fail: ensure the service worker caches only the app shell and versioned static assets.
- [ ] Implement: add the help/about/diagnostics flow, the chat-control explainer entry, offline update banners, and GitHub Pages workflow support.
- [ ] Verify-pass: confirm the meta CSP baseline, hash routing, and offline behavior are consistent with the hosting contract.

Key interfaces:

```ts
export interface DiagnosticsReport {
  appVersion: string;
  locale: 'en' | 'de';
  storageMode: 'persistent' | 'session-only';
  capabilities: string[];
  sanitizedErrors: string[];
}
```

Exact behavior:

- The app must never auto-submit diagnostics.
- The user must review diagnostics before any GitHub issue draft is opened.
- The update banner text must match `A newer version is available.` and the German equivalent.
- The service worker must never cache user data, decrypted content, recovery material, imported files, or diagnostics waiting for review.
- `connect-src` is self only, no network telemetry.

Exact commands and expected outcomes:

- `npm run test:offline` -> app shell and versioned assets remain usable offline after first load.
- `npm run test:update-banner` -> update prompt appears only in the safe state.
- `npm run test:network-denial` -> the app fails safely and stays usable where designed.
- `npm run test:release` -> Pages contract and provenance checks are consistent.

Acceptance checklist:

- Help/About/diagnostics is local-first and review-first.
- Offline caching is versioned and minimal.
- GitHub Pages deployment contract is encoded in workflows and meta CSP.

Future commit message:

- `feat: add help, diagnostics, offline, and deployment scaffolding`

## 17) Execute hardening: fuzz 100k, mutations, QR/device matrix, accessibility, performance, memory, network denial, SBOM, reproducible release, signed tag, and beta/stable gates

Prerequisites:

- Task 16 complete.
- Release-level evidence must be reproducible and auditable.

Create/modify/test paths:

- Modify: `scripts/verify-release.ts`, `scripts/build-sbom.ts`, `scripts/package-release.ts`, `.github/workflows/release.yml`, `.github/workflows/security-review.yml`.
- Create: `src/tests/property/parser-roundtrip.property.test.ts`, `src/tests/property/fuzz-100k.property.test.ts`, `src/tests/property/mutation.property.test.ts`, `src/tests/property/truncation.property.test.ts`, `src/tests/property/boundary.property.test.ts`, `src/tests/release/device-matrix.spec.ts`, `src/tests/release/performance.spec.ts`.
- Test: the full release command set and release evidence outputs.

Fail-test / verify-fail / implement / verify-pass:

- [ ] Fail-test: run the future fuzz, mutation, QR degradation, accessibility, and release gates before the hardening work exists and confirm failures are meaningful.
- [ ] Verify-fail: confirm invalid objects fail closed across every parser and decryption path.
- [ ] Implement: add 100k-case fuzz coverage, mutation coverage, QR/device matrix coverage, accessibility automation, memory/performance checks, SBOM generation, reproducibility checks, and release gates.
- [ ] Verify-pass: confirm the release path can produce a signed, reproducible, provenance-backed beta artifact and that stable remains explicitly unavailable.

Key release contract:

- Public beta is the target.
- Stable is not available yet.
- A stable promotion requires independent review and explicit approval.
- Any change to pinned dependency versions requires security review.
- Reproducibility evidence must include commit SHA, build log, artifact hash, SBOM, and rollback pointer.

Exact commands and expected outcomes:

- `npm run test:parser-property` -> strict parser round-trip and rejection properties hold across every PPX object family.
- `npm run test:parser-fuzz` -> 100000 cases complete without crashes or unsafe accepts.
- `npm run test:mutations` -> corrupted objects fail safely.
- `npm run test:truncations` -> every shortened canonical object rejects safely.
- `npm run test:boundaries` -> all declared size, count, version, and suite boundaries are enforced.
- `npm run test:qr-degradation` -> damaged QR payloads fail closed.
- `npm run test:accessibility` -> keyboard, screen reader, zoom, focus, and contrast checks pass.
- `npm run test:release` -> release metadata and provenance are internally consistent.
- `npm run test:sbom` -> SBOM is generated and stored with the release record.
- `npm run test:reproducibility` -> rebuild hash matches recorded source state where supported.
- `npm run test:dependency-review` -> dependency set is reviewed before shipping.

Acceptance checklist:

- Hardening gates exist and are meaningful.
- Release evidence is complete and reproducible.
- Beta/stable separation remains explicit.

Future commit message:

- `chore: harden release gates and evidence`

# 6. Verification command order

The intended command order for implementation and final verification is:

1. `npm install`
2. `npm run docs:check`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run format:check`
6. `npm run unit`
7. `npm run test`
8. `npm run test:primitive-vectors`
9. `npm run test:provider-contract`
10. `npm run test:bip39`
11. `npm run test:ppx-golden`
12. `npm run test:parser-property`
13. `npm run test:parser-fuzz`
14. `npm run test:mutations`
15. `npm run test:truncations`
16. `npm run test:boundaries`
17. `npm run test:qr-degradation`
18. `npm run test:storage`
19. `npm run test:session-only`
20. `npm run test:chunks`
21. `npm run test:order`
22. `npm run test:manifest`
23. `npm run test:file-limits`
24. `npm run test:cancel`
25. `npm run test:memory`
26. `npm run test:en-de`
27. `npm run test:e2e`
28. `npm run test:unknown-sender`
29. `npm run test:accessibility`
30. `npm run test:i18n`
31. `npm run test:offline`
32. `npm run test:update-banner`
33. `npm run test:network-denial`
34. `npm run test:release`
35. `npm run test:sbom`
36. `npm run test:reproducibility`
37. `npm run test:dependency-review`
38. `npm run build`
39. `npm run verify`

Expected outcome:

- The command order should move from scaffold validation to protocol correctness, then product flows, then accessibility and release readiness.
- No command in this list should be considered complete until its corresponding tests and fixtures exist.
- The final `npm run verify` reruns the complete scripted gate and must exit zero without skipping any missing suite.

# 7. Manual device and release checklist

This checklist is part of the implementation plan because the product target includes mobile, desktop, and static Pages deployment.

Manual device checks:

- Desktop Chromium current stable.
- Desktop Firefox current stable.
- Mobile Chromium-based browser on a current device or emulation target.
- Mobile zoom at 200%.
- Reduced motion enabled.
- Screen reader pass on at least one desktop path.
- Keyboard-only pass for identity create, identity import, encrypt, decrypt, and delete flows.

Manual release checks:

- Confirm the app is served from a repository subpath and hash routing still works.
- Confirm the service worker caches only the app shell and versioned assets.
- Confirm the update banner is shown safely and does not interrupt decrypt or visible plaintext.
- Confirm the generated SBOM matches the recorded artifact.
- Confirm the release record includes commit SHA, build log, artifact hash, release tag, and rollback target.
- Confirm diagnostics require user review before any GitHub issue draft is opened.

# 8. Requirement-to-task traceability

| Requirement area | Task(s) |
|---|---|
| Repo bootstrap, docs baseline, scripts, and init gate | 0 |
| Shell, routing, quality gates, no remote URLs | 1 |
| Bytes, normalization, Base45, base64url | 2 |
| CryptoProvider, primitives, vectors | 3 |
| Identity derivation, BIP39 recovery words | 4 |
| PPXC codec, QR capacity | 5 |
| PPXV/PPXR, vault failures | 6 |
| QR generation/scanning/classification, degradation fixtures, card semantics | 7 |
| PPXT codec, fixtures, armor, hybrid encapsulation, and text inner/outer contract | 8 |
| PPXF codecs, chunking, manifest | 9 |
| File workers, cancel, bounded memory | 10 |
| Storage, session-only, erase-all | 11 |
| Identity session, auto-lock, clipboard | 12 |
| i18n, accessible shell, navigation | 13 |
| Identity and contacts UI flows | 14 |
| Encrypt/decrypt flows, media, Blob cleanup | 15 |
| Help/About, diagnostics, offline, deployment, CSP | 16 |
| Hardening, fuzz, release evidence, beta/stable gates | 17 |

# 9. Self-review checklist

Before declaring implementation complete, review this plan and the resulting code against the following:

- Every normative term from the docs package is preserved.
- Every exact protocol limit is represented in code and tests.
- Every public interface uses the exact names required by the security and protocol docs.
- No task relies on an unstated design choice.
- No task assumes remote services, telemetry, or backend behavior.
- No unresolved implementation marker or placeholder remains in protocol, crypto, storage, worker, or release code.
- Every locale string exists in EN and DE where user-visible.
- Accessibility semantics survive the lack of a visual spec.
- The release plan still treats stable as unavailable.
- Security review is required for any exact dependency pin change.

Staged scaffolding allowed only before the corresponding task is implemented:

- Shell components with semantic stub content.
- Style tokens pending approved visual examples.
- Release workflow files without final publication details.

Omissions that are not acceptable:

- Missing protocol limits.
- Missing error unions.
- Missing recovery word rules.
- Missing storage fallback behavior.
- Missing accessibility warnings.
- Missing release evidence requirements.

Plan self-review result after the final specification audit:

- Placeholder scan: no unresolved marker, unnamed handler, or unspecified protocol/worker/release step remains in the plan; staged shell content is explicitly bounded above.
- Type scan: `PublicContact`, `PPXWorkerRequest`, `PPXWorkerEvent`, and `PPXSafeWorkerError` use the exact authoritative names and discriminants.
- Command scan: every normative script is declared in Task 0, `test` is composite-only, filtered Vitest invocations use `npm run unit -- <filter>`, and `verify` is the full gate.
- Create-path scan: every planned path has one creation owner; all later tasks use `Modify:` for that path.

# 10. Execution handoff

Implementation agents should treat this plan as the working queue, not as a narrative summary.

Recommended work order:

1. Start with tasks 0-3 to establish the scaffold, codecs, and crypto boundary.
2. Complete tasks 4-9 before wiring product flows.
3. Complete tasks 10-12 before expanding UI state handling.
4. Complete tasks 13-16 before release and deployment work.
5. Finish with task 17 and the release evidence pass.

If a future implementation step reveals a conflict with the normative docs, stop and resolve the docs or the implementation contract before continuing.

Visual-styling constraint reminder:

- Functional and accessibility scaffolding can proceed now.
- Final visual styling cannot be declared complete until the user provides a separate approved visual spec from user examples.

DONE
