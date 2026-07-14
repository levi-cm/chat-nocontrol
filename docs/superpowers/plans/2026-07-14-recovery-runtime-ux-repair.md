# Recovery, Runtime, and Identity UX Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for this tightly coupled change set. Work inline in the current worktree; use subagents only for a clearly independent review.

**Goal:** Fix the reported onboarding, recovery-document, clipboard, camera, decrypted-text, spacing, vault-layout, CSP-diagnostic, and unlock-routing issues without redesigning the product.

**Architecture:** Preserve the current Preact components and visual language. Make the generated PDF the single printable preview source, introduce explicit browser-capability results for clipboard/camera behavior, and separate route completion from successful identity unlock. Keep all private artifacts transient and revoke generated object URLs.

**Tech Stack:** Preact, TypeScript, Vite, pdf-lib, Vitest, Testing Library, Playwright, Tailscale Serve.

---

## Locked decisions

- Preserve current typography, colors, cards, buttons, and navigation. Do not add dashboard tiles, decorative panels, or a new design system.
- Replace the red username warning with calm guidance: people see the username in contacts; do not use a real or traceable name.
- Require all three recovery-document confirmations as independent checkboxes: written words, safely stored printout, and safely stored downloaded PDF.
- Show the actual generated A4 PDF inline on desktop. On phone, omit the embedded preview and show the recovery words plus print/download actions.
- Keep `script-src 'self'`; never add the reported inline-script hash, nonce, or `'unsafe-inline'`. The clean Helium profile produced only Vite connection logs, so the reported `index.js` violation is external/injected code being blocked as intended.
- Unlocking a remembered identity from `#/identity` stays on Identity. Completing a new identity or import may continue to Encrypt.
- Use HTTPS for cross-device development. Plain Tailscale HTTP remains an explicitly named compatibility/debug command, not the recommended phone-testing path.
- Adaptive text compression is intentionally isolated in the companion protocol plan; complete this repair plan first.

## Visual direction from the design-taste audit

**Design read:** Preserve-mode redesign of a privacy-critical utility for nontechnical users. The interface should feel calm, explicit, and dependable, not promotional or dashboard-like.

- Dials: `DESIGN_VARIANCE 3`, `MOTION_INTENSITY 2`, `VISUAL_DENSITY 6`.
- Keep the existing native CSS token system, system type stack, light/dark themes, accent choices, focus treatment, `16px` panel radius, and `12px` control radius. Add no UI dependency and no new icon family.
- Keep danger color for actual secret exposure, permanent loss, and destructive actions. Public-username guidance is ordinary neutral help text.
- Use cards only for real objects or selectable choices: recovery artifacts, public/private exports, and the Step 7 radio choices. Explanatory copy and local-data actions stay in normal document flow.
- Use one spacing rhythm inside each flow instead of stacking component margins on top of grid gaps. Prefer a compact `8/12/16/24/32px` scale and preserve existing responsive `clamp()` values outside the repaired screens.
- Add no decorative animation. Existing hover, press, progress, focus, and feedback transitions are sufficient; continue honoring reduced-motion behavior.
- Every two-column layout must have an explicit single-column order below `768px`. The PDF iframe is omitted below `640px` instead of being squeezed.
- Do not produce synthetic option boards or div-based mock screenshots. Visual review uses screenshots of the real application at the target viewports.

### Task 0: Capture the real visual baseline

**Files:**
- Create locally only: `/tmp/chat-nocontrol-ux-before/`
- Do not commit generated screenshots.

- [ ] Start the current app without changing code and capture the real Step 1, recovery screen, Step 7, and unlocked Identity page at `360x800`, `768x1024`, and `1440x900`.
- [ ] Record the existing tokens and the exact defects visible in each screenshot: compounded Step 7 gaps, stretched/centered Identity grid, detached delete controls, squeezed mobile recovery document, and desktop HTML preview mismatch.
- [ ] Use these captures only as before-state evidence. Do not turn them into a design-choice gallery.
- [ ] After Tasks 2-9, capture the same states and viewports in `/tmp/chat-nocontrol-ux-after/` for direct before/after comparison.

