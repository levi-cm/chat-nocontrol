# INFO – console.log present in bundled pdf-lib dependency (deployed only)

**File(s):**
- `assets/index-C-hOdnpx.js`: `console.log('FLATE:', s)` — originates from the `pdf-lib` library.
- Plus several `console.warn(...)` calls in pdf-lib PDF-parsing paths ("Removing parsed object", "Invalid object ref", "PDFTextFields must have a max length").

**Attacker scenario:**
If a user opens DevTools while processing a PDF, the `console.log('FLATE:', s)` outputs FLATE-decode debug data to the console. This is pdf-lib library noise, not app crypto material — no keys, passphrases, or plaintext messages are logged. The risk is that a user sharing a console screenshot after a support request might inadvertently include PDF content metadata. Low impact.

**Proof:**
```
$ rg -o ".{20}console\.(log|warn)[^;]{0,50}" assets/index-C-hOdnpx.js | head
...console.log(`FLATE:`,s)
...console.warn(`Removing parsed object: 0 0 R`)
...console.warn(`Invalid object ref: `+n)
...console.warn(`PDFTextFields must have a max length...`)
```

**Mitigation:**
This dependency is already removed from current `main` (`pdf-lib` is not in `package.json` and not in the freshly built `dist/`). Re-deploying from current main eliminates these console calls entirely. No app-code `console.log` of secrets was found.
