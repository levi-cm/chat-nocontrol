# 00 — Recon map (scan-1)

**Scan:** `pen-test-deep-scan/new/scan-1`
**Date:** 2026-07-16
**Commit:** `328a20f` ("fix: preserve explicit contact mutation intent")
**Runner model:** `glm-5.2`

## File counts per bucket

| Bucket | Files | LoC proxy |
|--------|-------|-----------|
| C1 Crypto core (`src/crypto`, `src/workers`, `src/protocol`) | 44 | — |
| A1 App/UI/state (`src/app`, `src/components`, `src/flows`, `src/i18n`, `index.html`) | 61 | — |
| A2 Persistence/runtime (`src/storage`, `src/sw`, `src/diagnostics`, `public`, `vite.config.ts`) | 10 | — |
| S1 Supply chain (`scripts`, `.github`, configs, `package*.json`, `fixtures`, review/release evidence) | 28 | — |
| S2 Tests (`src/tests/**`) | 130 | — |
| `docs/**` | 27 md + `superpowers/{plans,specs}` | — |
| **Total TS/TSX in `src/`** | **248** | — |

## Subsystem → file list → entry points → trust boundaries

### C1 Crypto core — `src/crypto/**`, `src/workers/**`, `src/protocol/**`

Files:
- `src/crypto/`: `contracts.ts`, `default-provider.ts`, `file.ts`, `hybrid.ts`, `identity.ts`, `noble-provider.ts`, `provider.ts`, `qr-text.ts`, `recovery-words.ts`, `text-compression.ts`, `text.ts`, `vault.ts`, `webcrypto.ts`, `zeroize.ts`
- `src/workers/`: `crypto-client.ts`, `crypto-runner.ts`, `crypto-worker.ts`, `file-client.ts`, `file-runner.ts`, `file-worker.ts`, `scan-client.ts`, `scan-runner.ts`, `scan-worker.ts`
- `src/protocol/`: `base37.ts`, `base45.ts`, `base64url.ts`, `bytes.ts`, `checksum.ts`, `message-link.ts`, `ppxc.ts`, `ppxf-header.ts`, `ppxf-manifest.ts`, `ppxf.ts`, `ppxq-inner.ts`, `ppxq-outer.ts`, `ppxq.ts`, `ppxr.ts`, `ppxt-armor.ts`, `ppxt-inner.ts`, `ppxt-outer.ts`, `ppxt.ts`, `ppxv.ts`, `text.ts`, `types.ts`

Entry points: `CryptoProvider` impls (`default-provider`, `noble-provider`, `webcrypto`); worker message handlers (`crypto-runner`, `file-runner`, `scan-runner`); protocol parse/serialize (`ppx*`).
Trust boundaries: worker ↔ main-thread message contract (`PPXWorkerRequest`/`PPXWorkerEvent`); provider abstraction (`provider.ts`); canonical parser strictness (`ppx*`); AEAD/AAD binding; checksum-vs-MAC.

### C2 Protocol binary — `src/protocol/ppx*`, `fixtures/**`

Files: see C1 protocol list + `fixtures/protocol/golden-v1.json`, `golden-v1-ppxq.json`, `golden-v2-ppxt.json`, `ppxf-v1.json`; `fixtures/qr/*.png`, `manifest.json`; `fixtures/crypto/nist-acvp-ml-kem-512.json`, `primitive-vectors.json`.
Entry points: every `parse*`/`serialize*` fn; `bytes.ts` `DataView`/`Uint8Array` helpers; `base37/45/64url` codecs; `checksum.ts`; `ppxt-armor`; `ppxf-header`/`ppxf-manifest`; `ppxq-inner/outer`; `ppxt-inner/outer`; `message-link.ts`.
Trust boundaries: length-field parsing, offset bounds, version/suite/flags checks, checksum-before-parse vs MAC-before-parse, base45 QR size, armor delimiters, inner/outer split, replay (nonce/timestamp/counter/messageId).

### A1 App/UI/state — `src/app/**`, `src/components/**`, `src/flows/**`, `src/i18n/**`, `index.html`

Files: `src/app/` (App, auto-lock, bootstrap, build-info, canonical-app-base, contact-save-queue, incoming-intent, incoming-link-input, root, routes, runtime-support, state, unsupported-environment); `src/components/{cards,dialogs,feedback,forms,media,navigation,qr}/*`; `src/flows/{contacts,decrypt,encrypt,help,identity,settings}/*`; `src/i18n/{de,en,format,index,keys}.ts`; `index.html`.
Entry points: route handlers (`routes.ts`), `bootstrap.ts`, `incoming-intent.ts` (URL fragment), QR import/scan (`components/qr/*`), clipboard (`flows/identity/clipboard.ts`), recovery PDF (`recovery-pdf*`), auto-lock.
Trust boundaries: DOM render (XSS, `dangerouslySetInnerHTML`, `innerHTML`, blob/data URLs), `postMessage`/BroadcastChannel, i18n interpolation, incoming link fragment parsing, prototype pollution via `JSON.parse`+merge, TOCTOU on storage, race conditions in async encrypt/decrypt, cancellation leaking partial plaintext.

### A2 Persistence/runtime — `src/storage/**`, `src/sw/**`, `src/diagnostics/**`, PWA manifest, `vite.config.ts`

