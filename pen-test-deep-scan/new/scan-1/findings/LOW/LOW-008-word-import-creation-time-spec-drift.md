# LOW-008: Word-import writes import time into signed PPXC.creationTime (spec §12 `importedAt` contract unimplemented)

- **Severity:** LOW
- **Category:** spec-drift
- **Subsystem:** src/flows/identity/import.tsx + src/protocol/types.ts (cross-cutting identity↔recovery seam)
- **Locations:** `src/flows/identity/import.tsx:83`, `src/flows/identity/import.tsx:90-99`, `src/flows/identity/import.tsx:107-127`, `src/protocol/types.ts:281-291`, `docs/security-architecture.md:393-413`, `docs/protocol-v1.md:123-129`
- **Exploitability:** Confirmed (code path is reachable on every 24-word import) — non-key-recovery; signed-metadata authenticity drift.
- **Impact:** integrity (signed-metadata misrepresentation). A 24-word-imported identity mints a self-signed `PPXC` whose signed `creationTime` equals the local import time, while the spec forbids ever presenting the import time as the original creation time. The normative `RecoveryWordsImportInput/Output` contract (with a distinct `importedAt` local-metadata field) is declared in `types.ts` but is dead code — no path wires it up.

## Summary

The recovery-word import path (`importWords` → `complete`) does not implement the §12 `importedAt` contract. Instead it stamps `BigInt(Math.floor(Date.now()/1000))` into both `DerivedIdentity.creationTime` and the freshly signed `PPXC.creationTime`. The spec requires the import timestamp to be kept as **local metadata only** and explicitly states "Never claim the import time is the original creation time." The `PPXC.creationTime` field is the signed original-creation-time field, so the current code signs the import time as the original creation time. The `RecoveryWordsImportInput/Output` types that carry a separate `importedAt` exist only as unused declarations.

## Vulnerability detail

`src/flows/identity/import.tsx:80-105` — `complete` defaults `creationTime` to now and pushes it into both the relabeled identity and the new PPXC:

```ts
const complete = (
  identity: DerivedIdentity,
  publicPseudonym: string,
  creationTime = BigInt(Math.floor(Date.now() / 1000)),   // line 83
) => {
  ...
  const relabeledIdentity = {
    ...identity,
    pseudonym: normalizePseudonym(publicPseudonym),
    creationTime,                                          // line 93
  };
  const contact = defaultCryptoProvider.createPublicContact(
    relabeledIdentity,
    publicPseudonym,
    creationTime,                                          // line 98 -> signed PPXC.creationTime
  );
  onReady(relabeledIdentity, contact);
};
```

`src/flows/identity/import.tsx:107-127` — `importWords` calls `complete(identity, pseudonym)`, relying on the now-default, placing the import time into the signed `PPXC.creationTime`:

```ts
const identity = await defaultCryptoProvider.deriveIdentity(entropy);
complete(identity, pseudonym);   // creationTime = now
```

Contrast with the PPXR/PPXV paths (`import.tsx:147`, `:159`, `:244`, `:256`) which correctly pass `recovery.creationTime` / `identity.creationTime` — those preserve the embedded original creation time per `docs/implementation-plan.md:748` and are not in scope of this finding.

`src/protocol/types.ts:281-291` declares the spec-contract types with a distinct `importedAt`:

```ts
export interface RecoveryWordsImportInput {
  words: string[];
  pseudonym: string;
  importedAt: bigint;          // local metadata only
}
export interface RecoveryWordsImportOutput {
  identity: DerivedIdentity;
  publicContact: PublicContact;
  importedAt: bigint;          // local metadata only
}
```

A repo-wide search shows these two types are referenced **only** at their declaration site — no `CryptoProvider` method, no worker, and no flow consumes or produces them. The `importedAt` local-metadata channel the spec mandates is therefore absent.

Normative spec (`docs/security-architecture.md:406-413`):

> Recovery-word import flow requirements:
> - Require the user to choose or re-enter a valid pseudonym after word import.
> - Create a new signed `PPXC` for the same fingerprint.
> - Preserve the import timestamp only as local metadata.
> - Never claim the import time is the original creation time.

And `docs/protocol-v1.md:129`: "The import time is local metadata only and must not be presented as the original creation time." The `DerivedIdentity.creationTime` comment at `docs/security-architecture.md:107` ("preserved by PPXV and PPXR; new local time only for word imports") contemplates a *local* time, not a signed-original time.

