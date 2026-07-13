# Reviewed implementation-path substitutions

> **Authority:** Non-normative path-conformance record for the complete Tasks 0-17 execution; the implementation plan and normative protocol, security, product, UX, and release documents remain authoritative.
> **Version:** 1.0
> **Status:** Reviewed implementation map
> **Checked:** 2026-07-13 Europe/Berlin
> **Depends on:** [implementation-plan.md](implementation-plan.md), [implementation-status.md](implementation-status.md), [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [testing-and-release.md](testing-and-release.md)

The requirements and gates in Tasks 0-17 are normative. A planned path is not
itself a security or release gate. The implementation consolidated some closely
coupled modules and tests so the same contract has one owner. This record makes
every intentional path difference explicit; it does not waive tests, fixtures,
or acceptance criteria.

| Planned path | Implemented path or evidence | Preserved contract |
| --- | --- | --- |
| `src/components/navigation/*` | `src/app/App.tsx`, `src/styles.css`, `src/tests/unit/app-shell.test.tsx`, `src/tests/accessibility/shell.spec.ts`, `src/tests/accessibility/interaction-matrix.spec.ts` | One semantic route model renders the desktop rail and mobile bottom navigation; route, keyboard, reflow, and touch-target behavior are tested. |
| `src/tests/accessibility/navigation.test.ts` | `src/tests/accessibility/shell.spec.ts`, `src/tests/accessibility/interaction-matrix.spec.ts` | EN/DE axe, keyboard, reduced-motion, reflow, and target-size checks cover navigation. |
| `src/tests/e2e/bootstrap.spec.ts` | `src/tests/e2e/shell.spec.ts`, `src/tests/e2e/session-only.spec.ts`, `src/tests/release/offline.spec.ts` | Initial shell, identity gate, route bootstrap, storage bootstrap, and offline startup are exercised separately. |
| `src/tests/unit/bytes.test.ts` | `src/tests/unit/protocol-foundation.test.ts` | Strict reader/writer bounds and canonical encodings share one foundation suite. |
| `src/tests/property/base45.property.test.ts`, `base64url.property.test.ts`, `text-normalization.property.test.ts` | `src/tests/unit/protocol-foundation.test.ts`, `src/tests/property/parser-roundtrip.property.test.ts`, `boundary.property.test.ts`, `mutation.property.test.ts`, `fuzz-100k.property.test.ts` | Canonical round trips, normalization, malformed inputs, limits, mutations, and fuzz cases are covered without three duplicate harnesses. |
| `fixtures/import/` | Fixed-entropy recovery and vault vectors constructed in `src/tests/unit/recovery-words.test.ts`, `src/tests/property/recovery-roundtrip.property.test.ts`, `src/tests/property/vault-roundtrip.property.test.ts`, and identity E2E suites | Import fixtures stay deterministic while private recovery material is not stored as a loose repository artifact. |
| `fixtures/protocol/ppxc/`, `ppxt/`, `ppxf/` | `fixtures/protocol/golden-v1.json`, `fixtures/protocol/ppxf-v1.json`, `scripts/generate-protocol-goldens.ts`, `src/tests/unit/protocol-goldens.test.ts` | Versioned canonical bytes, decoded shapes, regeneration, and drift detection remain one cross-family golden contract. |
| `src/flows/identity/import-vault.ts` | `src/flows/identity/import.tsx` | Recovery-word, recovery-file, and encrypted-vault import share one ownership and cleanup state machine. |
| `src/tests/accessibility/identity-flow.test.ts` | `src/tests/accessibility/flows.spec.ts`, `src/tests/accessibility/interaction-matrix.spec.ts`, `src/tests/e2e/identity-create.spec.ts`, `identity-import.spec.ts` | Identity creation/import semantics, keyboard completion, focus, reflow, and localized flows remain covered. |
| `src/tests/accessibility/qr-card.test.ts` | `src/tests/accessibility/qr-card.test.tsx` | JSX rendering requires the `.tsx` extension; the QR accessibility contract is unchanged. |
| `src/flows/encrypt/file.ts`, `src/flows/decrypt/file.ts` | `src/flows/encrypt/file.tsx`, `src/flows/decrypt/file.tsx` | UI flows use JSX and retain the planned file protocol/worker boundaries. |
| `src/components/media/*` | `src/components/media/blob-url.ts`, `src/flows/decrypt/file.tsx`, `src/tests/unit/file-preview.test.ts`, `blob-url-cleanup.test.ts` | Authenticated preview allowlisting and idempotent preview/download URL revocation have explicit owners and tests. |
| `src/workers/shared.ts` | `src/protocol/types.ts`, `src/workers/file-client.ts`, `file-runner.ts`, `crypto-client.ts`, `crypto-runner.ts`, `src/tests/unit/worker-contracts.test.ts` | Shared message/result types remain authoritative while each worker family keeps its own exhaustive dispatcher. |
| `src/tests/unit/file-worker.test.ts` | `src/tests/unit/file-client.test.ts`, `file-runner.test.ts`, `worker-contracts.test.ts`, `src/tests/e2e/file-cancel.spec.ts` | Worker progress, cancellation acknowledgement, protocol dispatch, failure, and completion behavior are tested at their owning layers. |
| `fixtures/files/` | Deterministic in-memory `File`/`Blob` inputs in PPXF, boundary, chunk, memory, cancellation, encrypt, and decrypt suites | No remote or opaque binary dependency is needed; byte-exact file inputs are generated by the test that asserts them. |
| `src/tests/unit/migration.test.ts` | `src/tests/unit/storage.test.ts`, `src/tests/e2e/session-only.spec.ts` | Schema startup, settings migration, degradation, partial failures, session-only behavior, and truthful erase are covered together. |
| `src/tests/e2e/erase-all.spec.ts` | `src/tests/e2e/session-only.spec.ts` | Successful, denied, partial-read, runtime, and locale-deletion erase paths are one storage-mode matrix. |
| `src/tests/e2e/locale-switch.spec.ts` | `src/tests/e2e/en-de.spec.ts`, `src/tests/accessibility/shell.spec.ts` | EN/DE switching, persistence rules, localized safety text, and axe checks remain covered. |
| `src/tests/unit/contact-collision.test.ts` | `src/tests/unit/unknown-sender.test.ts`, `src/tests/e2e/contacts.spec.ts`, `decrypt-collision.spec.ts` | Full short IDs, fingerprint identity, same-pseudonym collisions, unknown senders, save, and delete flows are covered at unit and browser levels. |
| `src/tests/unit/ppx-golden.test.ts` | `src/tests/unit/protocol-goldens.test.ts` plus the family codec suites | The plural name reflects the PPXC/PPXV/PPXR/PPXT/PPXF fixture set; canonical-byte enforcement is unchanged. |

Any future consolidation must be added here with its direct implementation and
test evidence. Missing behavior cannot be justified by adding a path mapping.
