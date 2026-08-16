# INFO – No forward secrecy / ratchet (documented non-claim)

**File(s):**
- `SECURITY.md:22`: "Version 1 does not claim: ... Forward secrecy. A ratchet."
- `docs/threat-model.md` §5: "Not protected against: ... Forward secrecy or ratcheting. Post-compromise secrecy for previously recorded traffic."

**Attacker scenario:**
Each message to a recipient is encrypted under a key derived from that recipient's static hybrid public key (ML-KEM-512 + X25519). If the recipient's private key is ever compromised, an attacker who recorded all past ciphertexts can decrypt every message ever sent to that recipient. There is no per-message key ratchet to limit backward exposure.

**Proof:**
```
# SECURITY.md explicit non-claim
Version 1 does not claim:
  - Forward secrecy.
  - A ratchet.
  - Post-compromise secrecy for previously recorded traffic.
```

**Mitigation:**
This is a deliberate, documented protocol limitation for v1. No action required unless the threat model expands. If forward secrecy becomes a requirement, a future protocol version would need an interactive key-exchange ratchet (e.g., X3DH + Double Ratchet), which would require a relay or synchronous channel — a fundamental architecture change for this backend-free design.
