# Chat NoControl implementation status

> **Authority:** Non-normative implementation tracking; normative product, protocol, security, UX, and release documents take precedence.
> **Checked:** 2026-07-15 Europe/Berlin
> **Release-state scope:** this file records the pre-review candidate checkpoint; it does not assert current publication or deployment status. See [GitHub Releases](https://github.com/levi-cm/chat-nocontrol/releases) and the [Pages site](https://levi-cm.github.io/chat-nocontrol/) for operational state.

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
| 14 | Complete | The seven-screen identity flow, required vault password, branded recovery artifacts, transient print/PDF, restore practice, secret cleanup, and explicit recommended-storage decision pass unit, EN/DE, cross-browser, accessibility, offline, and network-denial gates. |
| 15 | Complete | Smart text/file routing, exact copy/download, authenticated preview, bad-signature/unknown-sender behavior, cancellation, limits, and Blob URL cleanup pass. |
| 16 | Complete (implementation) | Help/diagnostics, app-shell-only offline caching, safe update prompt, meta CSP, network denial, pinned Actions, and manual-only Pages workflow pass locally. Deployment is intentionally held behind Task 17 release gates. |
| 17 | Pre-review candidate blocked from release | Local hardening and focused quality gates pass. One recovery-QR decode test remains flaky only inside the long all-browser run, so the current work is not described as a completely green candidate. Publication remains blocked on a frozen clean commit, genuine independent review, signed release provenance, explicit approval, and deployment evidence. |

Adaptive PPXT text compression is implemented as canonical v2/flag1 around the
unchanged signed v1 inner. Writers retain v1 for short, incompressible,
unsupported, or failed compression; readers use bounded fail-closed gzip.
Automated compatibility evidence is complete, while physical-phone latency
evidence remains `not run - hardware unavailable` and therefore blocks release
readiness for v2 emission.

Compact PPXQ encrypted-message QR support remains available as an optional
afterthought to ordinary PPXT. Creation now defaults off, the export selector is
hidden until explicit EN/DE opt-in, and the PPXQ worker does not start while
disabled. Opt-in preserves H-only capacity checks and 2048-square PNG downloads.
Camera/image/link receiving, bounded screenshot recovery, known-sender
verification, and immediate fragment scrubbing remain available regardless of
the creation setting. Protocol behavior and physical-device evidence are
unchanged; physical rows remain honestly unrun.

## Implemented identity-onboarding redesign

- The target is a seven-screen wizard with progress `30/42/54/66/78/90/100`, UI `Username` mapped to protocol `pseudonym`, required matching printable-ASCII vault password, mandatory QR and `.ppxrecovery` downloads/attestations, private A4 print/PDF, QR/file/four-word restore practice, and recommended preselected encrypted IndexedDB storage that is written only after explicit confirmation.
- The plaintext password is permitted only in transient wizard state and the private recovery print/PDF; it must not appear in persistent storage, logs, URLs, the standalone QR PNG, `.ppxrecovery`, or post-secret DOM state.
- The latest evidence below includes the redesign. It does not constitute independent cryptographic review or authorization to publish.

## Latest local evidence

- `npm run verify:quality`: did not exit `0` on 2026-07-15. Its long 375-case Playwright phase timed out once while decoding a downloaded identity-recovery QR; the exact failing Firefox case passed immediately in isolation, and a second long run reproduced the timeout under mobile Chromium. No speculative product change was made for this suite-duration/resource flake.
- `npm run unit`: 88 files, 296 tests passed with coverage. Focused settings, message-QR opt-in, production-artifact, and deployment-evidence tests also pass.
- `npm run test:parser-fuzz`: 100,000 generated cases passed.
- Focused message-QR E2E: 10 tests passed across desktop/mobile Chromium, desktop Firefox, and desktop/mobile WebKit. Creation is off by default; opt-in persists; receiving remains available.
- The separately rerun accessibility gate passed 85 tests, including keyboard-only operation, axe, reflow, reduced motion, touch targets, and 200% zoom automation.
- Real screen-reader check: Orca `50.2` consumed Chromium's live AT-SPI tree while OS-level Tab navigation announced the banner, language control, primary navigation, current page, and identity actions. Orca produced 176 speech-output records; the stopped raw debug log had SHA-256 `5bea68df79ca3b5c18c29f4260b48e88bb1d0f9674738d22e4ce245df2b7862f`. The headed desktop keyboard matrix also passed 7/7 while Orca was active.
- `npm run test:network-denial`: 15 tests passed.
- `npm run test:offline -- --reporter=dot`: 5 tests passed.
- `npm run test:update-banner`: 15 tests passed.
- `npm run test:session-only`: 60 tests passed.
- `npm run test:en-de`: 15 tests passed.
- `npm run test:dependency-review`: approved dependency pins and `npm audit --audit-level=high` passed with 0 high-severity vulnerabilities.
- `npm run test:sbom`: 775 components verified; SHA-256 `8d5fecd4f32319a38ad63e6acdd95a468b9b4ef6b613f370f7b3369feaaeae57`.
- Release reproducibility evidence remains intentionally unavailable until the candidate is committed and frozen; the release verifier rejects the dirty implementation worktree.
- Rollback verification requires an exact remote annotated-tag object plus live GitHub `github-pages` deployment and success-status IDs, commit, tag ref, current deployment window, timestamp, and environment URL; fail-closed API-evidence tests pass.
- `npm run build`: production PWA built successfully.
- Local production builds now reject `.map` files and JavaScript
  `sourceMappingURL` references. The future manual release workflow verifies an
  exact signed beta tag, deploys its exact checked artifact, and records matching
  GitHub deployment/status evidence. This local preparation does not resolve or
  claim any current publication or deployment outcome.
- Final Playwright QA covered desktop/mobile EN/DE identity, file, workspace, help, 200% zoom, ARIA, axe, console, failed requests, external requests, reflow, and clipping.
- Visual artifacts and machine-readable candidate evidence are generated under ignored `output/playwright/` and `output/release/` directories.

## Pre-review candidate gate state

At this recorded pre-review checkpoint, the focused and separately rerun local
gates pass, but the single long `npm run verify:quality` command is not green
because of the recovery-QR decode flake recorded above. `npm run verify`
correctly remains blocked at `test:release-prerequisites` because
`docs/independent-security-review.json` and its independently signed report do
not exist. Repository visibility, vulnerability-reporting, and Pages state
remain operational publication checks; this local file does not claim that any
remote issue is resolved. Neither blocker was bypassed. Release proceeds only by freezing a
candidate, adding genuine review evidence in its single permitted child commit,
then performing the approved public-release transaction with signed provenance,
vulnerability reporting, deployment, and rollback verification. Current
publication outcomes must be read from GitHub Release, Actions, attestations,
and Pages records rather than inferred from this source snapshot.
