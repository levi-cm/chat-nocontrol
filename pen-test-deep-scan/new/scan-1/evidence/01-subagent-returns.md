# 01 — Subagent returns (audit trail)

**Scan:** `pen-test-deep-scan/new/scan-1`
**Commit:** `328a20f`
**Rounds:** 2 (Round 3 not warranted — top findings confirmed inline by runner).

## Round 1 (sequential, one at a time)

| # | Child | Model chosen | Scope | Return |
|---|-------|--------------|-------|--------|
| 1 | `crypto-core` | `deepseek-v4-pro` (high-value crypto exploit-chain lane; §3a default for serious scan work) | `src/crypto/**`, `src/workers/**` | ✓ → 1 finding. LOW-001 full `DerivedIdentity` (incl. `masterEntropy` + `signingSecretKey`) shipped to workers via structured clone on every decrypt; decrypt reads only 4 fields (`kemSecretKey`,`x25519SecretKey`,`fingerprint`,`identityId`). Defense-in-depth/least-privilege; exploit needs worker-heap read (same-origin, threat-model §5 disclaims). Hybrid HKDF/AEAD/vault/identity/zeroization/equalBytes all verified sound. |
| 2 | `protocol-binary` | `deepseek-v4-pro` | `src/protocol/**`, `fixtures/**` | ✓ → 0 findings (empty return). Runner spot-verified: `bytes.ts` (bounded `StrictByteReader`, `slice` copies, `requireEnd`), `checksum.ts` (SHA-512[0..16), constant-time `equalBytes`), `ppxt-armor.ts` (exact-line match, regex-validated headers, canonical re-serialize, digest-before-parse), `ppxf.ts:139-175` (sequential `expectedChunkIndex`, `ciphertextLength==plaintextLength+16`, trailing-checksum room). Clean confirmed. |
| 3 | `app-ui-state` | `deepseek-v4-pro` | `src/app/**`, `src/components/**`, `src/flows/**`, `src/i18n/**`, `index.html` | ✓ → 0 findings. Clean. No `dangerouslySetInnerHTML`/`innerHTML`/`eval`; Preact JSX escapes all user data; blob URLs revoked; clipboard 60s clear; recovery PDF password only in private PDF + zeroized on exit; auto-lock wipes on background/timeout; `routeFromHash` allowlist; incoming-intent scrubs fragment before UI init; no `JSON.parse`+merge of untrusted; QR image bounds validated; TOFU w/ fingerprint display. |
| 4 | `supply-chain-build` | `deepseek-v4-pro` (release-gate + cross-cutting integrity — high-value) | `scripts/**`, `.github/**`, `package*.json`, configs, review/release evidence | ✓ → 1 finding. **CRIT-001** release gate accepts self-forged independent review evidence @ `scripts/independent-review-evidence.ts:300` — `ssh-keygen -Y verify -f` uses `record.allowedSignersPath` (attacker-controlled) w/ NO cross-check vs `.github/allowed_signers` trusted root (contrast `verify-release.ts:74` which binds tag sig to fixed root). PoC confirmed: sig verifies against attacker's own key. Deps/lockfile/approved-gate/reproducibility/CI/source-maps(all still fixed)/secrets all clean. |

## Round 2 (sequential, one at a time)

