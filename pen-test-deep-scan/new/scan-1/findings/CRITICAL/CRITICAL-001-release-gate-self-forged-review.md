# CRITICAL-001: Release gate accepts self-forged independent review evidence

- **Severity:** CRITICAL
- **Category:** supply-chain
- **Subsystem:** scripts/independent-review-evidence.ts, scripts/check-release-prerequisites.ts
- **Locations:** `scripts/independent-review-evidence.ts:238`, `scripts/independent-review-evidence.ts:300`, `scripts/check-release-prerequisites.ts:25`
- **Exploitability:** Confirmed — the SSH signature verification uses an attacker-supplied allowed_signers file with no binding to a trusted root; the full gate passes with a self-generated keypair.
- **Impact:** Integrity / auth-bypass — enables unaudited deployment of malicious code to GitHub Pages by defeating the independent-review release gate. An implementation-team insider can self-attest their own code, eliminating the only in-tree control that catches insider-inserted malicious code.

## Summary

The independent-review release gate (`scripts/check-release-prerequisites.ts` → `validateIndependentReviewEvidence` in `scripts/independent-review-evidence.ts`) verifies the reviewer's SSH signature against an `allowedSignersPath` that is specified inside the review record itself — the very JSON file the attacker commits. The gate never cross-checks this allowed_signers file against `.github/allowed_signers` (the trusted root used for release-tag signing in `verify-release.ts:74`). Any committer can generate a throwaway SSH keypair, create a `docs/reviews/<report>.allowed_signers` containing their own public key, sign a fabricated report, and satisfy every check the gate performs.

## Vulnerability detail

The gate (`scripts/independent-review-evidence.ts`) performs these checks on the review record:

1. **Schema/field validation** (lines 200–224): `schemaVersion === 2`, non-empty `reviewer.name`/`organization`/`independenceStatement`, `outcome === "cleared-for-public-beta"`, `openCriticalOrHigh === 0`, valid `reportSha256`, non-empty `signingIdentity`, `signatureNamespace === "chat-nocontrol-security-review-v1"`, valid ISO-8601 `completedAt`. All fields are attacker-settable strings/numbers — no external binding.

2. **Path canonicalization** (lines 226–258): `reportPath`, `signaturePath`, `allowedSignersPath` must be under `docs/reviews/` with the right extensions. The `allowedSignersPath` is taken from `record.allowedSignersPath` (line 239) — a field the attacker controls.

3. **File existence / regular-file check** (lines 260–281): Files must exist, be non-symlink, non-executable. Attacker creates them.

4. **Report SHA-256 binding** (lines 282–288): `sha256(reportPath) === record.reportSha256`. Attacker computes the hash of their own report.

5. **SSH signature verification** (lines 300–318):
```ts
const verification = spawnSync("ssh-keygen", [
  "-Y", "verify",
  "-f", join(cwd, allowedSignersPath),   // ← attacker-supplied path
  "-I", record.signingIdentity,           // ← attacker-supplied identity
  "-n", record.signatureNamespace,        // ← fixed namespace
  "-s", join(cwd, signaturePath),         // ← attacker-supplied signature
], { input: readFileSync(join(cwd, reportPath)) });
```
The `-f` (allowed_signers) file is the one the attacker committed under `docs/reviews/`. `ssh-keygen -Y verify` checks the signature against whatever public keys are in that file. The attacker puts their OWN public key there. **There is no comparison with `.github/allowed_signers` anywhere in this file or in `check-release-prerequisites.ts`.**

6. **Git history binding** (lines 90–189): `reviewedCommit` must be a 40-hex SHA, an ancestor of HEAD, and HEAD's immediate parent (single child commit). The `reviewedCommit..HEAD` diff may add only the four named evidence files. This ensures **reviewed code == released code**, but it does NOT ensure the reviewer is independent — the same committer creates both the candidate and the evidence child.

Contrast with `scripts/verify-release.ts:72-77`, which verifies the release TAG signature against the FIXED trusted root `.github/allowed_signers`:
```ts
git(["-c", "gpg.ssh.allowedSignersFile=.github/allowed_signers", "verify-tag", expectedTag]);
```
The tag-signing gate binds to a trusted root; the review-signing gate does not.

`scripts/release-evidence.ts:122-125` records only the tag-signature root in the release record:
```ts
signatureVerification: {
  status: "verified",
  allowedSignersFile: ".github/allowed_signers",
},
```
The review's `allowedSignersPath` is not recorded or cross-checked anywhere.

## Exploit scenario

**Threat model:** An implementation-team insider with commit access and the release tag-signing key (currently `levi-cm` per `.github/allowed_signers`). This is exactly the threat the independent review is designed to mitigate.

