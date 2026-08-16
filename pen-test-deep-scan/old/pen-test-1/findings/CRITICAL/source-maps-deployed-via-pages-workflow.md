# CRITICAL – Source maps generated and deployed to GitHub Pages via the Pages workflow

**File(s):**
- `vite.config.ts` (source): `build: { target: "es2023", sourcemap: true }`
- `.github/workflows/pages.yml:37-39`: `actions/upload-pages-artifact` with `path: dist` (no `.map` stripping step)
- Built artifacts observed: `dist/assets/index-CH9Uq08u.js.map` (1,112,370 bytes), `dist/assets/crypto-worker-C1O6-lIe.js.map` (564,489 bytes), `dist/assets/file-worker-BgcFw13z.js.map` (563,887 bytes), `dist/assets/scan-worker-CJMzmVIi.js.map` (569,871 bytes)

**Attacker scenario:**
The next `Pages` workflow run on `main` builds with `sourcemap: true` and uploads the entirety of `dist/` — including `.map` files — to GitHub Pages. An attacker fetches `https://levi-cm.github.io/chat-nocontrol/assets/index-*.js.map` and recovers the full original TypeScript source: PPX protocol internals, vault passphrase handling, scrypt parameters, key derivation, Ed25519/ML-KEM/X25519 usage, worker message contracts, and all comments/variable names. This collapses reverse-engineering cost and exposes implementation details that aid cryptanalysis and targeted attacks.

**Proof:**
```
# vite.config.ts
build: { target: "es2023", sourcemap: true },

# Build output (current main HEAD @ 16e889d)
$ ls -la dist/assets/*.map
-rw-r--r-- 564489  crypto-worker-C1O6-lIe.js.map
-rw-r--r-- 563887  file-worker-BgcFw13z.js.map
-rw-r--r-- 1112370 index-CH9Uq08u.js.map   # 1.1 MB — full TS source
-rw-r--r-- 569871  scan-worker-CJMzmVIi.js.map

# pages.yml — no step strips .map before upload
- uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa # v3
  with:
    path: dist

# Deployed bundles already carry the dangling reference:
$ rg -o "sourceMappingURL=.*" assets/*.js
assets/crypto-worker-DrTG_jE7.js: sourceMappingURL=crypto-worker-DrTG_jE7.js.map
assets/file-worker-Cfj9UbK3.js:   sourceMappingURL=file-worker-Cfj9UbK3.js.map
assets/scan-worker-B6VEBPTP.js:   sourceMappingURL=scan-worker-B6VEBPTP.js.map
assets/index-C-hOdnpx.js:         sourceMappingURL=index-C-hOdnpx.js.map
```

**Why the current live site dodges this:** The deployed gh-pages commit `93e0330` ("deploy: publish private preview to GitHub Pages") was produced from an older source/config and the `.map` files are absent from the `assets/` directory. The `pages.yml` workflow has **no** `.map`-stripping step, so any future deployment from current `main` will publish the source maps.

**Mitigation:**
Set `build.sourcemap: false` in `vite.config.ts` for production, **or** add a post-build step in `pages.yml` that deletes `dist/assets/*.map` before `upload-pages-artifact`. Recommended: keep sourcemaps for local dev (`command === 'serve'`) and disable for `build`, and also strip the `//# sourceMappingURL=` comments from the deployed `.js` files (see LOW-001).
