> **Authority:** Chat NoControl documentation authority; this file normatively defines accessibility and localization architecture for Chat NoControl v1.
> **Version:** 1.0-draft
> **Status:** Public beta channel / stable release unavailable / operational status is external
> **Depends on:** [../Chat_NoControl_full_plan.md](../Chat_NoControl_full_plan.md), [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [product-spec.md](product-spec.md), [design-spec.md](design-spec.md), [ux-content-spec.md](ux-content-spec.md), [user-guide.en.md](user-guide.en.md), [user-guide.de.md](user-guide.de.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# Accessibility and Internationalization Specification

Native labels, keyboard operation, focus recovery, live status/error semantics,
200-percent reflow, and serious axe checks remain release requirements across
the primary text/file workflows and every optional control.

## 1. Accessibility target

The product must meet WCAG 2.2 AA goals for keyboard access, focus management, contrast handling, error reporting, and non-color-dependent status communication.

The implementation must support:

- Keyboard complete operation.
- Screen reader use.
- 44x44 CSS pixel targets where practical for touch controls.
- 200% zoom and high reflow.
- Reduced motion preference.
- Language selection in Settings and proper document language metadata.

## 2. Semantic requirements

- Use native controls first.
- Preserve logical heading order.
- Expose state changes to assistive technology through live regions only when appropriate.
- Keep focus stable during modal, drawer, and warning transitions.
- Return focus to the invoking control after dialogs close.
- Do not encode meaning only in color.
- Do not hide critical warnings behind motion or decorative affordances.

## 3. Private warning handling

Private recovery warnings and identity loss warnings are safety-critical.

Requirements:

- They must be announced to screen readers.
- They must not depend on color alone.
- They must be visible without hover.
- Recovery downloads and their separate safe-storage attestations must use ordinary, keyboard-accessible click actions.
- The creation flow must not use a press-and-hold gesture or typed confirmation phrase.
- Every wizard screen must expose `Step {n} of 7` and its progress value as text, not through bar width or color alone.
- Focus must move to the new screen heading after a successful step transition; validation failures must focus or identify the relevant field without discarding entered data.
- Focused text, password, textarea, and select controls must show one continuous accent ring with no neutral inner border, clipping, or layout shift; the soft halo supplements rather than replaces the visible ring.
- Weak browser-vault passwords must open a keyboard-trapped confirmation dialog. Its safe action and Escape return focus to the password field; its warning must be complete in English and German.
- Browser-vault creation failures must focus a contextual error summary, preserve both password values and pending setup, and leave retry and confirmed restart available.
- The recovery PDF preview and its single Download action must be keyboard operable; small screens may omit the preview but must retain the full-width Download action.
- The four recovery-word fields must expose their requested positions, individual error states, and a shared error summary to assistive technology.
- The expert skip must be a real focusable action with an accessible confirmation dialog; it may skip only restore practice.

## 4. Interaction requirements

- Touch targets should be at least `44 x 44` CSS pixels where layout allows it.
- Camera scanning must be requested only after explicit user action.
- Camera access must be stopped when the scanner view exits.
- Copy actions should report success in an accessible way.
- Paste actions must require an explicit user gesture, report permission failure, and never read the clipboard automatically.
- Passphrase strength must use text plus color and announce the estimated bit count.
- Loading and progress states should expose meaningful text, not just spinners.
- The app must remain usable at high zoom without losing access to primary actions.
- Small screens and 200% zoom may scroll within a wizard screen when necessary; the flow must never clip required actions or depend on scrolling back to previously cleared secrets.
- The message-QR creation toggle requires English/German parity and an announced checked state. The export selector must not remain focusable or exposed to assistive technology while creation is disabled. If enabled, QR download, progress, cancellation, oversize, unknown-sender, and error copy retain keyboard and screen-reader support. Receiving controls remain usable when creation is disabled. QR icons are decorative inside named text buttons.

## 5. Localization architecture

### 5.1 Locale model

- Launch locales: `en` and `de`.
- German uses friendly informal `du`.
- English is the fallback locale.
- The UI must set a correct `html lang` value for the active locale.
- All date, time, number, and plural rendering must go through locale-aware formatting.

### 5.2 String handling

- All user-visible strings must come from keyed resources.
- Protocol strings, magic values, object identifiers, and cryptographic labels are not translated.
- Interpolation must be ICU-like and safe for reordering.
- Plural rules must be locale aware.
- Translations must preserve meaning, warnings, and severity.

### 5.3 Copy parity

- English and German must ship with semantic parity at launch.
- The same workflow cannot have a stronger warning in one language and a weaker warning in the other.
- If a string is safety-critical, both locales must express the same risk.

## 6. Accessibility and i18n architecture

- Shared content keys should drive both UI and user guide text where possible.
- Layout must tolerate longer German strings without truncating critical warnings.
- The app should not assume one-line labels fit all locales.
- Error summaries must be available for screen readers and visible users alike.
- Technical details expanders must be keyboard reachable and correctly labeled.
- Safety-critical export confirmations must remain understandable and operable in both locales.
- `Username` / `Benutzername` is localized UI terminology; the protocol field name `pseudonym` remains untranslated in technical contexts.
- Password validation, recovery equivalence, permanent-loss warnings, restore-practice instructions, and local-storage recommendation must have semantic parity in English and German.

## 7. Test matrix

### 7.1 Accessibility tests

| Area | Required test |
|---|---|
| Keyboard | Reach every action, field, dialog, expander, and menu without a mouse |
| Focus | Confirm the continuous form-control ring, no layout shift or clipping, and correct return focus after modal close |
| Screen reader | Verify labels, names, roles, and states for all critical controls |
| Errors | Confirm summary text and field-level errors are announced, including recoverable browser-vault creation failure |
| Zoom | Verify 200% zoom and reflow preserve all critical actions |
| Contrast | Verify text and non-text contrast for semantic states |
| Motion | Verify reduced-motion preference removes nonessential motion |
| Touch | Verify 44x44 targets or the closest practical equivalent |
| Camera | Verify access only on action and stop on exit |
| Wizard | Verify seven labeled steps, progress `30/42/54/66/78/90/100`, weak-password confirmation, transition focus, safe Back behavior, and secret-screen non-recreation |
| Recovery practice | Verify QR/file/word controls, four positional labels, error announcement, unlimited retries, ten-failure restart, and expert-skip dialog |
| Recovery PDF | Verify the A4 preview and single Download action, readable wrapping, mobile full-width layout, and 200% zoom/reflow |

### 7.2 Localization tests

| Area | Required test |
|---|---|
| Locale switch | Toggle between `en` and `de` without data loss |
| HTML lang | Confirm the document language matches the active locale |
| Copy parity | Compare English and German warnings for semantic equivalence |
| Fallback | Confirm missing keys fall back to English |
| Pluralization | Verify locale plural rules render correctly |
| Interpolation | Verify placeholders render in the right order for both locales |
| Protocol strings | Confirm cryptographic labels are never translated |
| German tone | Confirm friendly informal `du` is used consistently |

### 7.3 End-to-end coverage

- First-time identity creation in both locales.
- Seven-screen identity creation, matching password entry, mandatory QR, `.ppxrecovery`, and PDF downloads, written-word and storage attestations, QR restore, file restore, four-word practice, and preselected local storage in both locales.
- Session-only opt-out and storage-unavailable fallback in both locales.
- Encrypt and decrypt flows in both locales.
- Unknown-sender warning after decryption.
- Update banner and offline banner in both locales.

## 8. Accessibility acceptance

The accessibility and localization layer is accepted only if:

- Critical warnings remain understandable without color or motion.
- Keyboard users can complete all work.
- Screen reader users can complete identity, encrypt, decrypt, and delete flows.
- English and German remain semantically aligned.
- Protocol and cryptographic strings remain untranslated.
