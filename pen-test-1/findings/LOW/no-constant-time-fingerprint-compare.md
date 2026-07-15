# LOW – No explicit constant-time comparison for fingerprint / checksum matching

**File(s):**
- `assets/index-C-hOdnpx.js`: fingerprint validation `Ot(e,t)` ("invalid fingerprint") and checksum verification `$n(Wo(o),Qy(r[1]))` ("checksum-mismatch")
- No `ct_eq`, `constantTime`, `timingSafeEqual`, or equivalent found in any bundle.

**Attacker scenario:**
The app compares public data (fingerprints derived from public keys, envelope checksums) using byte-by-byte equality, which can short-circuit on the first mismatched byte. A remote attacker measuring decryption timing might infer how many leading bytes of a forged fingerprint/checksum match the expected value. However: (a) fingerprints and checksums are **public** values — timing leakage does not reveal private keys or plaintext; (b) the dominant timing cost is the SHA-512 hash computation preceding the checksum compare, which dwarfs the compare-time signal; (c) AES-GCM authentication-tag verification is performed by WebCrypto's `crypto.subtle.decrypt`, which rejects on tag mismatch using constant-time native code. So the practical exploitability is negligible.

**Proof:**
```
$ rg -c "ct_eq|constantTime|timingSafeEqual" assets/
(no matches)

# AES-GCM decrypt handles tag verification in WebCrypto (constant-time native)
$ rg -o ".{20}decrypt\({name:.AES-GCM.{0,60}" assets/crypto-worker-DrTG_jE7.js
...i.decrypt({name:`AES-GCM`,iv:a.buffer,additionalData:s?.buffer,t...tagLength:128}...
```

**Mitigation:**
Optional hardening: implement a constant-time byte comparison utility for fingerprint/checksum equality (XOR-accumulate all bytes, compare the accumulated diff) to eliminate the theoretical timing side channel. Low priority because the compared values are public and the AEAD path is already constant-time via WebCrypto.
