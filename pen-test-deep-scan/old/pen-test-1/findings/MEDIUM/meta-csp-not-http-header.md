# MEDIUM – CSP delivered via <meta> tag instead of HTTP response header

**File(s):**
- `index.html:19-22` (both deployed and built): `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; ...">`
- Platform: GitHub Pages (no custom HTTP header support)

**Attacker scenario:**
A meta-tag CSP is applied during HTML parsing, not before delivery. If an attacker can inject or modify the HTML response (e.g., via a compromised Pages artifact or an injected `<script>` placed before the `<meta>` tag), they can run code before the CSP takes effect or strip the `<meta>` tag entirely. A header-based CSP (`Content-Security-Policy:` HTTP response header) is enforced before the HTML is parsed and cannot be removed by in-document injection. The threat model lists "compromise the deployment and serve modified JavaScript" as an assumed attacker capability — a header CSP narrows that window further than a meta CSP.

**Proof:**
```
# CSP is a <meta> tag, not an HTTP header
$ rg "Content-Security-Policy" index.html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self'; ...">

# GitHub Pages does not support custom response headers
# (no _headers file, no server config; confirmed by platform docs)
```

**Note:** The CSP policy itself is strong — `script-src 'self'` (no `unsafe-inline`/`unsafe-eval`), `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `connect-src 'self'`. This is a platform limitation, not a policy defect.

**Mitigation:**
GitHub Pages does not support custom HTTP headers, so a meta CSP is the only available mechanism on this platform. To close the gap, either (a) self-host on an origin that supports header-based CSP and HSTS, or (b) add Subresource Integrity (SRI) to all `<script>`/`<link>` tags so that even if the HTML is modified, tampered scripts won't execute (see MEDIUM-002). Document the platform limitation explicitly in the deployment contract.
