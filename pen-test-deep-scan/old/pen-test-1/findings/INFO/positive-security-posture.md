# INFO – Positive security posture (things done right)

This file records the security controls that passed audit, to balance the findings and document the strong baseline.

## Cryptography (Phase 2) — PASS

| Control | Evidence |
|---|---|
| AES-256-GCM AEAD with 128-bit tag | `crypto.subtle` `encrypt/decrypt({name:'AES-GCM',...tagLength:128})` in `crypto-worker` |
| Random 12-byte IV per operation via CSPRNG | `crypto.getRandomValues(new Uint8Array(12))`; `nonce.byteLength!==12` validation |
| Chunked file AEAD: random noncePrefix + counter | `noncePrefix:crypto.getRandomValues(...)` + `chunkIndex`; prevents IV reuse across chunks |
| Hybrid PQ+classical KEM (ML-KEM-512 + X25519) | `@noble/post-quantum` + X25519 (`0x7fff...fed` curve25519 prime); suite `PPX-HYBRID-1` |
| Ed25519 sender signatures | `invalid-signature` error path; `signingSecretKey` (32-byte) signing flow |
| scrypt KDF with random salt | `scryptN:65536,scryptR:8,scryptP:2,salt:...`; param downgrade rejected |
| No static IV / nonce reuse | All nonces sourced from `crypto.getRandomValues`; no hardcoded IV |
| No `Math.random()` for security | 0 matches; 10 `getRandomValues`/`randomUUID` call sites |
| No hardcoded keys/salts/secrets | 0 matches for `key=/salt=/secret=/password=/token=` string literals |
| 256-bit recovery entropy (24-word BIP39) | `@scure/bip39`; `entropyToRecoveryWords` requires 32-byte input; 24-word roundtrip |

## Authentication & Access Control (Phase 3) — PASS

| Control | Evidence |
|---|---|
| Sender authentication via Ed25519 (not username) | Messages signed; `invalid-signature` rejection; no username-based trust |
| Replay resistance | `messageId` + `nonce` + `createdAt` in payload; signature covers payload |
| Keys encrypted at rest (vault) | `lockVault`/`unlockVault`; scrypt-derived key wraps vault via AES-GCM; "encrypted local vault" |
| No plaintext keys in persistent storage | "Never store plaintext identities in long-term storage" (threat model §6.5); IndexedDB holds only encrypted vault |
| No sessionStorage key persistence | 0 `sessionStorage` matches; unwrapped keys held in JS memory only |
| Zeroization of sensitive buffers | `fill(0)` and `G(buffer)` in `finally` blocks; applied to `secretKey`, `signingSecretKey`, `aes256Key`, `plaintextDigest` |

## Data Leakage & Side-Channels (Phase 4) — PASS

| Control | Evidence |
|---|---|
| Generic error messages (no oracle) | `wrong-passphrase-or-corruption`, `wrong-identity-or-corruption` — no distinction between wrong key vs. corrupted data |
| No app-code console logging of secrets | Only pdf-lib `console.log/warn` (dependency; removed in current main) |
| AEAD tag verification via WebCrypto (constant-time native) | `crypto.subtle.decrypt` rejects on GCM tag mismatch |

## Client-Side Hardening (Phase 5) — PASS

| Control | Evidence |
|---|---|
| Strict CSP, no `unsafe-inline`/`unsafe-eval` | `script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'self'` |
| No XSS sinks with user data | 0 `dangerouslySetInnerHTML`/`__html:` data assignments; 0 `eval`/`new Function`/`document.write`; innerHTML match is Preact diffing internals only |
| postMessage only to same-origin dedicated workers | All `postMessage` targets are `Worker` instances; no `window.postMessage`, no `BroadcastChannel`, no `SharedWorker`, no wildcard `targetOrigin` |
| Secure context required | `isSecureContext === true` + `crypto.subtle` presence check; app blocks with "insecure-context" / "missing-webcrypto" if absent |

## Supply Chain & Dependencies (Phase 6) — PASS

| Control | Evidence |
|---|---|
| 0 npm vulnerabilities | `npm audit --production`: 0 critical/high/moderate/low/info |
| Lockfile present (v3) | `package-lock.json`, `lockfileVersion: 3` |
| All deps exact-pinned (no `^`/`~`) | `@noble/curves: 2.2.0`, `@noble/hashes: 2.2.0`, `@noble/post-quantum: 0.6.1`, etc. |
| No install scripts (preinstall/postinstall) | 0 matches; npm 12 also blocked esbuild postinstall by default |
| Reputable crypto libraries | `@noble/*` (Paul Miller, audited), `@scure/bip39`, `@zxing/browser` |
| CI actions pinned by SHA (not tags) | `actions/checkout@34e1148...`, `actions/setup-node@49933ea5...`, etc. |
| Dependency review in CI | `security-review.yml` uses `dependency-review-action` + custom `test:dependency-review` with approved-dependencies list |
| SBOM generation + verification | `scripts/build-sbom.ts`; `test:sbom` |
| Reproducible builds tested | `scripts/check-reproducibility.ts` (double-build hash comparison); `test:reproducibility` |
| Extensive security test suite | fuzz (100k), property, mutation, truncation, boundary, QR-degradation, BIP39 roundtrip, session-only, memory-budget, NIST ML-KEM vectors, protocol golden vectors |

## Network & Transport (Phase 7) — PASS

| Control | Evidence |
|---|---|
| Backend-free / air-gapped | 0 `WebSocket`, 0 `EventSource`, 0 `fetch` to external URLs; `connect-src 'self'` enforced by CSP; only same-origin modulepreload fetch |
| No relay / signaling server | QR-code-based key exchange (`PPX1:PRIVATE:` format); offline operation tested (`test:offline`, `test:network-denial`) |
| No API keys in URLs | 0 matches for `api.key`/`?key=` |
| Served over HTTPS | GitHub Pages enforces TLS |

## Service Worker (PWA) — PASS

| Control | Evidence |
|---|---|
| SW caches only static app shell | `precacheAndRoute` lists only `manifest`, `index.html`, icons, JS/CSS bundles — no user data, no ciphertext, no keys |
| No dynamic data caching | No runtime caching routes for user content; `navigateFallback: index.html` (SPA shell only) |
