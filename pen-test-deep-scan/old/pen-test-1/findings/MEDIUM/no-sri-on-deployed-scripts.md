# MEDIUM – No Subresource Integrity (SRI) on deployed scripts/stylesheets

**File(s):**
- `index.html:30-31` (deployed): `<script type="module" crossorigin src="./assets/index-C-hOdnpx.js"></script>` and `<link rel="stylesheet" crossorigin href="./assets/index-BsFQhz4p.css">` — no `integrity=` attribute.
- `index.html:30-31` (built): same pattern, no `integrity=`.

**Attacker scenario:**
The threat model (`docs/threat-model.md` §3) explicitly assumes an attacker can "Compromise the deployment and serve modified JavaScript." Without SRI, a compromised GitHub Pages artifact (or a CDN/MITM in a non-HTTPS downgrade) serves altered JS and the browser executes it with no integrity check. With SRI + an out-of-band trusted hash, the browser would refuse the tampered script. The release workflow (`release.yml`) already produces build attestations (`attestations: write`), but this attestation is not wired into the Pages deployment or surfaced to the client.

**Proof:**
```
$ rg "integrity=" index.html
(no matches)

# Scripts carry crossorigin but no integrity hash
$ rg "crossorigin|src=" index.html
<script type="module" crossorigin src="./assets/index-C-hOdnpx.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-BsFQhz4p.css">
```

**Mitigation:**
1. Generate SRI hashes for each built asset and inject `integrity="sha384-..."` into the `<script>`/`<link>` tags at build time (Vite plugin or post-build step).
2. Publish the SRI hashes out-of-band (e.g., in a signed release ledger / GitHub Attestation) so users can verify them before trusting the site.
3. Note: self-referential SRI (hash served from the same origin as the script) only protects against partial tampering; full defense requires an out-of-band verified hash. The release workflow's `attestations: write` is the right primitive — surface it to the user (e.g., a "verify build" UI that checks the attestation).
