# OPSEC Audit Findings — Chat NoControl (gh-pages)

**Target:** `levi-cm/chat-nocontrol` gh-pages commit `93e033092000a6e51d8a63417a0269a881e9dd03`
**Live URL:** `https://levi-cm.github.io/chat-nocontrol/`
**Source audited:** `main` @ `16e889d` (cross-referenced for provenance)
**Date:** 2026-07-14
**Auditor capability:** Full source + ciphertext + public contact + unlimited offline analysis

---

## Summary

| Severity | Count | Immediate action |
|----------|-------|------------------|
| Critical | 1 | Stop deployment, fix NOW |
| High | 1 | Fix within 24 h |
| Medium | 3 | Next sprint |
| Low | 3 | Document / backlog |
| Info | 5 | Acknowledged (documented non-claims + positive posture) |

**Headline:** The cryptography is sound — AES-256-GCM, hybrid ML-KEM-512 + X25519, Ed25519 signatures, scrypt vault encryption at rest, zeroization, no backend, strict CSP. **No Critical/High cryptographic flaw was found.** The single Critical is a **deployment-pipeline defect**: source maps are enabled and the Pages workflow would publish them, exposing the full TypeScript source on the next deploy. The High is a **provenance gap**: the live bundle (720 kB, contains `pdf-lib`) does not match the current reviewed source (253 kB, `pdf-lib` removed) and the deployment ledger is empty.

---

## CRITICAL

| ID | Title | File |
|----|-------|------|
| CRIT-001 | Source maps generated and deployed to GitHub Pages via the Pages workflow | [CRITICAL/source-maps-deployed-via-pages-workflow.md](CRITICAL/source-maps-deployed-via-pages-workflow.md) |

## HIGH

| ID | Title | File |
|----|-------|------|
| HIGH-001 | Provenance mismatch: deployed bundle ≠ current source; no deployment ledger | [HIGH/provenance-mismatch-deployed-vs-source.md](HIGH/provenance-mismatch-deployed-vs-source.md) |

## MEDIUM

| ID | Title | File |
|----|-------|------|
| MED-001 | Live deployment contradicts SECURITY.md "unaudited / not deployed" policy | [MEDIUM/deployment-vs-security-policy-mismatch.md](MEDIUM/deployment-vs-security-policy-mismatch.md) |
| MED-002 | CSP delivered via `<meta>` tag instead of HTTP response header | [MEDIUM/meta-csp-not-http-header.md](MEDIUM/meta-csp-not-http-header.md) |
| MED-003 | No Subresource Integrity (SRI) on deployed scripts/stylesheets | [MEDIUM/no-sri-on-deployed-scripts.md](MEDIUM/no-sri-on-deployed-scripts.md) |

## LOW

| ID | Title | File |
|----|-------|------|
| LOW-001 | Dangling `sourceMappingURL` comments in production bundles | [LOW/dangling-source-map-urls.md](LOW/dangling-source-map-urls.md) |
| LOW-002 | scrypt N=65536 is acceptable but conservative for offline brute-force | [LOW/scrypt-params-conservative.md](LOW/scrypt-params-conservative.md) |
| LOW-003 | No explicit constant-time comparison for fingerprint/checksum matching | [LOW/no-constant-time-fingerprint-compare.md](LOW/no-constant-time-fingerprint-compare.md) |

## INFO

| ID | Title | File |
|----|-------|------|
| INFO-001 | No forward secrecy / ratchet (documented non-claim) | [INFO/no-forward-secrecy.md](INFO/no-forward-secrecy.md) |
| INFO-002 | No post-quantum signatures (documented non-claim) | [INFO/no-post-quantum-signatures.md](INFO/no-post-quantum-signatures.md) |
| INFO-003 | Message/file length leakage (documented non-claim) | [INFO/message-length-leakage.md](INFO/message-length-leakage.md) |
| INFO-004 | No guaranteed secure memory deletion (documented non-claim) | [INFO/no-guaranteed-secure-deletion.md](INFO/no-guaranteed-secure-deletion.md) |
| INFO-005 | console.log in bundled pdf-lib (deployed only; removed in current main) | [INFO/console-log-in-pdf-lib.md](INFO/console-log-in-pdf-lib.md) |
| INFO-006 | Positive security posture (full PASS ledger) | [INFO/positive-security-posture.md](INFO/positive-security-posture.md) |

---

## Methodology

Phases 0-8 per the audit plan. Frozen gh-pages clone at `/tmp/audit-live`; source clone at `/tmp/audit-src` (main branch) for provenance cross-check, dependency audit, and reproducible-build verification. All grep/rg searches run against deployed bundles; `npm audit` and build comparison run against source. No live site traffic generated; no workspace files modified.

## Audit metadata

```
COMMIT=93e033092000a6e51d8a63417a0269a881e9dd03
SOURCE_MAIN=16e889d
PAGES_SOURCE={"branch":"gh-pages","path":"/"}
NPM_AUDIT=0 vulnerabilities (374 prod deps)
LOCKFILE_VERSION=3
```