## Worktree safety

The worktree already contains user changes, including modifications to every major file in this plan. Do not reset, checkout, or replace files wholesale. Before each task, inspect `git diff -- <paths>` and edit the current versions. Stage/commit only files intentionally changed for that task.

### Task 1: Lock reported behavior with failing tests

**Files:**
- Modify: `src/tests/unit/identity-create-wizard.test.tsx`
- Modify: `src/tests/unit/recovery-artifacts.test.ts`
- Modify: `src/tests/unit/recovery-document-view.test.tsx`
- Modify: `src/tests/unit/clipboard-best-effort.test.ts`
- Modify: `src/tests/accessibility/qr-import-camera.test.tsx`
- Modify: `src/tests/e2e/identity-create.spec.ts`
- Modify: `src/tests/e2e/remembered-vault.spec.ts`
- Modify: `src/tests/e2e/helpers.ts`
- Modify: `src/tests/unit/ui-change-request.test.tsx`

- [ ] Add a username-step assertion for calm guidance and absence of the red warning class.
- [ ] Add recovery-step assertions that the three controls are checkboxes, Continue remains disabled after one or two checks, and enables only after all three artifact actions and confirmations.
- [ ] Change `completeRecoveryConfirmation()` to use the print link, return to the recovery screen, download the PDF, and check all three confirmations in English and German.
- [ ] Add PDF layout boundary tests for a 48-byte username, maximum 256-character password, long recovery code, German copy, QR/password non-overlap, and warning text inside the A4 page.
- [ ] Add viewport tests: desktop contains a titled PDF iframe; mobile contains no PDF iframe and retains print/download controls.
- [ ] Add clipboard cases for missing `navigator.clipboard`, rejected `writeText`, successful legacy copy, and honest manual-selection fallback.
- [ ] Add camera cases for insecure context, denied permission, missing camera, busy camera, and generic scanner failure; assert each gets distinct EN/DE guidance while file upload remains usable.
- [ ] Change remembered-vault expectations so button and mobile-paste unlocks remain at `#/identity`; retain existing assertions that new identity completion reaches `#/encrypt`.
- [ ] Add layout assertions that local-data actions follow the export grid and that Step 7 uses its specialized spacing classes.
- [ ] Run the focused suite and confirm it fails for the intended missing behavior:

```bash
npx vitest run \
  src/tests/unit/identity-create-wizard.test.tsx \
  src/tests/unit/recovery-artifacts.test.ts \
  src/tests/unit/recovery-document-view.test.tsx \
  src/tests/unit/clipboard-best-effort.test.ts \
  src/tests/accessibility/qr-import-camera.test.tsx \
  src/tests/unit/ui-change-request.test.tsx
npx playwright test src/tests/e2e/identity-create.spec.ts src/tests/e2e/remembered-vault.spec.ts
```

Expected: new assertions fail; unrelated existing cases remain green.

- [ ] Commit only the characterization tests:

```bash
git add src/tests/unit/identity-create-wizard.test.tsx src/tests/unit/recovery-artifacts.test.ts src/tests/unit/recovery-document-view.test.tsx src/tests/unit/clipboard-best-effort.test.ts src/tests/accessibility/qr-import-camera.test.tsx src/tests/e2e/identity-create.spec.ts src/tests/e2e/remembered-vault.spec.ts src/tests/e2e/helpers.ts src/tests/unit/ui-change-request.test.tsx
git commit -m "test: cover reported recovery and runtime regressions"
```

### Task 2: Calm username guidance and repair the private QR card header

**Files:**
- Modify: `src/flows/identity/create.tsx`
- Modify: `src/flows/identity/recovery-card.ts`
- Modify: `src/flows/identity/recovery-artifacts.ts`
- Modify: `src/i18n/index.ts`
- Modify: `src/styles.css`
- Test: `src/tests/unit/identity-create-wizard.test.tsx`
- Test: `src/tests/unit/recovery-artifacts.test.ts`

