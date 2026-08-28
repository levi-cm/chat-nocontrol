# CAT5 Release Completion Design

> **Status:** Proposed release design selected by the user on 2026-08-28.
> **Target:** `chat-nocontrol@0.2.0-beta.1` / `v0.2.0-beta.1`.
> **Deployment boundary:** This design does not authorize GitHub Pages deployment. Deployment still requires an explicit user request after every release gate passes.

## Goal

Finish CAT5/V2 as a reviewed, physically tested, reproducible beta; promote its exact signed release commit to `main`; deploy only that verified artifact to GitHub Pages; automatically restore the pinned V1 Pages tree if post-deployment acceptance fails.

## Current baseline

- CAT5 branch/worktree: `codex/cat5-post-quantum-v2` at committed HEAD `f476c48a07370a37aa118a96526a6aa22d9f44d3`, plus 136 tracked modifications and 31 untracked paths before this document.
- Remote CAT5 branch: `origin/codex/cat5-post-quantum-v2` at `f476c48a07370a37aa118a96526a6aa22d9f44d3`.
- Remote `main`: `575d30e2c9f9e98ab2ba097bc47113ccc985d26b`; CAT5 does not yet contain it.
- Live Pages rollback source: `origin/gh-pages` commit `1a3a5b4d5e55ab78d2bf4692eed2d3545856e291`, tree `f58cbb1e46f3e046139788a62bf0333d13c1c1a5`, serving V1 `0.1.0-beta.1`.
- Latest remote `main` CI failed in mobile WebKit identity recovery. The current CAT5 worktree passed the exact failing test 3/3 on 2026-08-28; merged full CI remains unproven.
- Local CAT5 quality evidence from 2026-08-11 is PASS, but it predates current execution and remote-main integration.
- Fresh `test:release-prerequisites` fails only because genuine independent-review evidence and signed physical-device evidence are absent.
- GitHub private vulnerability reporting is enabled.
- GitHub Pages still uses legacy branch publishing; the `github-pages` environment currently allows only `gh-pages`. The gated workflow needs workflow publishing plus `main` authorization before dispatch.

## Architecture

Release completion uses one immutable chain:

1. Preserve and commit current CAT5 work; merge current `origin/main` without rewriting shared history.
2. Rebaseline every deep-scan finding against CAT5 and close any remaining implementation, test, documentation, CI, or release-tooling gap.
3. Add a deterministic synthetic physical-device test kit and a private HTTPS two-build harness. These make the real Android/iPhone matrix executable without deploying the candidate publicly.
4. Commit genuine reviewer and device-tester trust roots before the reviewed candidate.
5. Freeze one candidate commit; run local quality and remote CI on that exact SHA.
6. Obtain a genuinely independent, signed review of that SHA. Add exactly one child commit containing only the review record, report, and detached signature.
7. Build deterministic release bytes from the evidence-only child. Run and sign the real-device matrix against those exact bytes; import the signed result into ignored release output.
8. Pass all prepared-release gates; create the signed annotated tag; fast-forward the evidence-only release commit to `origin/main`; prove CI, remote tag identity, and `origin/main` containment.
9. Create a draft prerelease containing the signed physical evidence. Only after explicit deployment approval, switch Pages to workflow mode, authorize `main`, and dispatch the gated workflow.
10. Verify live CAT5. If live acceptance fails after mutation, deploy the pinned V1 rollback tree automatically and keep the CAT5 release draft/unpublished.

No source, workflow, trust-root, or documentation change is allowed after candidate freeze. A required change invalidates the review and physical evidence and starts a new candidate cycle.

## Components

### Integration and remediation

- Existing CAT5 runtime, protocol, compatibility, tests, docs, and release scripts remain the implementation base.
- `origin/main` audit provenance under `pen-test-deep-scan/` is merged unchanged.
- A new `docs/cat5-deep-scan-remediation.md` maps CRIT-001, LOW-001 through LOW-008, and INFO-001 to CAT5 code/tests and fresh results. Original findings remain immutable provenance.
- The known remote CI failure is treated as a reproduced symptom. CAT5's focused 3/3 result is evidence only; full merged local and GitHub CI must pass.

