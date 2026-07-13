> **Authority:** Chat NoControl documentation authority; this file normatively defines the system design boundaries for Chat NoControl v1.
> **Version:** 1.0-draft
> **Status:** Public beta candidate / unaudited / not deployed
> **Depends on:** [../Chat_NoControl_full_plan.md](../Chat_NoControl_full_plan.md), [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [product-spec.md](product-spec.md), [apple-visual-spec.md](apple-visual-spec.md), [ux-content-spec.md](ux-content-spec.md), [accessibility-i18n.md](accessibility-i18n.md), [user-guide.en.md](user-guide.en.md), [user-guide.de.md](user-guide.de.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# Design Specification

## 1. Design scope

This document defines functional architecture, state flow, storage boundaries, and operational behavior.

The approved palette, system font stack, shapes, material, layout, motion, and
accessibility preflight live in `apple-visual-spec.md`. This document owns the
functional architecture and must not weaken that visual contract.

The semantic card distinction is normative: private `PPXV` and `PPXR` cards
use the specified red danger treatment with visible warning text and
iconography, while public `PPXC` cards use a clearly non-danger treatment.

## 2. Architectural model

The app is a static browser/PWA shell composed of these functional areas:

- App shell and navigation.
- Identity setup and identity detail views.
- Encrypt workflow.
- Decrypt workflow.
- Contacts management.
- Help/About and diagnostics.
- Localization and accessibility layer.

The shell talks only to local browser capabilities and local storage. It does not talk to a backend.

## 3. Functional boundaries

- UI code may request import, export, encrypt, decrypt, validate, delete, and diagnostics generation.
- Protocol code owns parsing, serialization, and wire-format validation.
- Crypto code owns key derivation, encryption, decryption, signatures, and object wrapping.
- Storage code may hold only public contacts, encrypted vault data, and user-approved local settings.
- No component may silently persist message history.

The crypto/provider boundary must stay explicit so the implementation can be swapped without changing protocol objects.

## 4. Navigation and layout

- Mobile uses bottom navigation with Encrypt, Decrypt, Contacts, Identity, Help.
- Desktop uses a left rail with the same destinations.
- The app must feel complete on desktop, not like a stripped mobile screen stretched wider.
- The initial functional destination after identity readiness is Encrypt.
- The first screen for a new user is Create identity / Import identity.

## 5. Core flows

### 5.1 Identity setup

1. Explain that the app is local and accountless.
2. Require a pseudonym and warn that it is public and nonunique.
3. Generate identity only on explicit action.
4. Produce the public contact.
5. Show the private recovery export as dangerous.
6. Offer the encrypted local vault as an optional remember-this-identity action.
7. Require recovery export before the flow can finish.

### 5.2 Encrypt

1. Select one recipient from searchable contacts.
2. Choose text or file mode.
3. Enforce byte limits before expensive work.
4. Show progress and allow cancel.
5. Offer copy, save, or share where capability detection allows it.
6. Restart file operations from the beginning if interrupted.

### 5.3 Decrypt

1. Accept a single smart paste/drop/file area.
2. Detect armored text or file objects.
3. Route to text or file decrypt.
4. Show safe failure messages first.
5. Reveal sanitized technical details only through an expander.
6. Revoke Blob URLs after use.

### 5.4 Contacts

1. Store public contacts by default.
2. Allow local nicknames.
3. Support search by pseudonym, nickname, and advanced fingerprint detail.
4. Merge repeat imports of the same key.
5. Warn when a new key arrives with an existing pseudonym.

### 5.5 Identity and vault

1. Show active identity information and recovery state.
2. Support lock now.
3. Support delete vault.
4. Support delete contacts.
5. Support confirmed erase-all.

### 5.6 Help and diagnostics

1. Surface product limits in plain language.
2. Show exact claims and non-claims.
3. Link the dedicated chat-control explainer.
4. Generate a sanitized diagnostics report locally.
5. Require user review before opening a GitHub issue draft.

## 6. Storage model

### 6.1 Persistent storage

- Public contacts persist by default.
- Optional encrypted vault persists only if the user chooses to remember the identity.
- Local settings may persist if the browser allows it.
- No plaintext identity, message history, or decrypted file cache may be stored persistently.

### 6.2 Session-only mode

- No identity persistence.
- No contact persistence.
- No operation-data persistence.
- Automatic fallback when storage is denied or unavailable.
- Current-session work must continue even if persistence cannot be used.

### 6.3 Erasure and retention

- Delete contact.
- Delete vault.
- Confirmed erase-all.
- Clipboard clearing is best effort after 60 seconds.
- Storage eviction must be warned as a data-loss risk.
- No secure deletion guarantee may be claimed.

## 7. Offline and update model

- The app should be able to work offline after the first successful load.
- Versioned assets may be cached for reloads.
- Identities, contacts, decrypted content, and QR payloads must never be cached as application assets.
- When a deployed version changes, the app must notify the user that a newer version is available.
- Reload must never interrupt an operation or a visible decrypted result.

## 8. Error model

The UI must separate these classes:

- Format and parse failures.
- Wrong-identity-or-corruption failures.
- Wrong-passphrase-or-corruption failures.
- Invalid signature or invalid AEAD failures.
- Storage-denied or storage-unavailable failures.
- Capability-unavailable states such as no share target or no file system save support.

The user-facing copy should be short and safe first, with technical details hidden by default.

## 9. Media handling

- Images may render inline only after successful decryption and validation.
- Audio and video may render in a contained player only after successful validation.
- Playback starts only when the user presses play.
- Fullscreen must remain a manual action.
- Unsupported media and document files must use safe download only.

## 10. Camera and clipboard

- Camera access is requested only after explicit user action.
- The camera must stop on exit from scanning.
- Clipboard writes may be used for armor and short outputs where the user requests copy.
- Clipboard clearing is best effort and must not be presented as guaranteed deletion.

## 11. Visual implementation boundary

Visual implementation must follow `apple-visual-spec.md`. It may not add remote
fonts or images, decorative downloads, gradient text, security-themed neon,
page-load choreography, parallax, cursor effects, or infinite decorative
loops. Private export surfaces remain danger-first and structurally distinct
from public contact cards.

## 12. Architecture acceptance

The design is accepted only if:

- No backend dependency appears in any critical path.
- The app shell, identity flows, encrypt/decrypt flows, contacts, help, and diagnostics are complete.
- Storage behavior matches the product specification in both normal and denied-storage modes.
- The responsive shell remains functional on mobile and desktop.
- The design spec does not smuggle in visual constraints that were not approved.
