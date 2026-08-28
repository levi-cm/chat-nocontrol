> **Authority:** CAT5 source-remediation ledger for the preserved deep scan.
> **Scan source:** `pen-test-deep-scan/new/scan-1/`
> **Target release:** `0.2.0-beta.1`

# CAT5 deep-scan remediation

## Scope and status language

This ledger rebaselines `CRIT-001`, `LOW-001` through `LOW-008`, and
`INFO-001` against the merged CAT5 source. The original scan directory is
provenance and must remain unchanged. `RESOLVED` below means the reported source
defect or regression-test gap is closed and has focused executable evidence. It
does not mean independent review, physical-device qualification, deployment, or
release acceptance has occurred.

The independent-review and physical-device release gates remain `BLOCKED` until
real external principals and their precommitted public keys exist. In
particular, the fixed review root currently has no independent-review entry;
that absence fails closed rather than permitting project code to select a key.

## Finding ledger

| Finding | Status | Remediation and code authority | Executable evidence |
| --- | --- | --- | --- |
| `CRIT-001` | **RESOLVED; external review remains BLOCKED** | `scripts/independent-review-evidence.ts` uses the fixed `.github/allowed_signers` path, the exact `chat-nocontrol-security-review-cat5-v2` namespace, a distinct principal/key role, and an unchanged trust-root blob that predates the candidate. The release head must be the candidate's single immediate child and may add exactly the three named review files. Evidence JSON cannot nominate a signer file. | `src/tests/unit/independent-review-evidence.test.ts` rejects an untrusted key, release-signer reuse, wrong namespace/principal, candidate-time or later trust-root changes, non-child history, altered evidence, and extra files. |
| `LOW-001` | **RESOLVED** | `DecapsulationCapabilityV2` in `src/protocol/types-v2.ts` contains only request-scoped decapsulation fields. `src/crypto/identity-v2.ts` creates it; `src/workers/crypto-client.ts`, `file-client.ts`, and their runners validate, transfer, and erase it. The isolated V1 reader receives only operation-owned legacy material required for decode/migration. | `src/tests/unit/provider-capability.test.ts`, `crypto-client.test.ts`, and `file-runner.test.ts` prove validation, transfer, zeroization, and absence of `masterEntropy` from V2 decrypt requests. |
| `LOW-002` | **RESOLVED** | Identity creation retains the prepared vault until the final explicit persistence choice. Session-only completion hands off no vault; remembered completion hands off the verified vault only at the final step. | `src/tests/unit/identity-create-wizard.test.tsx` proves both final-confirmation branches and asserts no earlier `onReady` handoff. |
| `LOW-003` | **RESOLVED** | `src/crypto/recovery-words.ts` NFKD-normalizes input before canonical lowercase/list validation and rejects words outside the pinned BIP39 list. | `src/tests/unit/recovery-words.test.ts` covers compatibility-character NFKD input, case/space handling, non-wordlist rejection, wrong length, and checksum-invalid words. |
| `LOW-004` | **RESOLVED** | V1 and V2 PPXV parsers bind exact scrypt parameters (`N=65,536`, `r=8`, `p=2`) and reject mixed V1/V2 or checksum-valid downgraded headers before vault KDF use. | `src/tests/unit/ppxv.test.ts` and `ppxv-v2.test.ts` mutate headers, recompute checksums, and require fail-closed parsing. |
| `LOW-005` | **RESOLVED** | The obsolete monolithic worker-contract block is replaced by the authoritative CAT5 boundary in `docs/security-architecture.md`, the decode-only V1 request list in `docs/legacy-v1-compatibility.md`, the V2 request unions in `src/protocol/types-v2.ts`, and `src/workers/legacy-v1-contracts.ts`. V2 has no PPXQ writer. | `npm run docs:check`, `npm run test:provider-contract`, and `src/tests/unit/worker-contracts.test.ts` enforce documentation authority, no V1 write surface, and exhaustive worker dispatch. |
| `LOW-006` | **RESOLVED** | `unknown-sender-contact` is an explicit protocol error in `src/protocol/types.ts` and is documented as a legacy PPXQ known-sender lookup result in `docs/protocol-qr-message-v1.md` and the user guides. | `src/tests/unit/qr-text-crypto.test.ts`, `text-v2.test.ts`, `legacy-v1-reader.test.ts`, and `legacy-v1-runner.test.ts` cover the error and its fail-closed boundary. |
| `LOW-007` | **RESOLVED** | The authoritative V2 text families and unions are defined in `src/protocol/types-v2.ts` and `docs/protocol-cat5-v2.md`; `docs/protocol-v2.md` is explicitly the legacy suite-1 compressed PPXT reference. CAT5 writers emit only V2 PPXT/PPXM while V1 PPXT/PPXQ stay decode-only. | `npm run test:ppx-golden`, `src/tests/unit/text-v2.test.ts`, `message-link.test.ts`, and provider-contract tests bind the exact families and reject downgrade/mixed-suite output. |
| `LOW-008` | **RESOLVED** | `importRecoveryWords` in `src/flows/identity/import.tsx` signs unknown original `creationTime` as `0`; local `importedAt` is separate metadata and is never represented as original identity creation time. | `src/tests/unit/identity-import-words.test.tsx` binds derived identity/contact creation time to zero, preserves local import time, and verifies secret cleanup on rejected handoff. |
| `INFO-001` | **RESOLVED** | `equalBytes` in `src/protocol/checksum.ts` performs a complete XOR-accumulate loop for equal-length inputs, with no data-dependent control flow in that loop. Length is public protocol shape. | `src/tests/unit/equal-bytes-constant-time.test.ts` parses the function AST, enforces one full loop/no loop control flow, and proves `if`, `break`, `continue`, and `return` mutations are rejected. |