Because `PPXC.creationTime` is part of the self-signed contact body (`src/protocol/ppxc.ts:51` `writer.writeUint64BE(input.creationTime)` inside `unsignedContactBytes`, then signed at `ppxc.ts:72-75`), the import time becomes a signed attestation of provenance — exactly what §12 prohibits.

## Exploit scenario

1. Alice originally created her identity at `T0` on a now-lost device, retained only the 24 words.
2. Alice imports via words on a new device at `T1`. `complete(identity, pseudonym)` signs and emits a `PPXC` with `creationTime = T1`.
3. Bob receives Alice's PPXC and stores it. Bob's UI (and any downstream provenance display of `creationTime`) now attests Alice's identity was created at `T1`, not `T0`. Re-importing the same words at a later `T2` on another device yields a second valid PPXC, same fingerprint, signed `creationTime = T2` — a contact refresh silently overwrites the stored `creationTime` via the merge branch in `src/flows/contacts/manage.tsx:117-129` (same-fingerprint update, patch `{ contact }`).

Assumptions: adversary does not need any key material; the drift is intrinsic to the word-import code path. No confidentiality or key-recovery impact — the fingerprint (which excludes `creationTime` per `docs/security-architecture.md:173`) is unchanged, so E2EE binding is preserved. Impact is limited to signed-metadata authenticity / spec-contract conformance.

## Proof of concept

Local-only reasoning PoC (no network, no infra). See `pen-test-deep-scan/new/scan-1/pocs/LOW-008.md` for the trace that derives the signed `creationTime` for a word import and contrasts it with the unused `importedAt` contract.

## Remediation

Wire the §12 contract through the word-import seam, following the existing PPXR/PPXV pattern of passing explicit time:

1. In `src/flows/identity/import.tsx:importWords`, distinguish `importedAt` from the PPXC's `creationTime`. Because the original creation time is unrecoverable from words alone (`docs/protocol-v1.md:123`), the new PPXC must not sign an import time as `creationTime`. Options consistent with the spec:
   - Introduce the unused `RecoveryWordsImportInput/Output` path (e.g. a `CryptoProvider.importRecoveryWords` method) that returns `publicContact` with a `creationTime` that is NOT the import time (e.g. `0n` or a path-specific sentinel), plus a separate `importedAt` carried as local metadata only; or
   - At minimum, stop passing `Date.now()` into `createPublicContact` for word imports and record `importedAt` as local-only state (never into `PPXC.creationTime`).
2. Ensure the merge branch in `src/flows/contacts/manage.tsx:117-129` does not silently refresh a stored contact's signed `creationTime` on a same-fingerprint re-import unless the new PPXC is genuinely newer AND the user is informed (defense-in-depth; pairs with the existing same-pseudonym collision warning).
3. Remove the dead `RecoveryWordsImportInput/Output` declarations or actually consume them, so the normative contract is not misleading.

Prefer the existing repo pattern: PPXR/PPXV already pass an explicit `creationTime` to `complete(identity, pseudonym, creationTime)`; mirror that explicitness for the word path with a value that is not `Date.now()`.

## Verification of fix

- `npm run typecheck` (confirm any new `importRecoveryWords` wiring type-checks).
- Add/extend a unit test asserting: after a 24-word import, the resulting `PublicContact.creationTime` is not equal to the import wall-clock time and `importedAt` is tracked separately (golden vector alongside the existing recovery round-trip tests referenced in `docs/security-architecture.md:434-438`).
- `npm test -- --grep "recovery"` or the repo's recovery-word test suite to confirm the round-trip and import-time behavior.

## References

- `docs/security-architecture.md` §12 (lines 393-413): `RecoveryWordsImportInput/Output` + "Never claim the import time is the original creation time."
- `docs/protocol-v1.md` §3 (lines 123-129): word import does not restore original creation time; import time is local metadata only.
- `docs/security-architecture.md:107` and `:173`: `creationTime` is excluded from the fingerprint; preserved by PPXV/PPXR only.
- `docs/implementation-plan.md:748`: PPXV/PPXR preserve embedded pseudonym and creation time; word import does not.
- CWE-347: Improper Verification of Cryptographic Signature (signed-metadata provenance) — closest fit; primarily a spec-contract/spec-drift issue.
