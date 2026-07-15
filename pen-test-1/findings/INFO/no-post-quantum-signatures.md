# INFO – No post-quantum signatures (documented non-claim)

**File(s):**
- `SECURITY.md:21`: "Version 1 does not claim: Post-quantum signatures."
- `SECURITY.md:14-16`: "Classical sender authentication from Ed25519." / "Hybrid confidentiality from ML-KEM-512 and classical X25519."
- Code: Ed25519 signature verification (`invalid-signature` error path in `assets/index-C-hOdnpx.js`).

**Attacker scenario:**
Confidentiality is post-quantum (ML-KEM-512), but sender authentication uses classical Ed25519. A future quantum adversary with a cryptographically relevant quantum computer could forge Ed25519 signatures and impersonate any sender, while still being unable to decrypt recorded ciphertexts. This creates an asymmetric posture: PQ confidentiality but only classical authenticity.

**Proof:**
```
# SECURITY.md
- Hybrid confidentiality from ML-KEM-512 and classical X25519.
- Classical sender authentication from Ed25519.
Version 1 does not claim:
  - Post-quantum signatures.
  - Quantum-proof security.
```

**Mitigation:**
Documented non-claim. A future protocol version could add a PQ signature scheme (e.g., ML-DSA / Dilithium) in a hybrid (classical + PQ) signature to close the gap. Until then, the asymmetric posture is acceptable for the stated v1 threat model.