Files: `src/storage/{contacts,db,erase,session,settings,vault}.ts`; `src/sw/cache-policy.ts` (only file — SW registration likely via `vite-plugin-pwa` config in `vite.config.ts`); `src/diagnostics/{issue-link,report,sanitize}.ts`; `public/manifest.webmanifest`, `public/robots.txt`, `public/icons/*`; `vite.config.ts`.
Entry points: IndexedDB stores (`db.ts`), vault read/write (`vault.ts`), contacts (`contacts.ts`), session/settings, SW cache policy, diagnostics report/sanitize.
Trust boundaries: secrets in `localStorage`/`sessionStorage`, unencrypted IndexedDB vault, cross-origin access, SW cache poisoning of JS/HTML, update/activation race (recent PWA auto-update commits), diagnostics logging plaintext/keys/headers, PWA `start_url`/`scope`.

### S1 Supply chain/build/CI — `package.json`, `package-lock.json`, `scripts/**`, `.github/**`, configs, review/release evidence

Files: `scripts/{approved-dependencies.json, benchmark-text-compression, build-sbom, check-crypto-provider-contract, check-dependencies, check-doc-terminology, check-ppxf-contract, check-release-prerequisites, check-reproducibility, dev-tailscale, finalize-pages-deployment, generate-protocol-goldens, generate-qr-fixtures, generate-vectors, github-deployment-evidence, independent-review-evidence, package-release, production-artifacts, register-eslint-typescript.cjs, release-evidence, render-recovery-pdf-fixture, sync-nist-mlkem-vector, verify-release, write-test-report}.ts`; `.github/workflows/{ci,release,security-review}.yml`; `.github/allowed_signers`; `eslint.config.js`; `tsconfig*.json`; `playwright.config.ts`; `vitest.config.ts`; `.npmrc`; `docs/deployed-releases.json`; `docs/independent-security-review.example.json`.
Entry points: CI workflows (ci/release/security-review), release gate scripts (`check-release-prerequisites`, `independent-review-evidence`, `verify-release`, `check-reproducibility`, `build-sbom`), dependency gate (`check-dependencies`, `approved-dependencies.json`), build (`vite.config.ts`, `production-artifacts`).
Trust boundaries: lockfile integrity vs `package.json` drift, approved-dependency gate bypass, release-gate self-forged review, reproducibility, secrets in repo, CI `permissions:`/`pull_request_target`/shell injection.

### S2 Tests/spec-drift — `src/tests/**`, `docs/**` vs `src/**`

Files: 130 test files across `unit/`, `property/`, `e2e/`, `accessibility/`, `release/`, `helpers/`.
Entry points: property/fuzz invariants (`parser-roundtrip`, `fuzz-100k`, `mutation`, `truncation`, `boundary`, `file-*`, `ppx*-roundtrip`, `recovery-roundtrip`, `vault-roundtrip`, `qr-*`); release tests (`device-matrix`, `final-qa`, `network-denial`, `offline`, `performance`, `pwa-update`); unit protocol/crypt/id/flow tests.
Trust boundaries: which invariants are *not* asserted (nonce uniqueness, large-payload/quota, malformed round-trip), golden-vector self-generation, missing negative e2e paths (tampered ciphertext, swapped QR, downgrade), constant-time assertion gaps.

## Trust-boundary summary (cross-cutting)

1. **MAC-before-parse** vs **parse-before-MAC** in every `ppx*` parser — recurse across `ppxt`, `ppxf`, `ppxq`, `ppxc`, `ppxr`, `ppxv`.
2. **Worker message contract** — only sanctioned `PPXWorkerRequest`/`PPXWorkerEvent` shapes; structured-clone of untrusted data into workers.
3. **Provider abstraction** — `default/noble/webcrypto` provider swaps; algorithm/length checks.
4. **Checksum (CRC32C? SHA-512[0..16)) vs AEAD vs Ed25519** — confusion between transfer checksum and integrity/MAC.
5. **Inner/outer envelope** — outer header must leak no sender metadata; AAD must bind immutable header.
6. **Identity binding / QR exchange** — TOFU, fingerprint compare, MITM swap, replay.
7. **DOM render** — XSS via contact names, message bodies, filenames, QR text, i18n.
8. **Storage at rest** — vault encryption, secrets in `localStorage`/IndexedDB.
9. **SW cache** — JS/HTML poisoning on next load.
10. **Release gate** — self-forged review file, provenance binding.

## Prior-audit context (for regression check)

- `old/pen-test/OPEN-ISSUES.md`: OPEN-001 (Pages public exposure bypassing release gate — external state, not code), OPEN-002 (no source-to-artifact provenance — external state). RESOLVED-003 (source maps — fixed in tree).
- `old/pen-test-1/findings/`: CRIT-001 source maps (fixed in tree), HIGH-001 provenance mismatch (= OPEN-002), MED deployment/policy mismatch (= OPEN-001), MED CSP meta-not-header (Pages platform constraint), MED no-SRI (ineffective under full-deployment-compromise), LOW dangling sourceMappingURL (live preview only), LOW scrypt N=65536 conservative (documented residual), LOW no-constant-time fingerprint compare (**fixed**: `equalBytes` XOR-accumulates), INFO forward-secrecy/post-quantum-sigs/length-leak/secure-deletion (documented non-claims), INFO pdf-lib console.log (no app secret).
- **No prior code/crypto/protocol-level exploit finding exists.** This run is the first source-tree deep scan; prior audits were deployment/pipeline focused.
