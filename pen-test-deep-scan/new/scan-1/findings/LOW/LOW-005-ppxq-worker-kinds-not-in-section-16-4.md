# LOW-005: PPXQ worker message kinds added without updating normative §16.4 worker contract

- **Severity:** LOW
- **Category:** spec-drift
- **Subsystem:** docs/security-architecture.md §16.4 + src/crypto/contracts.ts + src/workers/crypto-runner.ts + src/workers/crypto-client.ts
- **Locations:** `docs/security-architecture.md:§16.4` (lines 675-748), `src/crypto/contracts.ts:23-32`, `src/workers/crypto-runner.ts:73-94`, `src/workers/crypto-client.ts:120-137`
- **Exploitability:** Theoretical — the added kinds are not directly exploitable (they route to the same reviewed crypto primitives), but they violate the normative "only sanctioned message shapes" claim and create a review-coverage gap: an auditor relying on §16.4 would not know `encrypt-qr-text` / `decrypt-qr-text` worker paths exist and handle the request-owned Ed25519 seed and decrypted plaintext.
- **Impact:** The documented guarantee was: "The worker contracts are the only sanctioned message shapes between the main thread and crypto workers. The implementation must not add ad hoc message kinds without updating this section and protocol-v1.md." The code adds two request kinds (`encrypt-qr-text`, `decrypt-qr-text`) and two completed-event result types (`EncryptedQrTextObject`, `DecryptedQrTextOutput`) that §16.4 does not list. Concrete effect: the normative contract is inaccurate; a conformance test generated from §16.4 would reject the actual worker traffic, and secret-handling code paths (zeroization of `senderSigningCapability.signingSecretKey` in `startEncryptQrTextJob`, plaintext retention in `decryptQrText`) are outside the documented contract surface.

## Summary

`docs/security-architecture.md` §16.4 normatively lists exactly seven `PPXWorkerRequest` kinds (`encrypt-text`, `decrypt-text`, `encrypt-file`, `decrypt-file`, `unlock-vault`, `lock-vault`, `cancel`) and two `completed` result unions (`EncryptedTextObject | EncryptedFileObject | EncryptedFileBlobOutput | LockedVaultObject | DerivedIdentity` and `DecryptedTextOutput | DecryptedFileOutput`). The shipped `src/crypto/contracts.ts` adds `encrypt-qr-text` and `decrypt-qr-text` request kinds and inserts `EncryptedQrTextObject` / `DecryptedQrTextOutput` into the `completed` result unions; `src/workers/crypto-runner.ts:73-94` and `src/workers/crypto-client.ts:120-137` actively dispatch and create those jobs. The `docs/superpowers/plans/2026-07-14-encrypted-message-qr.md:513` plan explicitly intended to "Modify: docs/security-architecture.md", but §16.4 was never updated for the new PPXQ worker kinds.

## Vulnerability detail

Doc claim — `docs/security-architecture.md:§16.4` (lines 674-748):

> The worker contracts are the only sanctioned message shapes between the main thread and crypto workers. The implementation must not add ad hoc message kinds without updating this section and [protocol-v1.md](protocol-v1.md).

The normative `PPXWorkerRequest` union in §16.4 (lines 675-709) lists only:
```
'encrypt-text' | 'decrypt-text' | 'encrypt-file' | 'decrypt-file' | 'unlock-vault' | 'lock-vault' | 'cancel'
```
and the `PPXWorkerEvent` `completed` result unions (lines 723-734) list only:
```
EncryptedTextObject | EncryptedFileObject | EncryptedFileBlobOutput | LockedVaultObject | DerivedIdentity
DecryptedTextOutput | DecryptedFileOutput
```

Code reality — `src/crypto/contracts.ts:23-32`:

```ts
export type PPXWorkerRequest =
  | { kind: "encrypt-text"; requestId: string; input: EncryptTextInput }
  | { kind: "decrypt-text"; requestId: string; input: DecryptTextInput }
  | { kind: "encrypt-qr-text"; requestId: string; input: EncryptQrTextInput }
  | { kind: "decrypt-qr-text"; requestId: string; input: DecryptQrTextInput }
  | { kind: "encrypt-file"; requestId: string; input: EncryptFileInput }
  | { kind: "decrypt-file"; requestId: string; input: DecryptFileInput }
  | { kind: "unlock-vault"; requestId: string; input: UnlockVaultInput }
  | { kind: "lock-vault"; requestId: string; input: LockVaultInput }
  | { kind: "cancel"; requestId: string };
```

and `src/crypto/contracts.ts:44-58` adds `EncryptedQrTextObject` / `DecryptedQrTextOutput` to the `completed` result unions. `src/workers/crypto-runner.ts:73-94` actively handles `encrypt-qr-text` / `decrypt-qr-text`, and `src/workers/crypto-client.ts:120-137` posts them. These are exactly the "ad hoc message kinds" §16.4 forbids without a doc update.

The plan `docs/superpowers/plans/2026-07-14-encrypted-message-qr.md:513` lists `Modify: docs/security-architecture.md` as a required task, and `docs/superpowers/plans/2026-07-14-encrypted-message-qr.md:186` records the decision to "Add ... a safe `unknown-sender-contact` crypto error" — confirming the omission is an incomplete doc update, not an intentional divergence.

## Exploit scenario

1. An auditor or release-gate script builds a conformance check directly from the §16.4 contract (the doc is labeled "Normative contracts").
2. The check enumerates sanctioned `PPXWorkerRequest` kinds and rejects any other `kind` value as a contract violation.
3. Real application traffic for PPXQ encrypt/decrypt (e.g. `startEncryptQrTextJob` in `src/flows/encrypt/text.tsx` via `src/workers/crypto-client.ts:120`) emits `encrypt-qr-text` / `decrypt-qr-text` messages, which the §16.4-derived check flags as unsanctioned — or, conversely, an auditor reviewing only §16.4-listed kinds never reviews the `crypto-runner.ts:73-94` QR-text handlers that copy and zeroize the request-owned Ed25519 seed.
4. A future regression in the unreviewed QR-text worker path (e.g. failing to zeroize `signingSecretKey` on a new error branch) would escape §16.4-grounded review.

Assumptions: the attacker does not need to compromise anything; this is a review-evasion / contract-accuracy gap, not a runtime exploit. The actual current QR-text code is otherwise correct (it zeroizes the seed in `finally`).

## Proof of concept

See `pen-test-deep-scan/new/scan-1/pocs/LOW-005.md` — a non-harmful diff between the §16.4 normative union and the shipped `src/crypto/contracts.ts` union showing the two extra request kinds and two extra result types.

## Remediation

Fix the doc to match the code: update `docs/security-architecture.md` §16.4 `PPXWorkerRequest` to include `{ kind: 'encrypt-qr-text'; requestId: string; input: EncryptQrTextInput }` and `{ kind: 'decrypt-qr-text'; requestId: string; input: DecryptQrTextInput }`, and update the `PPXWorkerEvent` `completed` result unions to include `EncryptedQrTextObject` and `DecryptedQrTextOutput`. Add cross-references to `docs/protocol-qr-message-v1.md` as the §16.4 prose requires. (The code is the intended behavior; the doc simply was not updated when PPXQ shipped.)

## Verification of fix

`npm run format:check` (markdownlint / prettier on `docs/security-architecture.md`) and a manual diff confirming the §16.4 union matches `src/crypto/contracts.ts:23-60` exactly. Optionally add a `test:provider-contract`-style assertion that the §16.4-listed kinds equal the `PPXWorkerRequest` member list.

## References

`docs/security-architecture.md:§16.4` (lines 674-748), `docs/superpowers/plans/2026-07-14-encrypted-message-qr.md:186,513`, `src/crypto/contracts.ts:23-60`, `src/workers/crypto-runner.ts:73-94`, `src/workers/crypto-client.ts:120-137`. CWE-1078 (inappropriate source code style or formatting) / CWE-1164 (irrelevant code) — primarily a documentation-accuracy / contract-drift issue.