## Fresh focused verification

Run under exact Node `22.23.1`:

```sh
npx vitest run \
  src/tests/unit/independent-review-evidence.test.ts \
  src/tests/unit/provider-capability.test.ts \
  src/tests/unit/crypto-client.test.ts \
  src/tests/unit/file-runner.test.ts \
  src/tests/unit/identity-create-wizard.test.tsx \
  src/tests/unit/recovery-words.test.ts \
  src/tests/unit/ppxv.test.ts \
  src/tests/unit/ppxv-v2.test.ts \
  src/tests/unit/identity-import-words.test.tsx \
  src/tests/unit/equal-bytes-constant-time.test.ts
npm run docs:check
npm run test:provider-contract
git diff --exit-code origin/main -- pen-test-deep-scan
```

Rebaseline result on 2026-08-28: `55/55` focused tests passed; documentation
contracts passed; the CAT5 provider contract passed; the preserved scan tree had
no diff from `origin/main`.

## Mobile WebKit recovery rebaseline

The exact seven-screen create/export/recovery verification journey passed `5/5`
serial mobile WebKit repetitions. A later complete matrix reproduced a related
retry-state defect in locked legacy PPXV import: when passphrase input and retry
submission occurred in one UI turn, the worker could receive the prior rendered
passphrase. A RED unit test captured that transition. File and QR import now use
a synchronously updated passphrase ref at worker dispatch; KDF parameters and
timeouts were not changed. The locked-PPXV mobile WebKit case then passed `5/5`,
and the complete desktop + mobile WebKit matrix passed `160` tests with `14`
profile-conditional skips and no failures. This is browser automation evidence,
not physical iPhone/PWA evidence.

## Release consequences

- No critical/high source finding from this scan remains open.
- A genuine independent reviewer key must still be added to the fixed trust root
  in a commit that predates the frozen candidate. Until then review is
  `BLOCKED`, intentionally.
- Physical-device evidence, signed promotion, and Pages deployment are separate
  gates. This remediation ledger cannot satisfy them.
- Any code change after candidate freeze invalidates later review, physical
  evidence, byte hashes, and tag preparation.
