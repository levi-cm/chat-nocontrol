# Resolved PPXF contract correction

> **Authority:** Archived implementation-decision record subordinate to the normative protocol and security documents.

Status: **resolved 2026-07-13**. This file preserves the former blocker record;
it is not a current release blocker.

The approved correction is normative in
[`protocol-v1.md`](protocol-v1.md),
[`security-architecture.md`](security-architecture.md), and the approved
[`contract-correction design`](superpowers/specs/2026-07-13-crypto-ppxf-contract-correction-design.md).

- The fixed 884-byte header carries the recipient ID, ML-KEM ciphertext,
  ephemeral X25519 public key, nonce prefix, salt, counts, and lengths.
- Filename, MIME hint, caption, sender contact, digest, and signature exist only
  inside the encrypted terminal manifest.
- Ordered records include index, plaintext length, ciphertext length, and
  ciphertext plus tag. The terminal index is `0xffffffff`.
- The final 16 bytes are a SHA-512-truncated checksum over all preceding
  canonical PPXF bytes.
- Decryption verifies structure and checksum before decapsulation and releases
  no metadata, preview, Blob, or download before all cryptographic checks pass.

Run `npm run test:ppx-golden`. Success includes exactly `PPXF contract OK`.
