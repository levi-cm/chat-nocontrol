# INFO – No guaranteed secure memory deletion (documented non-claim)

**File(s):**
- `docs/threat-model.md` §5: "Not protected against: ... Guaranteed secure deletion in JavaScript memory."
- Code: best-effort zeroization via `fill(0)` and `G(buffer)` calls in `finally` blocks.

**Attacker scenario:**
JavaScript garbage collection and engine optimizations (copying, compaction, string interning) can leave copies of secret material in memory even after the app calls `buffer.fill(0)`. A forensic attacker with a memory dump (e.g., crash dump, hibernation file, or a compromised extension with memory access) may recover "zeroized" keys. The threat model explicitly does not guarantee secure deletion.

**Proof:**
```
# Best-effort zeroization is present (good practice, not a guarantee)
$ rg -o "fill\(0\)|\.set\(0|finally\{[^}]*G\(" assets/index-C-hOdnpx.js | head
fill(0)}function Wt
fill(0),o+=c}return
...
catch{throw new W(`wrong-passphrase-or-corruption`)}finally{t&&G(...
# G() zeroizes buffers; called on secretKey, signingSecretKey, aes256Key, plaintextDigest
```

**Mitigation:**
Documented non-claim. The app already does the right thing (best-effort `fill(0)` in `finally` blocks). True guaranteed deletion is impossible in a JS runtime. For high-assurance scenarios, recommend users close the tab after sensitive operations and rely on the OS to reclaim the process memory.
