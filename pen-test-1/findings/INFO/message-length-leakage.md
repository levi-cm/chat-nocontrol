# INFO – Message / file length leakage (documented non-claim)

**File(s):**
- `docs/threat-model.md` §5: "Not protected against: ... File size, object size, and message length leakage."
- Code: AES-256-GCM (a stream AEAD mode) — ciphertext length = plaintext length + 16-byte tag, no padding.

**Attacker scenario:**
An attacker observing armored PPX objects or ciphertext chunks learns the exact plaintext length of every message and file (minus the 16-byte GCM tag and fixed protocol overhead). No length padding is applied. This leaks metadata: message timing and size patterns, file type fingerprints, and traffic analysis. The chunk size is fixed at 1,048,576 bytes, so file size is revealed by chunk count + last-chunk length.

**Proof:**
```
# AES-GCM is a stream mode — no padding
$ rg -o ".{20}encrypt\({name:.AES-GCM.{0,60}" assets/crypto-worker-DrTG_jE7.js
...i.encrypt({name:`AES-GCM`,iv:a.buffer,additionalData:s?.buffer,t...tagLength:128}...

# No padding routine for message bodies
$ rg -c "pad\(|padding|padded" assets/index-C-hOdnpx.js
(padding matches are string-format padStart, not crypto padding)
```

**Mitigation:**
Documented non-claim. Padding to a fixed size or a geometric bucket would reduce length leakage at the cost of bandwidth. For an offline QR/file-based tool, exact-length leakage is lower-impact than for a real-time messaging channel. No action required for v1.