- [ ] Replace the warning panel on Step 1 with a neutral `.username-guidance` paragraph or note using this English copy:

```text
People will see this username in their contacts. Do not use your real name or anything that can be traced back to you. Choose a made-up name instead.
```

Use equivalent German copy:

```text
Andere Personen sehen diesen Benutzernamen in ihren Kontakten. Verwende nicht deinen echten Namen oder etwas, das zu dir zurückverfolgt werden kann. Wähle stattdessen einen erfundenen Namen.
```

Remove the redundant red title `Public username, not a secret`; keep validation errors red.

- [ ] Change private recovery-card geometry so the border never crosses the username. Draw the border before content, reserve a header safe area, and move all text baselines below the border inset. Keep a square QR with a full quiet zone and the warning below it.
- [ ] Export the header/border geometry from `recovery-artifacts.ts` and test that every text bounding box is inside the border and above `qrTop`.
- [ ] Run:

```bash
npx vitest run src/tests/unit/identity-create-wizard.test.tsx src/tests/unit/recovery-artifacts.test.ts
```

Expected: PASS.

- [ ] Commit:

```bash
git add src/flows/identity/create.tsx src/flows/identity/recovery-card.ts src/flows/identity/recovery-artifacts.ts src/i18n/index.ts src/styles.css src/tests/unit/identity-create-wizard.test.tsx src/tests/unit/recovery-artifacts.test.ts
git commit -m "fix: calm username guidance and protect QR header"
```

### Task 3: Make the A4 PDF layout deterministic and non-overlapping

**Files:**
- Create: `src/flows/identity/recovery-pdf-layout.ts`
- Create: `scripts/render-recovery-pdf-fixture.ts`
- Modify: `src/flows/identity/recovery-pdf.ts`
- Modify: `src/tests/unit/recovery-artifacts.test.ts`

- [ ] Extract a pure A4 layout calculation with named rectangles for header, metadata, left recovery-code column, QR, full-width password section, word grid, and warning footer.
- [ ] Place only the recovery code beside the QR. Start the full-width password box below the lower edge of both columns, then place words below the password. This removes the current QR/password collision by construction.
- [ ] Replace character-count wrapping with font-width wrapping using `PDFFont.widthOfTextAtSize()`. Break an overlong token only when it cannot fit on an empty line.
- [ ] Calculate warning-box height from wrapped lines; never truncate with `.slice(0, 2)`. Assert every line baseline and rectangle remains within the A4 margins.
- [ ] Keep the PDF one page for worst-case supported input. If calculated content cannot fit, reduce only body/monospace font sizes down to explicit minimums (`7pt` body, `6pt` code); throw an artifact error rather than overlap or clip.
- [ ] Add structural assertions for all rectangle intersections and page bounds, then run:

```bash
npx vitest run src/tests/unit/recovery-artifacts.test.ts
```

Expected: PASS, including maximum-input and German cases.

- [ ] Generate a deterministic sample PDF in a temporary directory, render it with Poppler, and inspect the PNG:

```bash
mkdir -p /tmp/chat-nocontrol-pdf-check
npx tsx scripts/render-recovery-pdf-fixture.ts /tmp/chat-nocontrol-pdf-check/recovery.pdf
pdftoppm -png -r 144 /tmp/chat-nocontrol-pdf-check/recovery.pdf /tmp/chat-nocontrol-pdf-check/recovery
```

Acceptance: no QR/password overlap, no clipped username or warning, legible 24-word grid, consistent margins, one A4 page.

- [ ] Commit:

```bash
git add src/flows/identity/recovery-pdf-layout.ts src/flows/identity/recovery-pdf.ts src/tests/unit/recovery-artifacts.test.ts scripts/render-recovery-pdf-fixture.ts
git commit -m "fix: guarantee recovery PDF layout bounds"
```

### Task 4: Use the generated PDF as the desktop preview

