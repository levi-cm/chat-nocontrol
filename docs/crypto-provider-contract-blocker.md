# Resolved CryptoProvider contract correction

> **Authority:** Archived implementation-decision record subordinate to the normative protocol and security documents.

Status: **resolved 2026-07-13**. This file preserves the former blocker record;
it is not a current release blocker.

The approved correction is normative in
[`security-architecture.md`](security-architecture.md) and designed in
[`superpowers/specs/2026-07-13-crypto-ppxf-contract-correction-design.md`](superpowers/specs/2026-07-13-crypto-ppxf-contract-correction-design.md).

- `EncryptTextInput` and `EncryptFileInput` carry a request-owned
  `SenderSigningCapability`.
- The capability fingerprint and signing public key must match the public
  sender contact.
- `createHybridEncapsulation` accepts only recipient public material and owns
  ephemeral X25519 generation, ML-KEM encapsulation, salt, shared secrets, and
  key derivation.
- Existing `encrypt-text` and `encrypt-file` worker requests carry the corrected
  inputs; no hidden identity state or identity-initialization message exists.
- Request-owned secrets and derived hybrid secrets are wiped best effort.

Run `npm run test:provider-contract`. Success prints exactly
`CryptoProvider contract OK`.
