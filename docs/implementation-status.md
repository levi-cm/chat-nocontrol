# Chat NoControl implementation status

> **Authority:** Non-normative implementation tracking; normative product, protocol, security, UX, and release documents take precedence.
> **Checked:** 2026-07-13 Europe/Berlin
> **Release state:** verified source candidate only. Public beta remains blocked by independent cryptographic review, signed release provenance, and an actual GitHub Pages deployment.

This file records execution status for Tasks 0-17 in
[`implementation-plan.md`](implementation-plan.md). Intentional path
consolidations are recorded in
[`implementation-substitutions.md`](implementation-substitutions.md). This file does not amend the
normative protocol or crypto contracts and does not convert a blocked gate into
a pass.

| Task | Status | Evidence or blocker |
| ---: | --- | --- |
| 0 | Complete | Repository scaffold, exact pins, docs checker, and ordered `verify` command exist. |
| 1 | Complete | Preact/Vite shell, hash routes, build, lint, typecheck, formatting, manifest, and PWA hook pass. |
| 2 | Complete | Strict byte, normalization, Base45, base64url, limit, property, mutation, truncation, and 100k fuzz tests pass. |
| 3 | Complete | Request-owned sender signing capability, provider-owned encapsulation, concrete provider, primitive vectors, and `CryptoProvider contract OK` pass. |
| 4 | Complete | Deterministic identity, fingerprints, 24-word recovery, import pseudonym normalization, and round trips pass. |
| 5 | Complete | PPXC serialization, parsing, signatures, cap, QR capacity, and fixtures pass. |
| 6 | Complete | PPXV/PPXR codecs, fixed vault parameters, round trips, and generic failures pass. |
| 7 | Complete | QR lifecycle, input bounds, bounded main-thread ZXing image decoding, worker classification, committed fixtures, degradation rejection, image import, and private/public classification pass. |
| 8 | Complete | PPXT inner/outer/armor, provider-owned hybrid behavior, request-scoped signing, unknown-sender UI, and round trips pass. |
| 9 | Complete | Exact 884-byte PPXF header, ordered records, encrypted terminal manifest, checksum, crypto round trips, mutations, limits, and conformance gate pass. |
| 10 | Complete | Dedicated typed file worker, progress, true cancellation with no completion, and one-plaintext-chunk retention tests pass. |
| 11 | Complete | IndexedDB/session fallback, partial-read/runtime-failure handling, settings, vault/contact deletion, and truthful erase-all behavior pass. |
| 12 | Complete | Active identity, pending-setup lock behavior, auto-lock, clipboard best effort, two-phase ownership, and failure-path zeroization pass. |
| 13 | Complete | EN/DE responsive shell, keyboard-complete flows, axe, ARIA snapshots, 200% zoom, focus, contrast, reduced motion, visual matrix, and a real Orca/AT-SPI Chromium keyboard traversal pass. |
| 14 | Complete | Identity/contact create/import/export, recovery guard, vault, QR/file/word imports, storage races, collisions, merge, search, and deletion flows pass. |
| 15 | Complete | Smart text/file routing, exact copy/download, authenticated preview, bad-signature/unknown-sender behavior, cancellation, limits, and Blob URL cleanup pass. |
| 16 | Complete (implementation) | Help/diagnostics, app-shell-only offline caching, safe update prompt, meta CSP, network denial, pinned Actions, and manual-only Pages workflow pass locally. Deployment is intentionally held behind Task 17 release gates. |
| 17 | Blocked for release | Candidate hardening is green, including 100k fuzz, all-family goldens, browser/accessibility/network matrices, real screen-reader traversal, dependency audit, SBOM, build, and deterministic archive. Public beta still requires an exact-HEAD independent review, signed tag/release provenance, and successful Pages deployment evidence. Implementation-team or AI review is not independent review. |

## Fresh source-candidate evidence

- `npm run verify:quality`: exited `0` on 2026-07-13 after every ordered candidate gate passed; report: `output/release/test-report.json`.
- `npm run unit`: 68 files, 168 tests passed with coverage.
- `npm run test:parser-fuzz`: 100,000 generated cases passed.
- `npm run test:e2e`: 335 tests passed across desktop/mobile Chromium, desktop Firefox, and desktop/mobile WebKit.
- `npm run test:accessibility`: 75 tests passed, including keyboard-only end-to-end operation, axe, reflow, reduced motion, touch targets, and 200% zoom automation.
- Real screen-reader check: Orca `50.2` consumed Chromium's live AT-SPI tree while OS-level Tab navigation announced the banner, language control, primary navigation, current page, and identity actions. Orca produced 176 speech-output records; the stopped raw debug log had SHA-256 `5bea68df79ca3b5c18c29f4260b48e88bb1d0f9674738d22e4ce245df2b7862f`. The headed desktop keyboard matrix also passed 7/7 while Orca was active.
- `npm run test:network-denial`: 15 tests passed.
- `npm run test:offline -- --reporter=dot`: 5 tests passed.
- `npm run test:update-banner`: 15 tests passed.
- `npm run test:session-only`: 60 tests passed.
- `npm run test:en-de`: 15 tests passed.
- `npm run test:dependency-review`: approved dependency pins and `npm audit --audit-level=high` passed with 0 high-severity vulnerabilities.
- `npm run test:sbom`: 770 components verified; SHA-256 `237f76e89e813358f5179ea19db8a22664974b4eaff7f667c85c7dd35681feb7`.
- Candidate archive was built twice from the same tree with identical SHA-256 `052b5c20c21bdf632e842a52b5977a0200b75a60e381de16baa31515e81640d9`.
- Rollback verification requires an exact remote annotated-tag object plus live GitHub `github-pages` deployment and success-status IDs, commit, tag ref, timestamp, and environment URL; eight fail-closed API-evidence tests pass.
- `npm run build`: production PWA built successfully.
- Final Playwright QA covered desktop/mobile EN/DE identity, file, workspace, help, 200% zoom, ARIA, axe, console, failed requests, external requests, reflow, and clipping.
- Visual artifacts and machine-readable candidate evidence are generated under ignored `output/playwright/` and `output/release/` directories.

## Current gate state

`npm run verify:quality` is green. `npm run verify` must still stop at
`test:release-prerequisites` because `docs/independent-security-review.json`
and its independently signed report do not exist for the candidate commit.
That failure is required and must not be bypassed. The source candidate may be
signed and pushed for review, but no public-beta tag, GitHub Release, Pages
deployment, or ready claim is permitted until the independent report covers
the exact candidate HEAD and the remaining provenance/deployment gates pass.