**Files:**
- Modify: `src/flows/identity/recovery-document.tsx`
- Modify: `src/flows/identity/create.tsx`
- Modify: `src/components/media/blob-url.ts`
- Modify: `src/styles.css`
- Modify: `index.html`
- Test: `src/tests/unit/recovery-document-view.test.tsx`
- Test: `src/tests/unit/blob-url-cleanup.test.ts`
- Test: `src/tests/e2e/identity-create.spec.ts`

- [ ] Replace the separate responsive HTML print page with `RecoveryPdfPreview`. It accepts the already generated PDF bytes and filename, owns one revocable `blob:` URL, and exposes:
  - a desktop `<iframe title="Private recovery PDF preview">` using those exact bytes;
  - a `Print / Save as PDF` link opening the same blob in a new tab;
  - a `Download recovery PDF` action using the same bytes;
  - mobile copy explaining that the A4 preview is hidden on small screens while actions remain available.
- [ ] Generate and cache the document model/PDF once when Step 4 opens. Reuse it for iframe, print, and download. Revoke the URL and clear model, bytes, password, and pending artifact operations when leaving secret screens or restarting.
- [ ] Add only `frame-src 'self' blob:` to CSP for the local iframe. Keep `script-src 'self'`, `object-src 'none'`, and every other directive unchanged.
- [ ] Use CSS at `max-width: 640px` to omit the embedded preview and at larger widths to show an A4-ratio frame. Do not emulate a phone-sized print document on desktop.
- [ ] Run:

```bash
npx vitest run src/tests/unit/recovery-document-view.test.tsx src/tests/unit/blob-url-cleanup.test.ts
npx playwright test src/tests/e2e/identity-create.spec.ts
```

Expected: PASS; desktop preview and download are byte-identical; mobile has no visible iframe.

- [ ] Commit:

```bash
git add src/flows/identity/recovery-document.tsx src/flows/identity/create.tsx src/components/media/blob-url.ts src/styles.css index.html src/tests/unit/recovery-document-view.test.tsx src/tests/unit/blob-url-cleanup.test.ts src/tests/e2e/identity-create.spec.ts
git commit -m "fix: preview the real recovery PDF on desktop"
```

### Task 5: Require all three recovery confirmations

**Files:**
- Modify: `src/flows/identity/create.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/tests/e2e/helpers.ts`
- Modify: `src/tests/accessibility/interaction-matrix.spec.ts`
- Test: `src/tests/unit/identity-create-wizard.test.tsx`
- Test: `src/tests/e2e/identity-create.spec.ts`

- [ ] Replace `WordBackupMethod` with three booleans:

```ts
interface RecoveryDocumentCompletion {
  wordsWritten: boolean;
  printStored: boolean;
  pdfStored: boolean;
}
```

- [ ] Render independent checkboxes. Keep print disabled until the print link is activated and PDF disabled until download starts successfully. Enable Continue only when all three booleans are true.
- [ ] Change the legend to `Confirm all recovery backups` / `Alle Wiederherstellungssicherungen bestätigen` and keep each label explicit.
- [ ] Reset all three values on restart and secret-screen teardown.
- [ ] Update shared E2E helpers and keyboard-accessibility tests to activate all three controls.
- [ ] Run:

```bash
npx vitest run src/tests/unit/identity-create-wizard.test.tsx
npx playwright test src/tests/e2e/identity-create.spec.ts src/tests/accessibility/interaction-matrix.spec.ts
```

Expected: PASS; one or two confirmations cannot advance.

- [ ] Commit:

```bash
git add src/flows/identity/create.tsx src/i18n/index.ts src/tests/e2e/helpers.ts src/tests/accessibility/interaction-matrix.spec.ts src/tests/unit/identity-create-wizard.test.tsx src/tests/e2e/identity-create.spec.ts
git commit -m "fix: require every recovery document backup"
```

### Task 6: Tighten Step 7 and identity-page layout without redesigning them

**Files:**
- Modify: `src/flows/identity/create.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/styles.css`
- Test: `src/tests/unit/ui-change-request.test.tsx`

