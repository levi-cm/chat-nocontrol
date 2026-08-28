> **Authority:** Normative CAT-5/V2 threat model.
> **Target release:** `0.2.0-beta.1`
> **Depends on:** [security-architecture.md](security-architecture.md), [protocol-cat5-v2.md](protocol-cat5-v2.md), [legacy-v1-compatibility.md](legacy-v1-compatibility.md)

# Threat model

## Protected assets

Master entropy, ML-KEM/ML-DSA secret keys, vault password, recovery artifacts,
plaintext text/files, contact authenticity, message/file integrity, and release
provenance.

## In scope

| Threat | Required control |
| --- | --- |
| Malformed/oversized input | Bound before allocation; exact canonical parse |
| Version/suite downgrade | Accept exact supported pair only; no negotiation |
| Mixed V1/V2 object | Reject before crypto routing |
| Cross-family replay | HKDF object-family binding; magic-specific parser |
| Ciphertext tampering | AES-GCM before plaintext release |
| Sender substitution | ML-DSA context/signature plus contact/fingerprint binding |
| Gzip bomb/trailing member | Authenticate first; bounded exact-length decode |
| Chunk reorder/truncation | Ordered records and signed terminal PPXF manifest |
| V1 contact persistence | Decrypt-only unlocked-session copy; never persist; clear on lock/session end |
| Link persistence/leak | Canonical HTTPS only; no encoded-host navigation; scrub before parse; no request/storage/cache/log copy |
| Worker cancel/race | One terminal result; zeroize abandoned request state |
| Vault theft | scrypt + AES-GCM; password strength/user storage still matter |
| Recovery theft | Strong danger copy; recovery artifacts treated as private keys |
| Supply-chain/release swap | pins, SBOM, exact provenance, review evidence, rollback |

## Out of scope / not solved

- Compromised device, browser, extension, OS, clipboard, screen, or input method.
- Malicious recipient or sender endpoint after plaintext is visible.
- Transport metadata, link previews, screenshots, backups, or recipient sharing.
- Forward secrecy, post-compromise security, ratchet, groups, traffic analysis.
- Guaranteed browser-memory erasure or filesystem secure deletion.
- Authentic contact exchange without user/out-of-band verification.
- Future cryptanalysis, implementation flaws, or standards failure.
- Denial of service inside documented finite bounds.

## Quantum statement

ML-KEM-1024 and ML-DSA-87 are standardized post-quantum primitives. This reduces
specific cryptanalytic risks; it does not make endpoints, symmetric primitives,
dependencies, implementation, or future security “quantum-proof.” No 100-year
guarantee is made.

## Legacy boundary

V1 support expands attack surface only for explicit decode/migration inputs.
It must remain in isolated worker/read paths, preserve all V1 bounds, emit no V1
artifact, store no V1 contact, preview no legacy file inline, and return safe
errors. Removing V1 support requires advance notice and separate usable reader.

## Residual release risk

External independent review is **BLOCKED** until genuine evidence exists.
Physical-device validation is **NOT RUN** until real Android/iOS/browser/PWA
evidence exists. Automated/emulated tests cannot change those labels.
