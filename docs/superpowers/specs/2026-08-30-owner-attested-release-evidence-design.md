# Owner-attested CAT5 release evidence design

**Approved:** 2026-08-30
**Target:** `0.2.0-beta.1` / `v0.2.0-beta.1`

## Decision

CAT5 uses closed-schema, owner-attested review and physical-device evidence in
place of separate reviewer/tester SSH keys and detached signatures. The
existing namespace-`git` release signer, signed annotated tag, human review,
physical-device matrix, exact-byte bindings, CI, deployment authorization, live
acceptance, and automatic V1 rollback remain mandatory.

The owner explicitly accepts one lost property: reviewer and tester identity is
asserted by the authenticated repository owner rather than independently
signature-authenticated. Owner attestation does not convert incomplete or
automated work into human-review or physical-device evidence.

## Trust and evidence contracts

- `.github/allowed_signers` contains exactly one namespace-`git` signer.
- Security review schema v3 binds reviewer identity, independence statement,
  exact candidate, completion time, outcome, zero open critical/high findings,
  report path/hash, and owner attestation.
- Review evidence is the candidate's immediate child and adds exactly
  `docs/security-review-attestation.json` and
  `docs/reviews/security-review.md`.
- Physical evidence schema v3 binds four real device profiles, all 15 checks,
  exact candidate/tag/version/dist/archive, operator name, completion time, and
  owner attestation.
- Owner actor equals the repository owner; attestation principal equals the
  sole Git release signer; timestamps are canonical, non-future, and no earlier
  than the completed work.

## Import and workflow

Physical evidence import accepts only `--input`, `--sha256`, and
`--owner-actor`. It opens regular non-executable input without following
symlinks, enforces size/digest/schema/build bindings, authenticates the owner
actor, writes atomically, revalidates stored bytes, and removes the exact legacy
generated `.sig` path. No SSH verification or physical trust-root file remains.

The release workflow requires `github.actor == github.repository_owner`,
downloads exactly the physical JSON, prepares exact bytes before import,
revalidates all gates before Pages mutation, and excludes `.sig` from
provenance and release uploads. Signed-tag, main-containment, authorization,
live-acceptance, and V1 rollback ordering is unchanged.

## Failure behavior

Missing genuine review or physical evidence remains `BLOCKED`/`NOT RUN`.
Unknown fields, mismatched identity/time/hash/bytes, non-owner dispatch,
non-physical hardware, incomplete checks, altered ancestry, or extra review
files fail closed. Implementation does not generate PASS evidence.