- [ ] Add a `.storage-flow` class and keep Step 7 in straightforward reading order: progress, heading, one-sentence recommendation, choice fieldset, recovery note, loss warning, and action row. Reset child margins inside the local grid so the global `22px` gap and the `.lead` `24px` top margin are never added together.
- [ ] Keep the existing two radio choice cards because they represent a real exclusive decision. Preserve the selected outline and recommended default. Use `16px` between related items, `24px` before the action row, and no empty spacer elements.
- [ ] Shorten the main Step 7 paragraph to one recommendation. Put the recovery-method detail in plain muted text beneath the choices, not inside another card. Keep the genuine permanent-loss warning compact, danger-colored, and aligned to the same content edge.
- [ ] Replace the unlocked Identity page's centered two-column root with `.identity-page`, a normal vertical flow:
  - `.identity-exports` contains only the actual public/private export cards and uses `align-items: start`;
  - with one export, give it its natural readable maximum width and do not stretch it across the page;
  - with two exports, use a balanced top-aligned grid at desktop and preserve DOM order when stacked below `768px`;
  - after the export grid, place one hairline, a plain heading and one short explanation, then `.local-data-toolbar` with grouped left-aligned destructive buttons;
  - never center destructive actions in unused page space and never wrap this toolbar in a decorative card.
- [ ] Reuse the existing token radii, colors, font stack, and button components. Add no badge, eyebrow, icon, shadow, accent color, or motion treatment for this repair.
- [ ] Run:

```bash
npx vitest run src/tests/unit/ui-change-request.test.tsx src/tests/unit/identity-create-wizard.test.tsx
npx playwright test src/tests/accessibility/flows.spec.ts
```

Expected: PASS.

- [ ] Capture the matching after-state screenshots at `360x800`, `768x1024`, and `1440x900`. Compare them directly with Task 0. Acceptance: no compounded gaps, no detached destructive buttons, no clipped content, no new decorative containers, and unchanged visual language.
- [ ] Commit:

```bash
git add src/flows/identity/create.tsx src/app/App.tsx src/i18n/index.ts src/styles.css src/tests/unit/ui-change-request.test.tsx
git commit -m "fix: tighten storage and identity page rhythm"
```

### Task 7: Make copying robust and decrypted text easy to select

**Files:**
- Modify: `src/flows/identity/clipboard.ts`
- Modify: `src/flows/encrypt/text.tsx`
- Modify: `src/flows/decrypt/index.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/styles.css`
- Test: `src/tests/unit/clipboard-best-effort.test.ts`
- Test: `src/tests/e2e/encrypt-text.spec.ts`
- Test: `src/tests/e2e/decrypt-smart-input.spec.ts`

- [ ] Change the clipboard helper result from boolean to an explicit union:

```ts
type CopyResult = "copied" | "selected" | "failed";
```

- [ ] On a user click, try `navigator.clipboard.writeText` when available. If absent or rejected, select the associated textarea and attempt synchronous `document.execCommand("copy")` as a legacy fallback. If that also fails, leave the complete output selected and return `"selected"`; never claim it was copied.
- [ ] Schedule best-effort 60-second clearing only after Async Clipboard succeeds. Do not claim clearing for legacy/manual selection.
- [ ] Add refs to encrypted output and decrypted output. Render decrypted plaintext in a labeled, readonly `<textarea>` instead of `<pre>`, preserving whitespace and allowing Android Select all.
- [ ] Add `Copy decrypted text`; reuse the same result/status behavior and sensitive clipboard wording.
- [ ] Use these outcomes:
  - copied: existing success text;
  - selected: `Automatic copy is unavailable. The complete text is selected; press Ctrl+C or use Copy.` plus German equivalent;
  - failed: existing failure text.
- [ ] Run:

```bash
npx vitest run src/tests/unit/clipboard-best-effort.test.ts
npx playwright test src/tests/e2e/encrypt-text.spec.ts src/tests/e2e/decrypt-smart-input.spec.ts
```

