> **Authority:** Chat NoControl documentation authority; this file normatively defines accessibility and localization architecture for Chat NoControl v1.
> **Version:** 1.0-draft
> **Status:** Public beta candidate / unaudited / not deployed
> **Depends on:** [../Chat_NoControl_full_plan.md](../Chat_NoControl_full_plan.md), [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [product-spec.md](product-spec.md), [design-spec.md](design-spec.md), [ux-content-spec.md](ux-content-spec.md), [user-guide.en.md](user-guide.en.md), [user-guide.de.md](user-guide.de.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# Accessibility and Internationalization Specification

## 1. Accessibility target

The product must meet WCAG 2.2 AA goals for keyboard access, focus management, contrast handling, error reporting, and non-color-dependent status communication.

The implementation must support:

- Keyboard complete operation.
- Screen reader use.
- 44x44 CSS pixel targets where practical for touch controls.
- 200% zoom and high reflow.
- Reduced motion preference.
- Language selection and proper document language metadata.

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
- The recovery export confirmation must be explicit and deliberate.
- Press-and-hold controls must have keyboard and pointer alternatives that are equally deliberate.
- Keyboard and switch users must be able to focus the export action, activate it, type the displayed confirmation phrase, and confirm.
- The confirmation phrase must be `EXPORT PRIVATE` in English and `PRIVAT EXPORTIEREN` in German.
- The confirmation path must not depend on time-based gesture matching.

## 4. Interaction requirements

- Touch targets should be at least `44 x 44` CSS pixels where layout allows it.
- Camera scanning must be requested only after explicit user action.
- Camera access must be stopped when the scanner view exits.
- Copy actions should report success in an accessible way.
- Loading and progress states should expose meaningful text, not just spinners.
- The app must remain usable at high zoom without losing access to primary actions.

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

## 7. Test matrix

### 7.1 Accessibility tests

| Area | Required test |
|---|---|
| Keyboard | Reach every action, field, dialog, expander, and menu without a mouse |
| Focus | Confirm visible focus and correct return focus after modal close |
| Screen reader | Verify labels, names, roles, and states for all critical controls |
| Errors | Confirm summary text and field-level errors are announced |
| Zoom | Verify 200% zoom and reflow preserve all critical actions |
| Contrast | Verify text and non-text contrast for semantic states |
| Motion | Verify reduced-motion preference removes nonessential motion |
| Touch | Verify 44x44 targets or the closest practical equivalent |
| Camera | Verify access only on action and stop on exit |

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
- Recovery warning and mandatory export in both locales.
- Encrypt and decrypt flows in both locales.
- Session-only fallback when storage is denied.
- Unknown-sender warning after decryption.
- Update banner and offline banner in both locales.

## 8. Accessibility acceptance

The accessibility and localization layer is accepted only if:

- Critical warnings remain understandable without color or motion.
- Keyboard users can complete all work.
- Screen reader users can complete identity, encrypt, decrypt, and delete flows.
- English and German remain semantically aligned.
- Protocol and cryptographic strings remain untranslated.