1. Insert malicious code (e.g., a key-exfiltration backdoor in the crypto worker) into a candidate commit `C1`.
2. Generate a throwaway SSH ed25519 keypair: `ssh-keygen -t ed25519 -f /tmp/fake_reviewer -N ""`.
3. Write a fabricated review report `docs/reviews/independent-cryptographic-review.md` claiming the code is clean.
4. Sign it: `ssh-keygen -Y sign -f /tmp/fake_reviewer -n chat-nocontrol-security-review-v1 docs/reviews/independent-cryptographic-review.md` → produces `docs/reviews/independent-cryptographic-review.md.sig`.
5. Create `docs/reviews/independent-cryptographic-review.md.allowed_signers` containing the fake reviewer's public key and a matching identity string.
6. Create `docs/independent-security-review.json` with `schemaVersion: 2`, `reviewedCommit: <C1 SHA>`, `outcome: "cleared-for-public-beta"`, `openCriticalOrHigh: 0`, `reportSha256: <sha256 of report>`, `signingIdentity: "fake-reviewer@example.com"`, `signatureNamespace: "chat-nocontrol-security-review-v1"`, and the three evidence paths.
7. Commit as `C2` (child of `C1`) adding only the four evidence files. The git history check passes: `C1` is HEAD's parent, `rev-list C1..HEAD` count is 1, and the diff adds only the four named files.
8. Run `npm run test:release-prerequisites` — the gate **passes** because the SSH signature verifies against the attacker's own allowed_signers file.
9. Sign the tag `v0.1.0-beta.1` with the trusted key and trigger `workflow_dispatch` on `release.yml`. The full `npm run verify` passes, and the malicious code deploys to GitHub Pages.

No independent human ever reviewed the code. The gate's own documentation (`docs/testing-and-release.md:291-292`) states "A syntactically valid hash, an implementation-team or AI attestation, or a review of a different commit is not review evidence" — but the code accepts exactly an implementation-team attestation.

## Proof of concept

See `pen-test-deep-scan/new/scan-1/pocs/CRITICAL-001.sh` — a local-only script that generates a self-forged review evidence set (keypair, signed report, allowed_signers, JSON record) and demonstrates that `ssh-keygen -Y verify` succeeds against the attacker's own allowed_signers. The script creates files only under `/tmp` and does not modify the repository.

## Remediation

Bind the review signature to the same trusted root as the tag signature, or to a separate trusted `docs/reviews/allowed_signers.root` file that is NOT part of the review evidence set (i.e., it pre-exists the candidate commit and is managed via a separate governance process).

Minimal fix in `scripts/independent-review-evidence.ts`: replace the `-f` argument in the `ssh-keygen -Y verify` call (line 306) with a fixed trusted path, and verify the record's `signingIdentity` appears in that file:

```ts
// Use a fixed trusted root, not the record's allowedSignersPath
const trustedAllowedSigners = ".github/allowed_signers"; // or a separate review-specific root
const verification = spawnSync("ssh-keygen", [
  "-Y", "verify",
  "-f", join(cwd, trustedAllowedSigners),
  "-I", record.signingIdentity,
  "-n", signatureNamespace,
  "-s", join(cwd, signaturePath),
], { input: readFileSync(join(cwd, reportPath)) });
```

Additionally, remove `allowedSignersPath` from the `ReviewRecord` schema and from the evidence-file set (reduce to three files: record, report, signature). The allowed_signers root must pre-date the candidate commit and be governed by a process the implementation team cannot unilaterally modify.

If a separate review-specific root is desired (to distinguish tag signers from review signers), create `docs/reviews/trusted-allowed-signers.root`, require it to exist at the `reviewedCommit` (not added in the evidence child), and verify the signing identity against it.

## Verification of fix

```sh
# After fix: forge a review with a self-generated key and confirm the gate rejects it
ssh-keygen -t ed25519 -f /tmp/fake -N ""
# Create evidence files pointing allowedSignersPath at /tmp/fake.pub
# Run: npm run test:release-prerequisites
# Expected: "independent review report SSH signature did not verify" (because
# the gate now checks against .github/allowed_signers, where /tmp/fake.pub is not listed)
```

## References

- CWE-345: Insufficient Verification of Data Authenticity
- CWE-347: Improper Verification of Cryptographic Signature (verifying against an attacker-controlled public key)
- OWASP A08:2021 — Software and Data Integrity Failures
- `docs/testing-and-release.md:45-47` (independent review requirement), `:273-292` (two-commit contract and independence claim)
- Contrast: `scripts/verify-release.ts:72-77` (tag verification uses fixed `.github/allowed_signers` root)
