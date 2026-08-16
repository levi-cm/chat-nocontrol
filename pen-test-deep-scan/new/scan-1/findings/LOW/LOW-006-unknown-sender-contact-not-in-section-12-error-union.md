# LOW-006: `unknown-sender-contact` error code emitted but absent from normative §12 PPXCryptoError union

- **Severity:** LOW
- **Category:** spec-drift
- **Subsystem:** docs/security-architecture.md §12 + src/protocol/types.ts + src/protocol/ppxq-inner.ts + src/crypto/qr-text.ts
- **Locations:** `docs/security-architecture.md:§12` (lines 361-390), `src/protocol/types.ts:12-21`, `src/protocol/ppxq-inner.ts:106`, `src/crypto/qr-text.ts:200-209`
- **Exploitability:** Theoretical — `unknown-sender-contact` only distinguishes "sender fingerprint not in recipient's contact list" from "wrong identity / AEAD / signature failure." The recipient already knows their own contact list, so no information is leaked to them; an external attacker observing the error channel would already need device-level access (at which point the contact list is directly readable). No runtime exploit path identified.
- **Impact:** The documented guarantee was: "Required error classes" with an exact `PPXCryptoError` union, plus "Parsing and cryptographic operations must distinguish structural failure from authentication failure without revealing extra detail to attackers." The code emits `unknown-sender-contact`, a `PPXCryptoError` code not present in the §12 union. Concrete effect: the normative error model is inaccurate; an error-handling conformance test built from §12 would reject a valid `unknown-sender-contact` from `parseSignedQrTextInner`, and the "exact union" claim is broken.

## Summary

`docs/security-architecture.md` §12 normatively defines `PPXCryptoError` as an exact 8-member union that does not include `unknown-sender-contact`. The shipped `src/protocol/types.ts` adds `"unknown-sender-contact"` to `PPXCryptoError`; `src/protocol/ppxq-inner.ts:106` throws it when a PPXQ sender fingerprint is not found in `knownSenders`, and `src/crypto/qr-text.ts:200-209` propagates it as a distinct error (mapped to the user-facing `qrUnknownSender` message in `src/flows/decrypt/index.tsx:330`). The PPXQ plan `docs/superpowers/plans/2026-07-14-encrypted-message-qr.md:186` explicitly decided to "Add a safe `unknown-sender-contact` crypto error" but §12 was never updated.

## Vulnerability detail

Doc claim — `docs/security-architecture.md:§12` (lines 361-388):

> Parsing and cryptographic operations must distinguish structural failure from authentication failure without revealing extra detail to attackers.
>
> Required error classes:
> ```ts
> export type PPXCryptoError =
>   | 'wrong-identity-or-corruption'
>   | 'wrong-passphrase-or-corruption'
>   | 'invalid-aead'
>   | 'invalid-signature'
>   | 'invalid-hybrid-encapsulation'
>   | 'unsupported-compression'
>   | 'invalid-passphrase'
>   | 'corrupted-vault';
> ```

Code reality — `src/protocol/types.ts:12-21`:

```ts
export type PPXCryptoError =
  | "wrong-identity-or-corruption"
  | "wrong-passphrase-or-corruption"
  | "invalid-aead"
  | "invalid-signature"
  | "invalid-hybrid-encapsulation"
  | "unsupported-compression"
  | "unknown-sender-contact"
  | "invalid-passphrase"
  | "corrupted-vault";
```

The extra `"unknown-sender-contact"` is thrown at `src/protocol/ppxq-inner.ts:106` (`if (!senderContact) throw new PPXError("unknown-sender-contact");`) and re-thrown by `src/crypto/qr-text.ts:200-209` as a distinct code rather than being collapsed into `wrong-identity-or-corruption`. The doc §12 union has no such member. `docs/superpowers/plans/2026-07-14-encrypted-message-qr.md:186` records the deliberate decision to add it, confirming §12 is stale rather than the code being wrong.

## Exploit scenario

1. A reviewer or test harness constructs the set of valid worker error codes directly from the §12 union (the doc is normative: "Required error classes").
2. `decryptQrText` emits `unknown-sender-contact` for a PPXQ whose sender fingerprint is not in `knownSenders` (`src/protocol/ppxq-inner.ts:106`).
3. The §12-grounded harness rejects `unknown-sender-contact` as an invalid `PPXCryptoError`, masking the real "unknown sender" failure mode during release testing, or a generic error-handler that switches over the §12 union falls through to a default branch and surfaces a misleading message.
4. Separately, an attacker who can submit PPXQ objects and observe which of `unknown-sender-contact` vs `wrong-identity-or-corruption` is returned could in principle learn whether a given fingerprint is in the recipient's contact list — but only if they can observe the user-facing error channel, which requires device access that already exposes the contact list directly.

Assumptions: the attacker already has device-level visibility to read distinct error codes; at that point the contact list is directly readable, so the oracle adds no real capability. No remote exploit path identified.

## Proof of concept

See `pen-test-deep-scan/new/scan-1/pocs/LOW-006.md` — a non-harmful diff between the §12 `PPXCryptoError` union and `src/protocol/types.ts:12-21`, plus the throw site at `src/protocol/ppxq-inner.ts:106`.

## Remediation

Fix the doc to match the code: add `| 'unknown-sender-contact'` to the `PPXCryptoError` union in `docs/security-architecture.md` §12, with a one-line note that it is emitted only by PPXQ known-sender lookup before signature verification (cross-reference `docs/protocol-qr-message-v1.md`). The code is the intended behavior (PPXQ is designed to fail closed for unknown senders per `docs/protocol-qr-message-v1.md`); the §12 union simply was not updated.

## Verification of fix

`npm run format:check` on `docs/security-architecture.md` and a manual diff confirming the §12 `PPXCryptoError` union equals `src/protocol/types.ts:12-21`. Optionally assert in `test:provider-contract` that the documented union and the code union are equal.

## References

`docs/security-architecture.md:§12` (lines 361-390), `docs/superpowers/plans/2026-07-14-encrypted-message-qr.md:186`, `src/protocol/types.ts:12-21`, `src/protocol/ppxq-inner.ts:106`, `src/crypto/qr-text.ts:200-209`, `src/flows/decrypt/index.tsx:330`. CWE-1078 / CWE-1164 (documentation-accuracy / contract-drift).