Expected: PASS.

- [ ] Verify in Helium on CachyOS/Hyprland over both plain HTTP and secure Tailscale HTTPS. HTTPS must copy automatically; HTTP must at least select the complete text with honest instructions.
- [ ] Commit:

```bash
git add src/flows/identity/clipboard.ts src/flows/encrypt/text.tsx src/flows/decrypt/index.tsx src/i18n/index.ts src/styles.css src/tests/unit/clipboard-best-effort.test.ts src/tests/e2e/encrypt-text.spec.ts src/tests/e2e/decrypt-smart-input.spec.ts
git commit -m "fix: provide resilient text copy behavior"
```

### Task 8: Provide secure cross-device development and useful camera errors

**Files:**
- Create: `scripts/dev-tailscale.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `src/components/qr/import.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/tests/unit/lan-development.test.ts`
- Test: `src/tests/accessibility/qr-import-camera.test.tsx`
- Test: `src/tests/release/network-denial.spec.ts`

- [ ] Add `scripts/dev-tailscale.ts` that:
  - verifies `tailscale` is installed and the node is online;
  - reads the node DNS name from `tailscale status --json` rather than hardcoding it;
  - starts Vite on `127.0.0.1:5173 --strictPort`;
  - starts foreground `tailscale serve --https=443 http://127.0.0.1:5173`;
  - prints the resulting `https://<node>.<tailnet>.ts.net/` URL;
  - forwards SIGINT/SIGTERM and terminates both children without leaving a background Serve configuration.
- [ ] Make `npm run dev` and `npm run dev:tailscale` use the secure runner. Preserve the current plain-IP command as `npm run dev:http:tailscale`; keep `dev:lan` explicit.
- [ ] Document first-run Tailscale HTTPS certificate approval and explain that phone Clipboard/Camera permissions cannot work on plain IP HTTP even though the transport is inside Tailscale.
- [ ] Add a camera capability function with outcomes `available`, `insecure-context`, and `unsupported`. Before loading ZXing, check `isSecureContext` and `navigator.mediaDevices?.getUserMedia`.
- [ ] Map `NotAllowedError`, `NotFoundError`, and `NotReadableError` to distinct EN/DE messages. The insecure message must explicitly say to open the HTTPS URL or upload the saved QR image. Preserve the upload and paste paths for every failure.
- [ ] Run:

```bash
npx vitest run src/tests/unit/lan-development.test.ts src/tests/accessibility/qr-import-camera.test.tsx
npx playwright test src/tests/release/network-denial.spec.ts
```

Expected: PASS.

- [ ] Start secure development and verify on phone Firefox: tapping Scan with camera produces the permission prompt; denying permission produces the denial message; accepting shows live video and stopping releases the camera.
- [ ] Commit:

```bash
git add scripts/dev-tailscale.ts package.json README.md src/components/qr/import.tsx src/i18n/index.ts src/tests/unit/lan-development.test.ts src/tests/accessibility/qr-import-camera.test.tsx src/tests/release/network-denial.spec.ts
git commit -m "fix: use secure Tailscale development for camera access"
```

### Task 9: Preserve Identity route after remembered-vault unlock

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/tests/e2e/remembered-vault.spec.ts`

- [ ] Use the existing `existingRememberedVault` signal to separate unlock from creation/import. After setting active identity/contact, navigate to Encrypt only when `existingRememberedVault` is false:

```ts
setActiveIdentity(identity);
setPublicContact(contact);
if (!existingRememberedVault) navigate("encrypt");
```

- [ ] Keep the current hash unchanged after button or mobile-paste unlock. Do not add history entries or a second redirect.
- [ ] Retain E2E coverage that new identity completion still navigates to Encrypt.
- [ ] Run:

```bash
npx playwright test src/tests/e2e/remembered-vault.spec.ts src/tests/e2e/identity-create.spec.ts
```

Expected: remembered unlock remains `#/identity`; new setup remains `#/encrypt`.

