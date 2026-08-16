# HIGH – Provenance mismatch: deployed bundle ≠ current source; no deployment ledger

**File(s):**
- Deployed (gh-pages commit `93e0330`): `assets/index-C-hOdnpx.js` (719,936 bytes), `assets/index-BsFQhz4p.css` (27,478 bytes)
- Built from current main (`16e889d`): `dist/assets/index-CH9Uq08u.js` (253,394 bytes), `dist/assets/index-BN1mG1py.css` (16,737 bytes)
- `docs/deployed-releases.json`: `{ "schemaVersion": 2, "deployments": [] }` (empty ledger)

**Attacker scenario:**
An attacker with "full source" capability reviews `main` and finds a clean, dependency-minimized codebase (253 kB, no `pdf-lib`). Meanwhile the live site serves a 720 kB bundle built from an unknown earlier commit that still bundles `pdf-lib` (4 matches for `pdf-lib`/`FLATE`/`PDF-`/`XFA` in the deployed `index-C-hOdnpx.js`). Because `deployed-releases.json` is empty, there is no auditable mapping from the deployed artifact hashes back to a source commit. The attacker cannot prove the deployed code equals any reviewed source — a supply-chain opacity gap the threat model itself lists as an assumed capability ("Compromise the deployment and serve modified JavaScript").

**Proof:**
```
# Deployed bundle contains pdf-lib; current source does not
$ rg -c "pdf-lib|FLATE|PDF-|XFA" /tmp/audit-live/assets/index-C-hOdnpx.js
4
$ rg -l "pdf-lib" /tmp/audit-src/src/ /tmp/audit-src/package.json
(no matches — pdf-lib removed from current main)

# Content-hash mismatch (different builds)
Deployed:  index-C-hOdnpx.js   719,936 B
Built:     index-CH9Uq08u.js   253,394 B   (3x smaller)

# Deployment ledger is empty
$ cat docs/deployed-releases.json
{ "schemaVersion": 2, "deployments": [] }

# Only 3 commits visible on main (shallow + depth-20 fetch)
16e889d fix: allow zoomed header to grow
dde80f6 test: allow real-scrypt property timing variance
81137f0 feat: build Chat NoControl beta source candidate
```

**Mitigation:**
1. Record every deployment in `docs/deployed-releases.json` with: source commit SHA, artifact SHA-256, build timestamp, and Pages URL.
2. Re-deploy from the current reviewed `main` so the live site matches the audited source, then verify artifact hashes match a reproducible build (`npm run test:reproducibility`).
3. Add a CI check that fails the Pages workflow if the built artifact hash is not registered in the ledger.
