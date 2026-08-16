# Deep-Scan Penetration Test — scan-1 Summary

**Scan:** `pen-test-deep-scan/new/scan-1`
**Date:** 2026-07-16
**Commit:** `328a20f` ("fix: preserve explicit contact mutation intent")
**Runner model:** `glm-5.2`
**Scope:** Full `encryption-web` / `chat-nocontrol` source tree (248 TS/TSX files) — crypto core, protocol binary, app/UI/state, supply chain/build/CI, persistence/service-worker, tests, spec-drift, cross-cutting identity/QR seams.
**Method:** 2 rounds × 4 sequential subagents (disjoint subsystem ownership) + runner verification of top findings + protocol-parser spot-check.

## Result at a glance

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 8 |
| INFO | 1 |
| **Total** | **10** |

**One real exploitable release-gate bypass (CRIT-001). Cryptographic core, protocol binary layer, web/UI/DOM, and persistence/service-worker layers are clean — no exploitable confidentiality/integrity/auth-bypass/key-recovery flaw found at the depth reached.** The remaining 8 LOW + 1 INFO are defense-in-depth, test-gap, and doc-accuracy observations; none is a direct E2EE exploit.

## Top findings

| ID | Sev | Title | Location | One-line impact |
|----|-----|-------|----------|-----------------|
| CRIT-001 | CRIT | Release gate accepts self-forged independent review evidence | `scripts/independent-review-evidence.ts:300`, `:238`; `check-release-prerequisites.ts:25` | `ssh-keygen -Y verify -f` uses `record.allowedSignersPath` (attacker-controlled) w/ no cross-check vs `.github/allowed_signers` trusted root → insider self-attests own code → unaudited deploy of malicious code to GitHub Pages. PoC confirmed. |
| LOW-001 | LOW | Full `DerivedIdentity` (incl. `masterEntropy`) shipped to workers on every decrypt | `src/workers/crypto-client.ts:82`, `file-client.ts:104` | 32-byte recovery authority + Ed25519 seed copied into worker heap unnecessarily; decrypt reads only 4 fields. Defense-in-depth; needs worker-heap read (same-origin, threat-model §5 disclaims). |
| LOW-002 | LOW | No test that vault write is withheld until final confirmation / session-only discards prepared vault | `src/flows/identity/create.tsx:793` (test gap) | §14-normative test missing; masks plausible early-persistence class (impl currently correct). |
| LOW-003 | LOW | No NFKD-canonicalization nor non-wordlist invalid-word rejection test | `src/tests/unit/recovery-words.test.ts:15` (test gap) | Codec enforces both at `recovery-words.ts:13,29`; only wrong-count + checksum-invalid tested. §14 normative. |
| LOW-004 | LOW | No test that vault parsing rejects crafted KDF downgrade (scrypt N<65536) | `src/protocol/ppxv.ts:96` (test gap) | Parser binds params pre-checksum; vault-failure.test covers oracle collapse, not downgrade. §16.1-adjacent. |
| LOW-005 | LOW | §16.4 worker contract block missing PPXQ kinds + result types | `docs/security-architecture.md` §16.4 vs `src/crypto/contracts.ts:23-32`, `src/workers/crypto-runner.ts:73-94` | Stale normative block after PPXQ shipped; doc-accuracy. |
| LOW-006 | LOW | §12 `PPXCryptoError` union missing `unknown-sender-contact` | `docs/security-architecture.md` §12 vs `src/protocol/types.ts:12-21`, `ppxq-inner.ts:106` | Stale normative block after PPXQ shipped; doc-accuracy. |
| LOW-007 | LOW | §16.2 `EncryptedTextObject` contract missing v2 union | `docs/security-architecture.md` §16.2 vs `src/protocol/types.ts:144-145`, `ppxt-outer.ts:15-24` | Stale normative block after PPXT v2 shipped (v2 behavior documented in `protocol-v2.md`/§10); doc-accuracy. |
| LOW-008 | LOW | Word-import signs import time as `PPXC.creationTime` (§12 `importedAt` contract unimplemented) | `src/flows/identity/import.tsx:83,98,120`; `src/protocol/types.ts:281-291` | `Date.now()` signed into `PPXC.creationTime`; §12 says "never claim import time is original creation time". `RecoveryWordsImportInput/Output` w/ `importedAt` are dead code. Integrity/metadata only (fingerprint excludes creationTime → E2EE binding preserved). |
| INFO-001 | INFO | No constant-time assertion test | `src/protocol/checksum.ts:7` (test gap) | `equalBytes` is correct XOR-accumulate constant-time; gap observational only. |

