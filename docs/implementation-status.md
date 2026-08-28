> **Authority:** Current implementation-status ledger.
> **Target:** `0.2.0-beta.1`
> **Evidence rule:** Status changes require fresh execution evidence.
> **Depends on:** [testing-and-release.md](testing-and-release.md), [protocol-cat5-v2.md](protocol-cat5-v2.md), [legacy-v1-compatibility.md](legacy-v1-compatibility.md)

# Implementation status

## Implemented source scope

- CAT-5/V2 identity, PPXC, PPXT/PPXM, PPXF, PPXR, PPXV, ML-KEM-1024,
  ML-DSA-87, domain/family separation, and bounded codecs exist.
- CAT-5/V2 is intended sole create/write/encrypt path.
- V2 contact transport is file/text; V2 message transport is armor/link.
- Recovery QR remains; V2 contact/message QR creation is removed by contract.
- V1 isolated reader/migrator exists for text/file/private recovery paths.

This source inventory is backed by the fresh exact-node evidence recorded below.

## Imported deep-scan closure

The historical findings in `pen-test-deep-scan/new/scan-1` describe the
pre-CAT-5 baseline. They remain immutable audit evidence; the current CAT-5
candidate closes them as follows:

| Finding | Current closure |
| --- | --- |
| CRIT-001 | Review evidence is bound to the fixed `.github/allowed_signers` trust root, the CAT-5 review namespace, a trust root predating the candidate, and an exact three-file evidence-only child. The record cannot select its own signer file. |
| LOW-001 | V2 decrypt workers receive a request-owned `DecapsulationCapabilityV2`, not a full identity or master entropy. Legacy PPXQ receives only the request-owned V1 material required by its explicit decode-only boundary. |
| LOW-002 | Identity creation tests prove remembered-vault persistence occurs only after final confirmation and session-only completion discards the prepared vault. |
| LOW-003 | Recovery-word tests cover NFKD normalization and rejection of words outside the pinned list. |
| LOW-004 | V1 and V2 PPXV tests reject checksum-valid scrypt parameter downgrades. |
| LOW-005/006/007 | The CAT-5 protocol and security authorities replace the stale suite-1/PPXQ unions. V2 contact/message QR creation was removed; `unknown-sender-contact`, the V1/V2 text union, and the decode-only legacy worker contract are authoritative. |
| LOW-008 | Word import preserves unknown original creation time as `0` and records local import time separately. Tests bind the derived identity and exported contact to that rule. |
| INFO-001 | A structural regression test enforces the XOR-accumulate, no-early-return shape of `equalBytes`. |

## Required final compatibility state

| Requirement | Required state |
| --- | --- |
| V1 PPXT formats 1/2 | Decrypt |
| V1 PPXF | Decrypt/download only |
| V1 `#/m/` PPXT or PPXQ links | Decrypt |
| V1 PPXQ/text/old link | Decrypt with temporary exact V1 sender PPXC |
| V1 sender PPXC | Unlocked-session memory only; clear on lock/session end; never persist |
| V1 PPXR/PPXV/words/stored vault | Migrate to V2 |
| V1 creation/write/encrypt/send | Unavailable |

## Release gates

| Gate | Status | Reason |
| --- | --- | --- |
| Exact local quality matrix | PASS | 2026-08-28 `npm run verify:quality` under Node 22.23.1: format/type/lint/docs, 755 unit, vectors/contracts/goldens/property/fuzz, 404 applicable full E2E with 31 intentional profile skips, accessibility, EN/DE, offline/PWA, network-denial, deterministic production artifact, SBOM, and zero-high dependency gates passed |
| CAT-5/V2 independent external review | BLOCKED | No genuine exact-release evidence supplied |
| Physical Android/iOS/PWA matrix | NOT RUN | No qualifying real-device evidence supplied |
| Real deployed-build to current-build PWA update | PASS | 2026-08-28 pinned-tree desktop/mobile Chromium gate proved one-shot forced cutover, no banner/loop/leak, cache cleanup, reload, and offline reopen |
| Reviewed `0.2.0-beta.1` release | BLOCKED | Depends on above gates and provenance |
| GitHub Pages deployment of target | NOT RUN | Requires explicit approval and release gate |

No example review JSON, prior V1 review, emulator result, local build, or docs
update may close external/device/deployment gates.

## PWA contract

Update is silent: no banner/choice. Exact same-version clients stay open;
legacy/different-version clients receive at most one controlled same-origin
CAT5 navigation. The release test uses the pinned real deployed legacy tree as
build one and current `dist` as build two, then proves forced cutover, fragment
capture and history scrubbing, obsolete cache cleanup, retained current assets,
no loop, reload, and offline reopen. The automated PWA gate is PASS; physical
devices remain separately NOT RUN.
