# LOW-002: No storage-layer test that vault write is withheld until final confirmation or that session-only completion discards the prepared vault (create flow)

- **Severity:** LOW
- **Category:** test-gap
- **Subsystem:** src/tests/e2e/identity-create.spec.ts, src/tests/unit/identity-create-wizard.test.tsx, src/tests/unit/storage.test.ts
- **Locations:** `src/flows/identity/create.tsx:785`, `src/flows/identity/create.tsx:793`, `src/tests/e2e/identity-create.spec.ts:176`, `src/tests/unit/identity-create-wizard.test.tsx:209`
- **Exploitability:** Likely (not confirmed) — the implementation appears correct, but no regression test guards the invariant; a future change that persisted the vault before the final confirmation step would pass the entire suite.
- **Impact:** Persistence of a prepared vault before the user's explicit storage choice. An attacker who controls or seizes the device mid-onboarding (steps 2–6, before step 7 confirmation) could recover the locked vault from IndexedDB even if the user later selects "No, use session only", defeating the session-only discard contract.

## Summary

`docs/security-architecture.md` §14 mandates "Storage checks proving no vault write occurs before the final explicit confirmation and session-only completion discards the prepared vault." The implementation holds the prepared vault in component state (`pendingVault`) and only passes it to the `onReady` callback (which drives `putVault`) at the finish step, gated on `rememberLocally`. No test, however, asserts that `putVault`/`onReady` is NOT invoked before the final confirmation, nor that choosing session-only at step 7 leaves IndexedDB empty after a reload. The existing session-only coverage exercises imported identities and contacts, never the create-flow prepared vault.

## Vulnerability detail

The create flow defers persistence by design:

`src/flows/identity/create.tsx:785` `finishNewIdentity`:
```ts
const finishNewIdentity = async () => {
  if (!pendingIdentity || !pendingContact) return;
  ...
  await transferReady(
    pendingIdentity,
    pendingContact,
    rememberLocally ? (pendingVault ?? undefined) : undefined,  // line 793
  );
```

When `rememberLocally` is false (session-only), `undefined` is passed to `transferReady` → `onReady`, so the vault is never handed to the storage layer. The vault is built in memory at step 2 (`lockVaultJobFactory`, `src/flows/identity/create.tsx:820`) and held until step 7.

Test coverage that exists:
- `src/tests/unit/identity-create-wizard.test.tsx:167` ("creates the encrypted vault before enabling required digital backups") asserts `lockVaultJobFactory` was called once (line 209) — this verifies the in-memory vault is *built*, not that it is *withheld from storage*. `onReady` (the storage trigger) is passed as `vi.fn()` and is never asserted to be uncalled through steps 2–6.
- `src/tests/e2e/identity-create.spec.ts:22` ("creates, exports, verifies, and stores recovery material through seven screens") selects session-only at step 7 (line 176) and finishes, then navigates to Identity and sees "Alice" (lines 180–181). It never reloads the page to confirm the vault was discarded from IndexedDB. The test asserts the in-memory session works, not that the prepared vault was withheld/discard.
- `src/tests/e2e/identity-create.spec.ts:187` ("unavailable IndexedDB visibly forces session-only completion") verifies the UI *forces* session-only when IndexedDB is denied; it does not test the discard path when IndexedDB is available but the user chooses session-only.
- `src/tests/e2e/session-only.spec.ts` exhaustively covers session-only discard for *imported* identities and *contacts* (e.g. lines 38–65 reload and assert contacts are gone), but the prepared-vault discard during identity *creation* is not exercised.

What is NOT asserted:
1. `putVault` (or `onReady` with a non-undefined vault) is never called during steps 2–6.
2. After finishing the create flow with session-only selected, a reload leaves IndexedDB without the vault (the prepared vault was discarded, not persisted).

## Exploit scenario

Assumptions: an implementation-team insider or a future refactor moves the `putVault` call (or an equivalent eager persist) into step 2 alongside `lockVaultJobFactory`, "to avoid losing the vault on accidental reload." The current suite has no assertion that would fail.

1. User starts creating an identity on a shared/seized device, enters a password, and reaches step 2; the vault is now persisted to IndexedDB.
2. Before the user reaches step 7, an attacker with disk access reads the locked vault from IndexedDB.
3. The user selects "No, use session only" at step 7 and finishes, believing nothing was stored.
4. The attacker now has the locked vault and can mount an offline scrypt brute-force of the user's vault password. The session-only contract — the user's explicit choice not to remember — is violated.

No test in the suite distinguishes "vault persisted at step 2" from "vault persisted only at step 7," so the regression ships.

## Proof of concept

The missing assertions (non-harmful, test-only):

```ts
// In identity-create-wizard.test.tsx — assert onReady is NOT called with a vault before the finish step.
const onReady = vi.fn();
render(<IdentityCreate /* ... */ onReady={onReady} lockVaultJobFactory={lockVaultJobFactory} ... />);
await user.click(screen.getByRole("button", { name: "Create new identity" }));
await user.type(screen.getByLabelText("Username"), "Alice");
await user.click(screen.getByRole("button", { name: "Generate identity" }));
await user.type(screen.getByLabelText("Browser-vault password"), "Vault pass 123!");
await user.type(screen.getByLabelText("Confirm browser-vault password"), "Vault pass 123!");
await user.click(screen.getByRole("button", { name: "Create encrypted vault" }));
await screen.findByText("Step 3 of 7");
// Vault is built in memory, but storage must NOT be triggered yet.
expect(onReady).not.toHaveBeenCalled();
// ... advance through steps 3–6, still no onReady call ...
expect(onReady).not.toHaveBeenCalled();

// In identity-create.spec.ts (e2e) — after session-only finish, reload and assert the vault is gone.
await page.getByRole("radio", { name: /No, use session only/u }).check();
await page.getByRole("button", { name: "Finish identity setup" }).click();
await expect(page).toHaveURL(/#\/encrypt$/u);
await page.reload();
await expect(page.getByRole("heading", { name: "Create identity or import identity" })).toBeVisible();
// The prepared vault must NOT have survived the session-only choice.
```

## Remediation

Add two regression tests:

1. Unit: in `identity-create-wizard.test.tsx`, assert `onReady` is not invoked at any point before the step-7 finish action (and that it IS invoked with `undefined` vault when session-only is chosen, or with the vault when "Remember on this device" is chosen).
2. E2E: in `identity-create.spec.ts`, after finishing the create flow with "No, use session only", reload the page and assert the onboarding screen reappears (the prepared vault was discarded). Mirror the reload assertion already used in `session-only.spec.ts:62–64` for contacts.

## Verification of fix

```sh
npx vitest run src/tests/unit/identity-create-wizard.test.tsx
npx playwright test src/tests/e2e/identity-create.spec.ts
```

## References

- `docs/security-architecture.md` §14 ("Storage checks proving no vault write occurs before the final explicit confirmation and session-only completion discards the prepared vault.")
- `src/flows/identity/create.tsx:785`, `:793` (vault only passed to `onReady` at finish, gated on `rememberLocally`)
- CWE-732: Incorrect Permission Assignment for Critical Resource (vault persisted before authorization decision)