## Subsystem heat map

| Subsystem | Findings | Notes |
|-----------|----------|-------|
| Supply chain / build / release gate | 1 (CRIT) | Release-gate self-forged review — the single real exploit. |
| Crypto core + workers | 1 (LOW) | Worker identity over-share (defense-in-depth). Primitives sound. |
| Protocol / binary | 0 | Parsers strict, bounded, constant-time. Clean. |
| App / UI / state | 0 | No XSS, no DOM injection, no secret exposure. Clean. |
| Persistence / SW | 0 | Vault encrypted at rest; SW cache strict; auto-update is approved spec + documented non-claim. Clean. |
| Tests / coverage gaps | 4 (3 LOW + 1 INFO) | §14-normative gaps; impl currently correct. |
| Spec drift | 3 (LOW) | Stale §16/§12 doc blocks after PPXQ/v2 shipped. |
| Cross-cutting identity/QR | 1 (LOW) | Word-import creationTime spec-drift. QR MITM = documented TOFU residual. |

## Cross-cutting themes

1. **Release-gate binding is the weak point, not the crypto.** The hybrid HKDF, AEAD, Ed25519, scrypt vault, BIP39 recovery, zeroization, and constant-time compares all match the spec and are sound. The one CRITICAL is a supply-chain trust-root binding defect: the independent-review signature is verified against an attacker-supplied allowed_signers file rather than a fixed trusted root (contrast the tag-signing gate which does bind to `.github/allowed_signers`).
2. **PPXQ/v2 shipped faster than the normative doc blocks updated.** LOW-005/006/007 share one root cause: `docs/security-architecture.md` §12/§16 contract blocks were not refreshed when PPXQ and PPXT v2 landed. The implementation behavior is documented in `protocol-v2.md` / `protocol-qr-message-v1.md` / §10 — only the §12/§16 normative type unions are stale.
3. **Defense-in-depth gaps are the residual, not exploits.** LOW-001 (worker over-share), LOW-002/003/004 (missing §14 tests), INFO-001 (no CT assertion test) all describe cases where the implementation is currently correct but the least-privilege / regression-test safety net is thinner than the spec mandates.
4. **Spec-vs-code: one real behavioral drift.** LOW-008 is the only finding where code behavior (not just a doc block) diverges from a normative spec rule: the word-import path signs `Date.now()` as `PPXC.creationTime`, which §12 explicitly forbids. Impact is metadata authenticity, not key recovery (fingerprint excludes `creationTime`).

## Spec-drift summary

- **Behavioral drift (code ≠ spec rule):** LOW-008 (word-import `creationTime`). Real but low-impact (signed-metadata provenance; E2EE binding preserved).
- **Documentation drift (stale normative type blocks):** LOW-005, LOW-006, LOW-007. Implementation matches the newer protocol docs; only `security-architecture.md` §12/§16 contract blocks are stale.
- **Core security-architecture claims verified to match code:** §2 claims, §6 key derivation labels + salt, §7 hybrid HKDF info string + IKM, §8 sender PPXC in encrypted inner + outer reveals no sender metadata, §9 vault scrypt params + unlock-error collapse + password-handling sinks, §10/§10.1 message-link fragment scrub + 15-min TTL + one-decrypt-worker, §11 file-decrypt output withheld until all checks pass, §13 zeroization, §14 verification (largely covered), §16.1/16.3 byte layouts (884-byte header, 16-byte SHA-512[0..16) checksum, chunk records).

