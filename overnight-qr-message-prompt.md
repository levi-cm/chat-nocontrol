[$caveman](/home/opsec/.codex/skills/caveman/SKILL.md) ultra

Work overnight in `/home/opsec/Documents/Levi-Privat/webseiten/encryption-web`.

Use `superpowers:executing-plans`, `superpowers:test-driven-development`, `superpowers:systematic-debugging` on failures, then `superpowers:verification-before-completion`.

Read fully, then execute:

1. `docs/superpowers/specs/2026-07-14-encrypted-message-qr-design.md`
2. `docs/superpowers/plans/2026-07-14-encrypted-message-qr.md`

Check prerequisite plans named there; complete pending prerequisites in required order. Continue through every safe step without asking normal checkpoint permission. Preserve current dirty worktree and user edits. Inspect diffs before edits/staging. Never use destructive git commands or `git add -A`.

Hard bars: no crypto downgrade; ML-KEM + X25519 + AES-GCM + Ed25519 remain; QR error correction always H; one QR or no button; adaptive bounded compression; fail closed before plaintext; fragment-only link scrubbed immediately; settings browser-local; EN/DE; camera + screenshot/image; low-quality portrait fixtures; offline/cross-browser/accessibility coverage. Do not weaken tests or acceptance to finish.

Use safe workarounds and persist through test/runtime issues. Run focused tests after each task, then full commands in plan. `npm run verify:quality` must pass. Run `npm run verify`; if independent-review evidence alone blocks it, report exact blocker—never fabricate/bypass it. Physical-device tests unavailable overnight: mark honestly, finish all emulation/automated/local proof.

Do not publish, push, tag, or open PR. End with completed tasks, commits/files, exact test results, remaining external blockers, device-evidence state.
