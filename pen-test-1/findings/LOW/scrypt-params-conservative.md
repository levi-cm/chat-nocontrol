# LOW – scrypt N=65536 is acceptable but conservative for offline brute-force

**File(s):**
- `assets/crypto-worker-DrTG_jE7.js`: `scryptN:65536,scryptR:8,scryptP:2`
- `docs/threat-model.md` §6.5: "Use scrypt with `N = 65536`, `r = 8`, `p = 2`" (spec match — code conforms)

**Attacker scenario:**
An attacker who steals the encrypted vault from IndexedDB performs an offline brute-force attack. With `N=2^16, r=8, p=2` the per-guess cost is ~67 MB memory + ~50-100 ms on a modern CPU. A well-resourced attacker with GPU/FPGA rigs can try many guesses in parallel. For a weak user passphrase (the minimum is 10 characters), `N=2^16` may be insufficient to resist sustained offline cracking. Doubling N to `2^17` or `2^18` doubles-to-quadruples the cost per guess with marginal UX impact on modern hardware.

**Proof:**
```
$ rg -o "scryptN:[0-9]+,scryptR:[0-9]+,scryptP:[0-9]+" assets/crypto-worker-DrTG_jE7.js
scryptN:65536,scryptR:8,scryptP:2

# Validation enforces these exact params (no downgrade)
$ rg -o "scryptN!==65536\|\|e.scryptR!==8\|\|e.scryptP!==2" assets/crypto-worker-DrTG_jE7.js
scryptN!==65536||e.scryptR!==8||e.scryptP!==2
```

**Mitigation:**
This is a judgment call, not a defect — the params match the documented spec and are memory-hard. Consider raising to `N=2^17, r=8, p=1` (or `N=2^18`) for the next protocol version if UX testing confirms acceptable unlock latency. Enforce a stronger minimum passphrase policy (entropy-based, not just length ≥ 10) to make the KDF cost less load-bearing. The existing `passphrase-meter` UI is a good complement.