### Independent-review trust

- `.github/allowed_signers` contains separate, namespace-restricted entries:
  - project release signer: namespace `git`;
  - genuine independent reviewer: namespace `chat-nocontrol-security-review-cat5-v2`.
- Reviewer and release roles must use different principals and keys.
- Reviewer trust root must exist in the parent of the reviewed candidate and remain byte-identical through the evidence-only child and tag.
- Review evidence uses exactly:
  - `docs/independent-security-review.json`;
  - `docs/reviews/independent-cryptographic-review.md`;
  - `docs/reviews/independent-cryptographic-review.md.sig`.

### Physical-device execution

- `.github/physical-device-allowed-signers` contains one dedicated tester principal restricted to `chat-nocontrol-physical-device-cat5-v2`.
- Tester key/principal must differ from both review and release roles and predate the reviewed candidate.
- `scripts/generate-physical-device-test-kit.ts` creates ignored, deterministic synthetic inputs for V1 PPXT formats 1/2, PPXF, PPXQ, legacy links, sender PPXC, recipient recovery, plus a checksum manifest and operator guide.
- `scripts/physical-device-server.ts` serves the pinned V1 tree first and exact candidate `dist` second on one origin. Mode switches only through local operator input; no network control endpoint exists.
- Tailscale Serve supplies trusted HTTPS to enrolled physical devices while the origin server remains loopback-only. No candidate is placed on canonical GitHub Pages before physical evidence passes.
- Generated V2 links must be proven to use the canonical Pages origin. Receiver behavior is exercised on the private exact-build origin by preserving the exact fragment while replacing only the origin for the predeployment test.
- Four physical profiles run all required matrix rows: Android Chrome, Android installed PWA, iPhone Safari, and iPhone home-screen PWA. Web Share may be `NOT SUPPORTED` only with `supported: false`; every other required check must PASS.
- Final evidence contains metadata/results only—never plaintext, ciphertext, contacts, keys, recovery material, or unredacted secret-bearing captures.

### Release and deployment

- Release HEAD is the single immediate child of the reviewed candidate and differs by exactly the three review evidence files.
- Physical evidence binds reviewed candidate SHA, release tag, version, deterministic `dist` digest, and release archive digest.
- Signed annotated tag is `v0.2.0-beta.1`; local and remote tag object IDs must match.
- `origin/main` is advanced only by fast-forward to the evidence-only release HEAD. Force push is forbidden.
- The draft prerelease exists before deployment and initially contains only the fixed physical evidence JSON and detached signature required by CI.
- Pages settings change only after explicit user deployment approval:
  - build type becomes `workflow`;
  - `main` is added to the `github-pages` environment branch policy;
  - the existing `gh-pages` branch and pinned V1 commit remain untouched for rollback.
- `.github/workflows/release.yml` verifies exact tag/source/artifact/SBOM/reproducibility/evidence, authorizes the immutable Pages artifact in the canonical ledger, deploys, performs bounded live acceptance, records GitHub deployment IDs, attests artifacts, then publishes the prerelease.

### Rollback

- Before public mutation, CI packages the pinned V1 tree from `1a3a5b4d5e55ab78d2bf4692eed2d3545856e291` as a separate rollback Pages artifact and verifies its tree plus pinned file hashes.
- If CAT5 live acceptance fails after `deploy-pages` succeeds, a dedicated `rollback-pages` job deploys that V1 artifact, verifies the known V1 asset set, and leaves the CAT5 GitHub Release in draft state.
- If failure occurs before Pages mutation, no rollback runs because the live site is unchanged.
- Manual emergency fallback remains available by restoring legacy Pages source to `gh-pages:/` after verifying the branch still points to the pinned V1 commit.

## Evidence flow

```text
CAT5 work + origin/main audit
  -> integrated green branch
  -> signer trust-root commit
  -> reviewed candidate SHA
  -> independent signed review
  -> three-file evidence-only child = release HEAD
  -> deterministic dist/archive/SBOM
  -> signed physical-device evidence
  -> signed annotated tag
  -> fast-forward origin/main
  -> remote CI + tag identity proof
  -> draft prerelease
  -> explicit deployment approval
  -> immutable Pages artifact authorization
  -> CAT5 deploy + live acceptance
     -> PASS: ledger + attestation + public prerelease
     -> FAIL: pinned V1 rollback + release remains draft
```