| # | Child | Model chosen | Scope | Return |
|---|-------|--------------|-------|--------|
| 5 | `persistence-sw` | `deepseek-v4-pro` | `src/storage/**`, `src/sw/**`, `src/diagnostics/**`, PWA/manifest, `vite.config.ts` | ✓ → 0 findings. Clean. Vault always AES-GCM before IDB; session-only pure memory; erase clears all 3 stores; contacts public-only; SW cache-policy strict allowlist (no `?`/`#`, regex excludes `/`, no cross-origin `runtimeCaching`); auto-update `skipWaiting`+`clientsClaim` is approved spec + documented threat-model non-claim; diagnostics receives only `{locale,storageMode}`; manifest same-origin. |
| 6 | `tests-coverage-gaps` | `deepseek-v4-pro` | `src/tests/**` | ✓ → 4 findings. LOW-002 no test that vault write withheld until final confirmation / session-only discards prepared vault. LOW-003 no NFKD-canonicalization nor non-wordlist invalid-word rejection test (codec enforces both). LOW-004 no test that vault parsing rejects crafted KDF downgrade (scrypt N<65536). INFO-001 no constant-time assertion test (`equalBytes` is CT; gap observational). §14 NIST KAT/goldens(pinned+`--verify`,non-circular)/mutation/truncation/fuzz/zeroization/tampered-AEAD/MITM-key-swap/downgrade/bounds all covered. |
| 7 | `spec-drift` | `deepseek-v4-pro` | `docs/**` vs `src/**` | ✓ → 3 findings (all LOW, same root cause: PPXQ/v2 shipped without updating `docs/security-architecture.md` §16 normative blocks). LOW-005 §16.4 worker kinds missing `encrypt-qr-text`/`decrypt-qr-text` + QR result types. LOW-006 §12 `PPXCryptoError` union missing `unknown-sender-contact`. LOW-007 §16.2 `EncryptedTextObject` `formatVersion: 0x01` only (code ships v1\|v2). Core §2/§6/§7/§8/§9/§10/§10.1/§11/§13 claims verified to match code. |
| 8 | `cross-cutting-logic` | `deepseek-v4-pro` | identity/recovery + QR exchange + flow cross-refs | ✓ → 1 finding. LOW-008 word-import signs `Date.now()` as `PPXC.creationTime` @ `src/flows/identity/import.tsx:83,98` (§12 `importedAt` contract declared in `types.ts:281-291` but dead — violates "never claim import time is original creation time"). Seams sound: QR MITM = documented TOFU residual + fingerprint displayable; contact rotation indexed by full 32B fingerprint w/ collision warning (no silent overwrite); identityId lookup uses full fingerprint; re-auth boundary + intent-lock race + signing-cap reuse all sound. |

## Runner verification (§7 step 2)

- **CRIT-001**: confirmed directly in source (`independent-review-evidence.ts:238` takes `record.allowedSignersPath`; `:306` passes it as `-f`; caller `check-release-prerequisites.ts:25`; contrast `verify-release.ts:74` fixed root). PoC run → `SIGNATURE VERIFIES ✓`. Severity upheld.
- **LOW-001**: confirmed (`postMessage` ships full identity; grep `activeIdentity.masterEntropy|signingSecretKey` on decrypt paths = 0). Severity upheld.
- **LOW-008**: confirmed (`import.tsx:83` default `Date.now()`, `:120` `importWords` uses default, `:98` → `createPublicContact` signs it; `RecoveryWordsImportInput/Output` grep = 2 hits both declarations). Severity upheld.
- **Protocol parsers** (empty-return child): spot-verified `bytes.ts`, `checksum.ts`, `ppxt-armor.ts`, `ppxf.ts` — strict, bounded, constant-time, canonical. Clean confirmed.
- **LOW-002/003/004, INFO-001** (test gaps): observational, verified by child reading test files. No PoC needed.
- **LOW-005/006/007** (spec-drift): self-evident doc-vs-code diffs w/ PoC `.md` traces. Upheld.

## Round 3

Not warranted. CRIT-001 PoC already demonstrates the exploit (signature verifies against attacker's own allowed_signers; no cross-check vs trusted root). LOW-001/008 confirmed by source read. Test-gap + spec-drift LOWs are observational/self-evident. No borderline finding needed PoC promotion/demotion.

## Total

**CRIT 1 / HIGH 0 / MEDIUM 0 / LOW 8 / INFO 1.** One real exploitable release-gate bypass (CRIT-001). Crypto/protocol/UI/persistence layers clean. Remaining findings are defense-in-depth + test-gap + doc-accuracy LOWs.