- [ ] Commit:

```bash
git add src/app/App.tsx src/tests/e2e/remembered-vault.spec.ts
git commit -m "fix: preserve route after identity unlock"
```

### Task 10: CSP, documentation, and full verification

**Files:**
- Modify: `src/tests/unit/app-shell.test.tsx`
- Modify: `src/tests/release/final-qa.spec.ts`
- Modify: `docs/ux-content-spec.md`
- Modify: `docs/design-spec.md`
- Modify: `docs/testing-and-release.md`
- Modify: `docs/user-guide.en.md`
- Modify: `docs/user-guide.de.md`

- [ ] Assert production CSP still contains `script-src 'self'`, excludes inline-script hashes/nonces/`'unsafe-inline'`, and permits only `frame-src 'self' blob:` for the local PDF iframe.
- [ ] Add a browser test that collects `securitypolicyviolation` events from app-owned resources. A clean Helium profile must show none. Do not fail on a browser-extension URL; record it as external diagnostics.
- [ ] Update product documentation for calm username guidance, all-three backup requirement, desktop PDF/mobile behavior, copy fallback, HTTPS camera requirement, and route-preserving unlock.
- [ ] Run focused verification:

```bash
npm run typecheck
npm run lint
npm run format:check
npx vitest run src/tests/unit/identity-create-wizard.test.tsx src/tests/unit/recovery-artifacts.test.ts src/tests/unit/recovery-document-view.test.tsx src/tests/unit/clipboard-best-effort.test.ts src/tests/unit/lan-development.test.ts src/tests/unit/ui-change-request.test.tsx src/tests/accessibility/qr-import-camera.test.tsx
npx playwright test src/tests/e2e/identity-create.spec.ts src/tests/e2e/remembered-vault.spec.ts src/tests/e2e/encrypt-text.spec.ts src/tests/e2e/decrypt-smart-input.spec.ts src/tests/release/network-denial.spec.ts src/tests/release/final-qa.spec.ts
npm run build
```

Expected: all pass.

- [ ] Run `npm run verify:quality`. Treat `test:release-prerequisites` separately: missing independent-review evidence remains an intentional release gate, not a failure of this fix set.
- [ ] Final manual matrix:
  - desktop Helium HTTPS: PDF preview, PDF download, copy, Identity unlock;
  - desktop Firefox HTTPS: same;
  - phone Firefox HTTPS: camera prompt, mobile recovery actions, decrypted textarea selection;
  - phone Chromium HTTPS: same;
  - plain HTTP diagnostic: explicit camera message and selected-text copy fallback;
  - EN/DE at 200% zoom and keyboard-only navigation.
- [ ] Run the visual preflight on the repaired screens: one theme at a time, existing accent semantics unchanged, existing radius system unchanged, every label readable and unwrapped, mobile order explicit, no unjustified card, no decorative icon, no new animation, and no em dash in new visible copy.
- [ ] Commit documentation/verification updates:

```bash
git add src/tests/unit/app-shell.test.tsx src/tests/release/final-qa.spec.ts docs/ux-content-spec.md docs/design-spec.md docs/testing-and-release.md docs/user-guide.en.md docs/user-guide.de.md
git commit -m "docs: record recovery and runtime UX guarantees"
```

## Acceptance summary

- Username guidance is calm, accurate, and non-red.
- Private QR username never touches the border.
- Desktop displays the actual A4 PDF; phone does not show a squeezed print page.
- Downloaded PDF is one page with zero clipping/overlap at maximum supported input.
- All three recovery confirmations are required and independently checkable.
- Step 7 and Identity exports use the current design language with purposeful spacing.
- Helium copy works over HTTPS and has an honest selectable fallback over HTTP.
- Decrypted text is a readonly textarea with a copy action.
- Camera permission appears on phone Firefox over HTTPS; failures explain the exact cause.
- CSP continues blocking inline scripts; no injected hash is whitelisted.
- Remembered-vault unlock stays on Identity.
