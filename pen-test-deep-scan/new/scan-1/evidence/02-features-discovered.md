# 02 — Features discovered vs coverage baseline (scan-1)

**Baseline:** §11 of `pen-test-deep-scan/DEEP-SCAN-PROMPT.md` (prompt version 1, seed).
**Live tree commit:** `328a20f` (2026-07-16).

## Diff method

Compared every directory/file under `src/`, `scripts/`, `.github/`, `docs/`, `public/`, and top-level config against:
- §2b recon buckets,
- §3 Round-1/Round-2 delegation tables,
- §4 exploit checklist,
- §11 coverage ledger rows.

## Result

**No uncovered features; tree matches coverage baseline (§11) at commit `328a20f`.**

Evidence:
- All `src/` subdirectories (`app`, `components`, `crypto`, `diagnostics`, `flows`, `i18n`, `protocol`, `storage`, `sw`, `tests`, `workers`) map onto existing §2b buckets and §3 children.
- `src/main.tsx`, `src/styles.css`, `src/vite-env.d.ts` are app entry/styling — covered by `app-ui-state` + `vite.config.ts` scope.
- `docs/superpowers/{plans,specs}/*.md` are design/planning docs, not a code subsystem — covered by `spec-drift` child (`docs/** vs src/**`).
- `docs/*.docx` (`chat-nocontrol-ui-change-request-2026-07-13.docx`) is a binary design artifact — not a code entry point.
- Build-artifact dirs (`coverage/`, `dist/`, `output/`, `playwright-report/`, `test-results/`) are gitignored outputs, not source.
- `.impeccable/` is a local tooling marker dir, not a code subsystem.
- No new worker, no new `src/realtime/`-style dir, no new CI workflow beyond `ci.yml`, `release.yml`, `security-review.yml` (all in §3 `supply-chain-build`).

## New §4 checklist items proposed this run

None — no new exploit surface beyond existing §4.1–§4.9.

## Ad-hoc children added this run

None — §3 Round-1/Round-2 tables cover the tree as-is.

## Carry-forward to §10

Only §11 ledger refresh: set `Baseline commit` → `328a20f`, `Last scan` → `scan-1`, and update `Last verified` per subsystem to `scan-1 @ 328a20f`. No §2b/§3/§4 additions needed.
