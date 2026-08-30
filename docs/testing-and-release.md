> **Authority:** Normative testing and release contract for `0.2.0-beta.1`.
> **Depends on:** [protocol-cat5-v2.md](protocol-cat5-v2.md), [legacy-v1-compatibility.md](legacy-v1-compatibility.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [github-pages-deployment.md](github-pages-deployment.md)

# Testing and release contract

## Evidence labels

- **PASS:** named gate ran against exact source/artifact and passed.
- **FAIL:** named gate ran and failed.
- **BLOCKED:** required external evidence cannot yet be supplied.
- **NOT RUN:** no qualifying execution evidence.

Do not infer external review, physical-device behavior, or live deployment from
local unit/E2E/build success.

## Required local gates

```bash
npm run docs:check
npm run typecheck
npm run lint
npm run format:check
npm run test:primitive-vectors
npm run test:provider-contract
npm run test:ppx-golden
npm run test:parser-property
npm run test:parser-fuzz
npm run test:mutations
npm run test:truncations
npm run test:boundaries
npm run unit
npm run test:e2e
npm run test:accessibility
npm run test:i18n
npm run test:offline
npm run test:pwa-update-policy
npm run test:network-denial
npm run build
```

Use exact Node version from `.node-version`. `verify:quality` aggregates quality
gates. `release:prepare` creates deterministic bytes for the current checkout,
locked dependencies, Node version, and runner. `test:reproducibility` rebuilds
twice in that same checkout/runtime and compares `dist` plus archive hashes; it
is not independent clean-machine or cross-platform reproducibility proof. The
CycloneDX SBOM includes package URLs, lockfile SRI hashes where present, package
paths, and a deterministic dependency graph. `verify` runs quality, preparation,
then fail-closed prepared-release gates; it remains blocked when genuine review,
physical-device, tag, or release evidence is absent.

## Protocol matrix

| Area | Required proof |
| --- | --- |
| CAT-5 primitives | Pinned FIPS 203 ML-KEM-1024 and FIPS 204 ML-DSA-87 vectors |
| Identity/domains | Exact derivation labels, suite, fingerprint, family KDF goldens |
| V2 codecs | PPXC/PPXT/PPXM/PPXF/PPXR/PPXV exact sizes and digests |
| Parser safety | Oversize-before-allocation, truncation, mutation, flags, trailing bytes |
| Downgrade | `0x01/0x01`, `0x02/0x01`, `0x01/0x02`, unknown and mixed fail in V2 provider |
| Text | PPXT/PPXM binding, AEAD/signature-before-release, bounded gzip/UTF-8 |
| File | 0/100 MiB bounds, order, chunks, manifest, Blob memory, cancel |
| Transport | PPXT armor; PPXT/PPXM `#/m/`; canonical HTTPS; no-navigation and fragment-leak proof; no V2 PPXQ/QR output |

## Read-old/write-new matrix

Tests must prove V1 PPXT formats 1/2, PPXF, full links, PPXQ text/link with
temporary exact V1 sender PPXC, PPXR, PPXV, stored vault, and recovery words.
They must also prove no V1 writer/encrypt/send/contact persistence; temporary
V1 sender contacts may survive individual decrypts only in bounded memory for
the current unlocked identity session and are cleared on lock, identity
replacement/import/deletion, erase-all, reload, tab close, and session teardown.
Worker request copies and private material are erased after all terminal/race
paths. Include old `#/m/<BASE64URL>` carrying either PPXT or PPXQ. No old app is
needed; all migration output is V2.

## Product and accessibility

Test identity, contacts file/text, text/link, file, recovery QR, vault,
session-only, storage denial, EN/DE parity, keyboard, focus, screen-reader names,
zoom/reflow, reduced motion, offline shell, and safe error copy. Assert no V2
contact/message QR button or generation path. Legacy `#/decrypt/qr` is
decode-only.

Link tests must prove writers use only the canonical GitHub Pages HTTPS origin;
readers never navigate to an encoded URL/host; query and fragment are replaced
early with same-origin `#/decrypt`; and fragments, message bodies, temporary
contacts, and plaintext are absent from requests/referrers, history state,
Web Storage, IndexedDB, Cache Storage, service-worker caches, resource timing,
logs, diagnostics, telemetry, and crash reports.

## Real two-build PWA gate

The PWA update gate must use two genuine production trees, not synthetic shell
fixtures:

1. Serve and install the repository-pinned deployed legacy commit and verify
   its expected file tree and SHA-256 pins.
2. Open a canonical fragment-bearing message link and prove the fragment body
   appears in no request, storage, cache, or resource-timing entry.
3. Switch the same origin to current production `dist`, request service-worker
   update, and prove activation without banner, prompt, or choice. The deployed
   legacy document must be replaced by exactly one same-origin, same-scope,
   version-marked CAT5 navigation. A current-version document must not be
   interrupted and the cutover must not loop.
4. Prove every known legacy-only hashed asset is absent from all caches while
   current precache assets remain available. Prove the supported fragment is
   captured in memory, scrubbed from URL/history, and absent from requests,
   storage, caches, resource timing, and test artifacts.
5. Prove the current bundle/version is already active before a manual reload;
   then reload, close, and reopen offline and prove CAT5 still controls the app.

The exact pinned-legacy-to-current automated gate passed on 2026-08-11 in
desktop and mobile Chromium projects. Other browser projects are intentionally
skipped because this gate exercises Chromium service-worker state. Physical
Android/iPhone/PWA execution remains a separate **NOT RUN** gate.

## External gates

Owner-attested human security review follows one immutable chain:

1. Freeze the exact candidate commit. `.github/allowed_signers` must contain
   exactly one namespace-`git` release signer; unrestricted, duplicate, or
   non-Git entries are invalid.
2. A human reviewer completes the report for that exact candidate. The record
   retains reviewer identity and an independence statement. The repository
   owner attests the record with the authenticated GitHub actor and sole release
   signer principal. This asserts identity; it does not independently
   authenticate reviewer identity, and the owner accepts that residual risk.
3. Create exactly one immediate child of the reviewed candidate. It may add
   only these two regular, non-executable evidence files:
   **docs/security-review-attestation.json** and
   **docs/reviews/security-review.md**. The closed schema binds candidate, report
   SHA-256, reviewer identity, outcome, issue count, and canonical timestamps.
4. At release HEAD prove `HEAD^ == reviewedCommit`, the candidate-to-HEAD diff
   is exactly those two additions, and worktree evidence matches HEAD.
5. Only then create the exact signed annotated release tag at HEAD and verify
   its `git`-namespace signature, local/remote tag object identity, origin/main
   containment, source/artifact/SBOM/reproducibility bindings, and rollback
   pointer.

This review gate is currently **BLOCKED** because no genuine closed-schema
record/report chain exists. Never promote example JSON as review evidence.

The complete physical matrix in [qr-message-device-matrix.md](qr-message-device-matrix.md)
is **NOT RUN**. Every required flow must pass on Android Chrome, Android
installed PWA, iPhone Safari, and iPhone home-screen PWA with exact
tag/commit/artifact, device/OS/browser/PWA version, locale, route, input path,
timestamp, expected/actual result, screenshots/logs, hashes, and tester signoff.
Desktop emulation is not physical evidence. Recovery QR is the only new V2 QR
flow; contact/message flows use file/text/link.

### Physical-evidence binding and import

Physical evidence is external runtime output and must not be committed into the
reviewed source chain. On the exact evidence-only release HEAD:

```bash
npm run verify:quality
npm run release:prepare
npm run release:physical-evidence-bindings > /tmp/cat5-physical-bindings.json
```

Give the tester the build plus the public binding JSON and the closed schema at
`docs/physical-device-release-evidence.schema.json`. The completed evidence
must contain no plaintext, ciphertext, contacts, keys, recovery material, or
unredacted screenshots. The owner attests that the named operator performed the
recorded checks against the exact bytes. This preserves physical-test and byte
bindings but does not independently authenticate the operator identity.

Import the returned regular JSON with its out-of-band SHA-256. The importer
also authenticates the workflow actor as repository owner:

```bash
npm run release:import-physical-evidence -- \
  --input /absolute/path/physical-device-release-evidence.json \
  --sha256 <64-lowercase-hex> \
  --owner-actor levi-cm
npm run test:release-prerequisites
```

The importer opens without following symlinks, limits size, rejects executable
or unknown fields, compares the exact digest, validates the owner attestation
and every required row against the reviewed candidate and prepared bytes,
writes the JSON atomically, removes the exact legacy generated signature path,
and revalidates it. Invalid or non-owner-dispatched input does not become
release evidence.

After all pre-tag prerequisites pass, create and push the exact signed tag.
Create a draft prerelease for that tag and upload the fixed asset name
`physical-device-release-evidence.json` only. Dispatch
`release.yml` with the tag, same JSON SHA-256, and explicit deployment
confirmation as the repository owner. CI downloads only that asset from the matching draft
prerelease, prepares release bytes, verifies/imports them, and runs
`verify:prepared`. It then CAS-appends the exact artifact/run authorization to
the canonical ledger before Pages can mutate. After live acceptance it
CAS-appends successful deployment evidence; only then can the draft become a
public prerelease.

## Release/deployment gate

Release requires all required automated checks, zero open critical/high issues,
owner-attested human review PASS, physical matrix PASS where required, exact signed tag,
commit/artifact hash, SBOM, reproducibility result, rollback pointer, and explicit
deployment approval. Canonical URL remains GitHub Pages. Failed/blocked/not-run
gates prevent reviewed-release claims.
