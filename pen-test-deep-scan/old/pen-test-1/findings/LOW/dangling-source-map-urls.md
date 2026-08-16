# LOW – Dangling sourceMappingURL comments in production bundles

**File(s):**
- `assets/crypto-worker-DrTG_jE7.js` (tail): `//# sourceMappingURL=crypto-worker-DrTG_jE7.js.map`
- `assets/file-worker-Cfj9UbK3.js` (tail): `//# sourceMappingURL=file-worker-Cfj9UbK3.js.map`
- `assets/scan-worker-B6VEBPTP.js` (tail): `//# sourceMappingURL=scan-worker-B6VEBPTP.js.map`
- `assets/index-C-hOdnpx.js` (tail): `//# sourceMappingURL=index-C-hOdnpx.js.map`

**Attacker scenario:**
The `.map` files are not deployed (404), so no source is leaked today. However, the dangling `sourceMappingURL` comments reveal the original un-hashed module names (`crypto-worker`, `file-worker`, `scan-worker`, `index`) and signal that source maps were generated during the build. This is a minor information leak that also causes browser DevTools to issue failed `.map` requests. More importantly, if a future deployment includes the `.map` files (see CRITICAL-001), these comments are the breadcrumbs that lead an attacker directly to the source.

**Proof:**
```
$ rg -o "sourceMappingURL=.*" assets/*.js
assets/crypto-worker-DrTG_jE7.js: sourceMappingURL=crypto-worker-DrTG_jE7.js.map
assets/file-worker-Cfj9UbK3.js:   sourceMappingURL=file-worker-Cfj9UbK3.js.map
assets/scan-worker-B6VEBPTP.js:   sourceMappingURL=scan-worker-B6VEBPTP.js.map
assets/index-C-hOdnpx.js:         sourceMappingURL=index-C-hOdnpx.js.map

# .map files NOT present in deployed assets
$ ls assets/*.map
ls: cannot access 'assets/*.map': No such file or directory
```

**Mitigation:**
Disable source maps for production builds (`vite.config.ts: build.sourcemap: false`) or strip both the `.map` files and the `//# sourceMappingURL=` comments from the deployed `.js` files in a post-build step. Keep sourcemaps only for local development.