## Recommended fix priority order

1. **CRIT-001 (now):** Bind the review signature to a fixed trusted root (`.github/allowed_signers` or a separate review-specific root that pre-dates the candidate commit), not `record.allowedSignersPath`. Remove `allowedSignersPath` from the `ReviewRecord` schema + evidence-file set. This is the only finding that gates an unaudited-deployment exploit path.
2. **LOW-008 (next):** Wire the §12 `importedAt` contract through the word-import seam (mirror the PPXR/PPXV explicit-`creationTime` pattern; do not sign `Date.now()` as `PPXC.creationTime`). Either consume the dead `RecoveryWordsImportInput/Output` types or remove them.
3. **LOW-005/006/007 (doc pass):** Refresh `docs/security-architecture.md` §12 `PPXCryptoError` union (`+unknown-sender-contact`) and §16.2/§16.4 contract blocks (`+v2 union`, `+encrypt-qr-text`/`decrypt-qr-text` kinds + QR result types) to match shipped code.
4. **LOW-002/003/004 (test pass):** Add the three §14-normative regression tests (vault-write-before-confirmation, recovery-word NFKD + non-wordlist rejection, vault KDF-downgrade rejection).
5. **LOW-001 (defense-in-depth):** Introduce a `DecapsulationCapability` type carrying only the 4 fields decrypt needs; construct it on the main thread before `postMessage` so `masterEntropy`/`signingSecretKey` never enter the worker heap.
6. **INFO-001 (optional):** Add a constant-time assertion test for `equalBytes`.

## What was NOT tested and why

- **Live deployment / GitHub Pages state** (OPEN-001, OPEN-002 from prior audits): out of scope per `AGENTS.md` ("never deploy") + this prompt's hard constraints ("do not attack live infrastructure"). CRIT-001 is the in-tree mechanism behind those external-state issues; the live deployment itself was not probed.
- **Constant-time execution at the hardware/microarchitectural level:** threat-model §13 + §5 explicitly disclaim side-channel resistance beyond library guarantees; `equalBytes` is XOR-accumulate but JS-runtime guarantees are limited. Not tested further.
- **Forward secrecy / ratchet / post-quantum signatures / message-length padding / guaranteed secure deletion:** documented non-claims (threat-model §2/§5); not reported as findings.
- **Browser extension / compromised-OS / compromised-deployment attack paths:** threat-model §5 explicitly out of scope. LOW-001's worker-heap-read scenario is the closest edge and is rated accordingly.
- **Provider swaps beyond the 3 in-tree providers** (`default`/`noble`/`webcrypto`): `check-crypto-provider-contract.ts` + `provider-capability.test.ts` cover the in-tree contract; hypothetical future providers not tested.
- **Full `npm run verify:quality` / e2e / release-test suites:** not run (long-running, browser-required, and out of scope for a read-only source audit). `npm run typecheck` + `npm run lint` ran clean to confirm the tree was unchanged by the audit.
- **Round 3 PoC children:** not spawned. CRIT-001's PoC already demonstrates the exploit; all other findings are confirmed by source read or are observational.

## Audit metadata

```
SCAN=pen-test-deep-scan/new/scan-1
COMMIT=328a20f
DATE=2026-07-16
RUNNER_MODEL=glm-5.2
CHILDREN=8 (deepseek-v4-pro ×8)
ROUNDS=2
TYPECHECK=clean
LINT=clean
TREE=unchanged by audit (writes only under ${SCAN}/)
CRIT=1 HIGH=0 MED=0 LOW=8 INFO=1
```

**Most urgent:** CRIT-001 — release gate accepts self-forged independent review evidence @ `scripts/independent-review-evidence.ts:300`. See `findings/CRITICAL/CRITICAL-001-release-gate-self-forged-review.md` + PoC `pocs/CRITICAL-001.sh`.
