# Audited security-issue status

**Audit date:** 2026-07-15
**Scope:** Current working tree, `origin/main`, current GitHub Pages deployment,
and every file under the three pen-test directories.

## Inventory read

- `pen-test/` was empty before this report.
- `pen-test-1/` contained 15 Markdown files: its summary plus every Critical,
  High, Medium, Low, and Info finding. All 15 were read.
- `pen-test-2-kimi/` was empty.

## Unresolved issues that need action

### OPEN-001 — Public exposure bypasses the documented release gate

**Severity:** High (release-policy and security-claim accuracy)

**Status:** Real and unresolved.

Current evidence:

- GitHub reports `levi-cm/chat-nocontrol` as public.
- `https://levi-cm.github.io/chat-nocontrol/` returns HTTP 200 and GitHub reports
  Pages status `built`.
- The deployed commit is `93e033092000a6e51d8a63417a0269a881e9dd03`, titled
  `deploy: publish private preview to GitHub Pages`.
- `npm run test:release-prerequisites` fails because
  `docs/independent-security-review.json` is missing.
- Published `origin/main` documentation still says `unaudited / not deployed`.
- Current local `SECURITY.md` says the repository must remain private until all
  release gates and explicit approval are complete.

Required resolution: choose one explicitly authorized state and make every
surface agree:

1. Pre-release containment: disable the Pages deployment and make the repository
   private until the documented gates pass; or
2. Approved public beta: obtain genuine independent review, pass every release
   gate, publish through the approved workflow, and update public documentation
   to accurately describe the deployed status.

Do not perform option 2 without explicit deployment approval.

### OPEN-002 — Live deployment has no source-to-artifact provenance record

**Severity:** High (release integrity)

**Status:** Real and unresolved.

Current evidence:

- `docs/deployed-releases.json` contains an empty `deployments` array.
- GitHub has no project Release for the live deployment.
- The live `gh-pages` commit is an unsigned orphan commit with no parent linking
  it to the reviewed source history.
- The live JS hashes differ from the current build. The live bundle also contains
  `pdf-lib` code while `origin/main/package.json` does not list `pdf-lib`; no
  record explains which source tree produced the artifact.

Required resolution:

- Remove the untracked preview deployment, or replace it only through the gated
  release process.
- Bind deployed URL, source commit, signed/verified release tag, artifact
  SHA-256, build evidence/attestation, and deployment time in the release record
  and deployment ledger.
- Add a check that prevents deployment when that binding is absent or mismatched.

## Resolved during audit

### RESOLVED-003 — Production builds emitted source maps

**Severity:** Low (hardening/build hygiene; **not Critical** for an open-source
project)

**Status:** Fixed in the current working tree; the existing live preview remains
covered by OPEN-002 until an approved replacement deployment occurs.

Current evidence:

- `vite.config.ts` sets production `build.sourcemap: false`.
- `npm run build` runs `scripts/production-artifacts.ts` after Vite and fails if
  `dist` contains a `.map` file or JavaScript `sourceMappingURL` reference.
- The ungated `.github/workflows/pages.yml` is deleted. The prepared gated
  release workflow uploads only the verified `dist` artifact after the same
  production-artifact check passes.
- The currently live deployment has only dangling `sourceMappingURL` comments;
  its map files are absent. Replacing that unproven preview remains part of
  OPEN-002, not a reason to bypass the release gate.

The original report's Critical rating is not justified: reviewed source and
dependency source are public by design, and cryptographic security must not rely
on hiding implementation details. Maps still increase artifact size and expose
original paths, comments, and names, so production publication should be an
intentional choice.

No additional source-map code fix is open. A future approved deployment must
still pass the production-artifact check.

## Verdict for every prior claim

<!-- markdownlint-disable MD013 -->

| Prior claim | Current verdict | Needs open fix? |
| --- | --- | --- |
| Source maps deployed by Pages workflow | Historical build/pipeline behavior was real; Critical security impact was overstated for open source. Current working tree disables production maps and tests the artifact. | No code fix remains; live replacement is covered by OPEN-002. |
| Deployed/source provenance mismatch | Real. Live orphan artifact has no source/hash/release binding. | Yes: OPEN-002 |
| Deployment contradicts security policy | Real. Repo and Pages are public/live while release prerequisite fails. Local doc edits do not repair external state. | Yes: OPEN-001 |
| CSP exists only as a meta tag | True, but policy is strong and appears before executable app code. GitHub Pages platform constraint; full deployment compromise can also replace the meta policy and HTML. | No current code fix; document constraint or use header-capable hosting later. |
| No SRI on same-origin assets | True but not an effective finding under the stated full-deployment-compromise attacker: attacker can replace HTML, asset, and `integrity` value together. | No. Do not treat self-authored same-origin SRI as trust root. |
| Dangling live `sourceMappingURL` comments | Real, very low impact, and present only in the unproven live preview. | Covered by OPEN-002 replacement. |
| scrypt parameters are conservative | `N=65536, r=8, p=2` matches protocol and rejects downgrade. Weak passwords remain an explicitly warned, confirmed user choice. This is documented residual password-guessing risk, not proof of a KDF defect. | No mandatory code fix under current policy; stronger enforcement is a product-policy choice. |
| Fingerprint/checksum comparison is not constant-time | Fixed. `equalBytes` XOR-accumulates every byte for equal-length values. Compared lengths/data are public. | No. |
| No forward secrecy/ratchet | True, explicit v1 non-claim requiring a different interactive architecture. | No. |
| No post-quantum signatures | True, explicit v1 non-claim; confidentiality is hybrid, authenticity is classical. | No. |
| Message/file length leakage | True and documented metadata leakage; no padding claim exists. | No under current v1 threat model. |
| Guaranteed JS memory deletion is impossible | True and documented. Current code uses extensive best-effort zeroization. | No. |
| `pdf-lib` console logging | The old assertion that `pdf-lib` was removed is stale: current local work reintroduces it and the bundle includes `FLATE`/warning calls. No app secret logging was found, and current code creates recovery PDFs rather than parsing attacker PDFs. | No security fix demonstrated. Optional bundle cleanup only. |
| Positive security posture | Broadly supported by current focused tests and dependency audit, but it is not a substitute for the missing independent review. | Review gate remains OPEN-001. |

<!-- markdownlint-enable MD013 -->

## Verification performed

- `npm run build`: passed; production artifact check found no map files or map
  references.
- `npm audit --omit=dev --json`: 0 vulnerabilities across all severities.
- `npm run test:dependency-review`: passed.
- Focused vault/contact/cleanup tests: 18 passed.
- Primitive vectors: 6 passed; crypto-provider contract passed.
- PPX protocol golden tests: 18 passed; all-family goldens and PPXF contract
  passed.
- Parser roundtrip, mutation, truncation, and boundary tests: 11 passed.
- `npm run test:release-prerequisites`: correctly failed on missing independent
  review evidence.
- Live Pages headers, artifact files/hashes, GitHub deployment metadata,
  repository visibility, commit ancestry, ledger, and Releases were checked
  read-only. No deployment or publication action was performed.