Every arrow is fail-closed. Evidence from an earlier SHA, build, archive, tag, or trust root is rejected.

## Failure handling

- Merge conflict: resolve only after comparing both sides; preserve audit provenance and CAT5 semantics; rerun affected tests.
- Local or CI failure: diagnose root cause, add a failing regression test, implement one fix, rerun focused + full gates; do not freeze candidate.
- Review finds critical/high issue: release stays blocked; fix on branch; create a new candidate; repeat review.
- Review signature/trust mismatch: reject evidence; do not alter trust roots after candidate freeze.
- Physical row fails or remains unrun: release stays blocked; correct product or test environment; repeat full affected profile against the same bytes or issue a new candidate if code changes.
- Artifact reproducibility mismatch: discard generated outputs; diagnose nondeterminism; create a new candidate if source changes.
- Remote main/tag mismatch: stop before release dispatch; never force push.
- Deployment workflow failure before deploy: live V1 remains; release remains draft.
- Live acceptance failure after deploy: automatic pinned-V1 rollback; release remains draft; deployment ledger must not claim CAT5 success.

## Test strategy

1. Focused remediation tests map every deep-scan finding to an executable regression test.
2. Physical-kit tests decrypt every generated V1 artifact, validate all links/fixtures/checksums, and prove the kit is absent from `dist` and release archive.
3. Physical-server tests verify pinned V1 tree identity, loopback-only binding, stdin-only mode transition, exact candidate tree, and no secret-bearing request logs.
4. Release-workflow unit tests verify explicit approval, draft-evidence download, exact artifact authorization, live acceptance, automatic rollback, and publish-after-ledger ordering.
5. `npm run verify:quality` passes on the exact reviewed candidate and again in GitHub CI.
6. Review-evidence tests prove the fixed trust root predates the candidate and only three evidence files are added.
7. `npm run verify:prepared` passes locally and in release CI against signed physical evidence and deterministic output.
8. Post-deployment checks bind canonical URL, CAT5 version, current asset hashes, forced V1-to-CAT5 update, no update-choice UI, no fragment/network/storage/cache leak, offline reopen, deployment ledger IDs, provenance attestation, and published prerelease.

## External inputs

Three real identities are required; none may be fabricated or substituted with AI/internal review:

1. Existing project release signer/key.
2. Genuine independent security reviewer principal, public key, signed report, and independence statement.
3. Distinct physical-device tester principal, public key, four-profile execution, signed closed-schema evidence, and out-of-band JSON SHA-256.

Missing external input remains `BLOCKED`; it never becomes a skipped or advisory gate.

## Non-goals

- No CAT5 feature expansion.
- No protocol redesign.
- No weakening/removal of independent review, physical-device, reproducibility, provenance, or deployment gates.
- No emulation treated as physical evidence.
- No selectable V1 application or update prompt. CAT5 remains write-new; V1 remains hidden read/import compatibility.
- No force push, history rewrite, branch deletion, or modification of the pinned V1 rollback commit.
- No GitHub Pages deployment from this design/spec action.

## Success criteria

- Integrated CAT5 contains current `origin/main` and all audit provenance.
- Every tracked/untracked CAT5 implementation file is deliberately committed; worktree is clean at candidate freeze.
- Deep-scan remediation report is complete; zero open critical/high findings.
- Exact candidate passes local full quality and remote CI.
- Genuine independent review PASS is cryptographically bound to the candidate.
- Real Android/iPhone browser/PWA evidence PASS is cryptographically bound to exact release bytes.
- Deterministic archive, SBOM, source-map guard, signed tag, remote tag identity, and `origin/main` containment all pass.
- `origin/main` contains the evidence-only release HEAD by fast-forward.
- Pages deployment occurs only after explicit user approval.
- Live CAT5 acceptance passes and release becomes a public prerelease; otherwise pinned V1 is restored and CAT5 remains draft.
