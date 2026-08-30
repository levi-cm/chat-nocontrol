> **Authority:** Normative GitHub Pages deployment contract.
> **Target release:** `0.2.0-beta.1`
> **Depends on:** [testing-and-release.md](testing-and-release.md), [security-architecture.md](security-architecture.md)

# GitHub Pages deployment

Canonical URL is `https://levi-cm.github.io/chat-nocontrol/`. No custom domain
is authorized or planned by this contract. Local changes, builds, tests,
commits, tags, and previews do not authorize deployment; explicit user request
is required.

## Hosting model

Static GitHub Actions artifact only: no backend, DB, account, telemetry, remote
script/font/image, or secret server logic. App must work under repository base
path with hash routing. Meta CSP is defense-in-depth because Pages cannot supply
arbitrary project response headers.

All newly generated links use only
`https://levi-cm.github.io/chat-nocontrol/`. Incoming fragment handling never
navigates to an encoded host. It captures a bounded fragment locally, replaces
query/history early with same-origin `#/decrypt`, and keeps fragment/message
bytes out of HTTP requests and referrers, history state, storage, caches,
service-worker caches, logs, diagnostics, telemetry, and crash reports.

Service worker may cache app shell and versioned hashed assets only. It must
never cache identities, contacts as user data, imported/decrypted files,
messages, link payloads, vault/recovery material, or diagnostics.

## Legacy rollback baseline

The pre-cutover Pages state verified on 2026-08-28 is:

- canonical URL `https://levi-cm.github.io/chat-nocontrol/`;
- `build_type: legacy`;
- source branch `gh-pages`, path `/`;
- immutable source commit
  `1a3a5b4d5e55ab78d2bf4692eed2d3545856e291`;
- HTTPS enforced and no CNAME.

The same immutable commit is pinned by the real two-build PWA upgrade test.
After cutover the branch remains only as an unserved emergency pointer. It may
be restored with this exact configuration only if the first CAT-5 cutover
fails; it is never offered as an alternate app or user-selectable version.

## Silent update

Discovered update activates silently. No update banner, modal, prompt, or
choice. A client already running the exact activated CAT5 version is not
interrupted. A client that does not answer the bounded exact-version probe is
navigated at most once to the same HTTPS origin and service-worker scope with a
version-only cutover marker. Only bounded supported `#/m/...` and
`#/decrypt/qr/...` fragments survive that navigation; CAT5 captures them in
memory, immediately replaces the visible URL with `#/decrypt`, and removes the
fragment-bearing history entry. Ciphertext is never placed in a request,
storage, cache key, diagnostic, or test artifact. Rollback remains an operator
release action.

Release evidence must exercise the pinned real deployed legacy tree as build
one and current production `dist` as build two on the same origin. It proves
tree/hash pins, one bounded forced legacy cutover, no actionable legacy banner,
no reload loop or same-version interruption, no fragment leak or retained
fragment history, removal of every known legacy-only cache entry, retention of
current precache assets, the current bundle before and after manual reload, and
the current bundle after offline close/reopen. The focused real-build gate
passed on 2026-08-28; this does not close owner-attested review, physical-device,
or deployment gates.

## Candidate, review, and tag chain

The reviewed candidate is frozen before human review. `.github/allowed_signers`
must contain exactly one namespace-`git` release signer. Reviewer identity and
independence are retained in the closed record; the repository owner attests
them, accepting that identity is asserted rather than independently
signature-authenticated.

Review evidence is one immediate child commit: `HEAD^` must equal the reviewed
candidate, and the diff may add only
**docs/security-review-attestation.json** and
**docs/reviews/security-review.md**. No source, workflow, or other evidence
change is allowed.
After this proof passes, create the exact signed annotated release tag at HEAD
and verify its local and origin tag object and commit binding. The missing
genuine owner-attested record/report keeps this chain **BLOCKED**.

## Predeployment gate

Before dispatch:

1. All required release gates PASS; blocked/not-run gates remain blockers.
2. Frozen-candidate → exact two-file evidence child → `HEAD^` proof → signed
   annotated tag chain passes with the sole Git release signer.
3. Owner-attested physical-device evidence required by the release matrix
   exists and binds all four physical profiles to the exact release bytes.
4. Exact signed tag, commit SHA, artifact hash, dependency-graph/SRI SBOM,
   same-run reproducibility result, build log, and previous rollback pointer are
   recorded.
5. Production artifact has correct base path, no source maps, no remote loads,
   expected CSP, and correct forced-cutover behavior.
6. User explicitly approves deployment.

CI CAS-appends exact artifact authorization to the canonical ledger before the
Pages deployment job can start. After dispatch, verify workflow, environment,
Pages URL, deployed commit/tag, asset behavior, successful-deployment ledger
entry, and rollback record live. Public prerelease publication occurs only after
that post-deployment ledger CAS succeeds. Until then deployment is **NOT RUN**.
