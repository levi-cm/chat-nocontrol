> **Authority:** Chat NoControl documentation authority; this file normatively defines the testing and release contract for the public beta.
> **Version:** 1.0-draft
> **Status:** Public beta channel / stable release unavailable / operational status is external
> **Depends on:** [product-spec.md](product-spec.md), [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [accessibility-i18n.md](accessibility-i18n.md), [github-pages-deployment.md](github-pages-deployment.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# Testing and Release Contract

Last verified: 2026-07-13. Current final evidence is recorded in
[`implementation-status.md`](implementation-status.md).

This source snapshot does not assert whether a release or Pages deployment is
currently live. Check the
[GitHub Releases](https://github.com/levi-cm/chat-nocontrol/releases) and the
[Pages site](https://levi-cm.github.io/chat-nocontrol/), then verify the linked
workflow, provenance, and deployment records.

## 1. Release levels

### 1.1 Preview

Preview builds are local or branch-only builds used for implementation and review.

The repository remains private throughout preview development, review, and public-beta preparation.

Requirements:

- may be incomplete;
- may fail non-blocking tests;
- must still follow the protocol and safety rules;
- must not claim public beta readiness.

### 1.2 Public beta

Public beta is the current target.

Requirements:

- repository visibility changes to public only as part of the approved public-beta publication checklist and after explicit sign-off;
- static GitHub Pages deployment only;
- no backend;
- no telemetry;
- no open critical or high-severity known issues for the release scope;
- independent cryptographic review has cleared the public-beta posture;
- the independent report is committed under `docs/reviews`, SHA-256 bound to
  `docs/independent-security-review.json`, and verified with the reviewer's SSH
  signature using namespace `chat-nocontrol-security-review-v1`;
- a usable private vulnerability reporting path exists;
- test matrix completed for the shipping browser set;
- accessibility and localization checks passed;
- release record and rollback path prepared.

### 1.3 Stable

Stable is not available yet.

Stable requires fresh release-level review and:

- independent review;
- a private vulnerability reporting path;
- documented remediation workflow;
- release sign-off beyond the implementation team;
- explicit approval to raise the status beyond public beta.

## 2. Runnable commands

The command names below are implemented package scripts. `npm run verify` runs
the ordered release gate and must stop on the first real failure.

### 2.1 Baseline checks

- `typecheck`
- `lint`
- `format:check`
- `unit`
- `test`

### 2.2 Cryptography and protocol

- `test:primitive-vectors`
- `test:provider-contract`
- `test:ppx-golden`
- `test:parser-property`
- `test:parser-fuzz`
- `test:mutations`
- `test:truncations`
- `test:boundaries`
- `test:qr-degradation`
- `test:bip39`

### 2.3 Product flows

- `test:storage`
- `test:session-only`
- `test:chunks`
- `test:order`
- `test:manifest`
- `test:file-limits`
- `test:cancel`
- `test:memory`
- `test:en-de`
- `test:e2e`
- `test:unknown-sender`

### 2.4 Accessibility and localization

- `test:accessibility`
- `test:i18n`
- `test:offline`
- `test:update-banner`
- `test:network-denial`

### 2.5 Release engineering

- `test:release`
- `test:sbom`
- `test:reproducibility`
- `test:dependency-review`
- `test:production-artifacts`

## 3. Required matrix

### 3.1 Static quality

| Area | Check | Expected result |
|---|---|---|
| Type safety | `typecheck` | No type errors |
| Lint | `lint` | No rule violations |
| Formatting | `format:check` | Stable formatting |
| Unit tests | `unit` | All pass |

### 3.2 Cryptography

| Area | Check | Expected result |
|---|---|---|
| NIST primitives | `test:primitive-vectors` | AES-256-GCM, SHA-512, HKDF-SHA-512, scrypt, X25519, Ed25519, ML-KEM vectors pass |
| Provider contract | `test:provider-contract` | Request-owned signing capability and provider-owned encapsulation conform |
| Protocol goldens | `test:ppx-golden` | Encoded objects match canonical fixtures |
| Parser properties | `test:parser-property` | Round-trip and rejection properties hold |
| Fuzzing | `test:parser-fuzz` | 100000-case extended fuzz run finds no crashes or unsafe accepts |
| Mutations | `test:mutations` | Corrupted inputs fail safely |
| Truncations | `test:truncations` | Short inputs fail safely |
| Boundaries | `test:boundaries` | Size and version limits are enforced |
| QR degradation | `test:qr-degradation` | Damaged QR payloads fail safely |
| BIP39 | `test:bip39` | English 24-word recovery round-trip and checksum handling are correct |

### 3.3 Product flows

| Area | Check | Expected result |
|---|---|---|
| Storage | `test:storage` | Persistent and denied-storage paths behave correctly |
| Session-only | `test:session-only` | No identity or contact persistence remains after session end |
| Identity wizard | `unit`, `test:e2e` | Seven transitions use `30/42/54/66/78/90/100`, Back cannot recreate cleared secrets, and restart/skip boundaries hold |
| Vault password | `unit`, `test:e2e` | Matching printable ASCII is required; internal spaces, edge-space rejection, case sensitivity, and the `256`-byte maximum behave correctly |
| Backup artifacts | `unit`, `test:e2e` | QR PNG and `.ppxrecovery` downloads plus separate attestations gate progress; written words, stored printout, and stored PDF are three required independent confirmations |
| Recovery document | `unit`, `test:e2e` | One-page A4 print/PDF contains the exact password, username, dates, QR, full recovery code, and all words while other artifacts and post-secret state do not contain the password |
| Restore practice | `unit`, `test:e2e` | QR then `.ppxrecovery` then four unique stable random words restore the pending identity; malformed and different-identity inputs fail safely; retries are unlimited and restart appears after ten failures |
| Recommended storage | `test:storage`, `test:session-only`, `test:e2e` | Encrypted IndexedDB is preselected but not written before explicit confirmation; opt-out and unavailable storage remain session-only |
| Message QR | `unit`, `test:e2e`, `test:accessibility`, `test:i18n` | Creation defaults off and starts no PPXQ worker; opt-in restores export/capacity behavior; scan, image, link, and auto-decrypt receiving remain available |
| File chunks | `test:chunks` | Chunking and reassembly follow the object rules |
| Order and manifest | `test:order`, `test:manifest` | Object order and terminal manifest handling are correct |
| File size range | `test:file-limits` | 0 to 100 MiB boundaries are enforced |
| Cancel | `test:cancel` | Cancellation emits one cancelled terminal event and no partial output |
| Memory | `test:memory` | No more than one plaintext chunk is retained by application code |
| EN/DE parity | `test:en-de` | English and German flows match semantically |
| E2E | `test:e2e` | Alice/Bob creation, exchange, text/file encrypt/decrypt, cancellation, preview/download, and delete paths work |
| Unknown sender | `test:unknown-sender` | Decrypt succeeds with explicit warning when appropriate |

### 3.4 Accessibility and offline behavior

| Area | Check | Expected result |
|---|---|---|
| Accessibility | `test:accessibility` | Keyboard, screen reader, focus, contrast, and zoom checks pass |
| Localization | `test:i18n` | English and German remain semantically aligned |
| Offline | `test:offline` | App shell and versioned assets work offline after first load |
| Update banner | `test:update-banner` | New-version prompt appears at the right time |
| Network denial | `test:network-denial` | The app fails safely and remains usable where designed |

### 3.5 Release engineering

| Area | Check | Expected result |
|---|---|---|
| Release | `test:release` | Release artifact, tag, and rollback data are consistent |
| SBOM | `test:sbom` | SBOM is generated and stored with the release record |
| Reproducibility | `test:reproducibility` | Rebuild hash matches the recorded source state where supported |
| Dependency review | `test:dependency-review` | Dependency set is reviewed before shipping |
| Production artifacts | `test:production-artifacts` | Expected shell exists and no `.map` or `sourceMappingURL` is shipped |

## 4. Browser and hardware coverage

Encrypted-message QR evidence is tracked in
[`qr-message-device-matrix.md`](qr-message-device-matrix.md). Automation must
cover H-only capacity, app/link transport, fragment scrubbing, camera denial
with image fallback, bounded screenshot recovery, no message persistence,
browser-local settings, offline cached use, keyboard operation, EN/DE, and axe.
Creation-off and explicit opt-in cases must both be covered; receiving remains
available in either state. Ordinary PPXT remains the primary output.
Physical rows must remain explicitly `not run - hardware unavailable` until
tested; emulation cannot satisfy them.

The release matrix must cover maintained browsers on roughly five-year-old hardware.

The goal is not absolute benchmark perfection. The goal is whether ordinary users can complete the supported flows without unacceptable delay or memory pressure.

Minimum coverage should include:

- current Chromium-based browser;
- current Firefox-based browser;
- current WebKit-based browser where supported by the app surface;
- desktop and mobile class layouts;
- reduced-motion and high-zoom conditions.
- print media, A4 recovery-document rendering, grayscale output, and maximum-length password wrapping.

Adaptive PPXT v2 evidence must record gzip-stream support on desktop Chromium,
desktop Firefox, phone Chromium, and phone Firefox over HTTPS. Each supported
physical phone must show compression and decompression p95 at or below 25 ms,
full encrypt/decrypt p95 regression at or below 5 percent, incompressible input
remaining v1 without growth, and work remaining off the main thread. CI locks
format choice and sizes; it does not use unstable microsecond timing as a gate.
Missing physical-phone evidence blocks v2 release readiness and must be marked
`not run - hardware unavailable`, never relabeled as emulation.

## 5. Release blockers

Do not mark a release ready if any of the following remain true:

- a critical security issue is known and unaddressed;
- the private vulnerability reporting path does not exist;
- independent review has not happened for the target release level;
- the accessibility matrix has not passed;
- the German and English user-visible warnings diverge in meaning;
- the deployment contract is not compatible with GitHub Pages;
- the release artifact cannot be traced back to a specific commit and build.
- the repository has been made public before every public-beta gate and explicit sign-off have completed.
- any onboarding test permits the plaintext password in IndexedDB, settings, URLs, logs, diagnostics, the standalone QR PNG, `.ppxrecovery`, or post-secret DOM state.

## 6. Evidence to keep with each release

Each release should keep:

- the build log;
- the commit SHA;
- the release tag;
- the artifact hash;
- the SBOM;
- the test report;
- the deployment URL;
- the rollback target;
- any review notes that changed the release decision.

The review record must follow
[`independent-security-review.example.json`](independent-security-review.example.json)
and the following two-commit contract:

1. A genuinely independent human reviews one exact frozen candidate commit.
2. One immediate child commit adds only four new files:
   `docs/independent-security-review.json`, the named Markdown or PDF report
   under `docs/reviews/`, `<report>.sig`, and
   `<report>.allowed_signers`.
3. `reviewedCommit` is the evidence commit's immediate parent and an ancestor
   of release `HEAD`; exactly one commit may exist in between.
4. The complete `reviewedCommit..HEAD` diff contains only those four paths,
   each as a newly added non-symlink, non-executable regular file. Renames,
   path traversal, unexpected evidence, and modified application files fail
   closed.
5. Any source, dependency, workflow, configuration, protocol, UI, or
   executable-script change after the frozen candidate invalidates the review
   and requires a new candidate and new independent review.

The gate continues to bind the actual report SHA-256, SSH signature namespace
`chat-nocontrol-security-review-v1`, signing identity, completion time,
independence statement, `cleared-for-public-beta` outcome, and zero open
critical/high findings. A syntactically valid hash, an implementation-team or
AI attestation, or a review of a different commit is not review evidence.

Rollback targets come only from successful prior GitHub Pages deployments
recorded in [`deployed-releases.json`](deployed-releases.json). A tag that merely
exists or is merged is not proof that users ever received that release.
Each schema-v2 entry binds the exact annotated remote tag object, commit,
`github-pages` deployment ID, success-status ID, success timestamp, and
environment URL. Release verification fails closed unless GitHub's live
Deployments API independently confirms every field.

## 7. Escalation policy

Security or privacy issues that affect users should be reported privately first.

Public disclosure should wait for the release process to capture:

- triage;
- reproduction;
- fix or mitigation;
- regression test;
- release note update.
