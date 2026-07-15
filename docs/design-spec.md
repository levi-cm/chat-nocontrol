> **Authority:** Chat NoControl documentation authority; this file normatively defines the system design boundaries for Chat NoControl v1.
> **Version:** 1.0-draft
> **Status:** Public beta channel / stable release unavailable / operational status is external
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

Identity creation is a state-machine wizard, not one vertically scrollable secret page:

1. **Username (`30%`)** — collect the public, nonunique username, map it to the protocol `pseudonym`, and generate the identity only on explicit action.
2. **Create password (`42%`)** — require matching printable-ASCII browser-vault password fields; internal spaces are allowed, leading/trailing spaces are rejected, and the maximum is `256` bytes. Strength remains advisory, but a password below the `50`-bit medium threshold requires a confirmation dialog before the encrypted vault is prepared without persistence. Cancelling or pressing Escape returns focus to the password field. A vault-operation failure preserves both fields and the pending identity, focuses a contextual error summary, and permits retry.
3. **Digital backups (`54%`)** — require ordinary-click downloads of the private QR PNG and `.ppxrecovery`, plus separate safe-storage attestations.
4. **Words and recovery document (`66%`)** — show the 24 English words and offer a transient print preview plus direct A4 PDF. Require three independent confirmations: all words written down, printout safely stored, and downloaded PDF safely stored. The document includes the exact plaintext vault password; the standalone QR and `.ppxrecovery` do not.
5. **QR restore practice (`78%`)** — teach the cleared-browser import path and verify the saved QR, camera scan, or pasted recovery code against the pending identity.
6. **File and word restore practice (`90%`)** — verify the `.ppxrecovery` file, then four stable unique random word positions. Allow unlimited retries and offer confirmed restart after ten failures.
7. **Local storage and finish (`100%`)** — recommend and preselect encrypted IndexedDB persistence, but write only after explicit confirmation. Session-only is the secondary choice and the automatic fallback when storage is unavailable.

After step 4, plaintext password, recovery words, recovery code, QR presentation, and print/PDF model are cleared and cannot be recreated through Back navigation. A confirmed expert action may skip only steps 5 and 6. The flow uses no press-and-hold control or typed export phrase.

The recovery PNG is `1024 x 1280`, adds the username and localized `PRIVATE KEY — NEVER SHARE` warning above a dark-red `#7f1d1d` QR, and retains the required quiet zone and error correction. The password, date, words, and long recovery code are excluded from this PNG.

The transient print preview and direct PDF download share one recovery-document content model so their contents cannot drift. Desktop shows those exact bytes in an A4-ratio PDF iframe; screens at or below `640px` omit the iframe while keeping words, print, and download actions. Direct offline PDF generation uses the pinned local `pdf-lib` `1.17.1` dependency and standard PDF fonts; it must not introduce a reloadable secret-bearing URL.

The wizard must explain that the QR, `.ppxrecovery`, recovery code, 24 words, and recovery document represent the same recovery authority. Losing every recovery copy and browser-vault access permanently prevents identity recovery and message decryption.

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
6. Unlocking an existing remembered vault while on Identity stays on Identity; only completed creation or import routes to Encrypt.

### 5.6 Help and diagnostics

1. Surface product limits in plain language.
2. Show exact claims and non-claims.
3. Link the dedicated chat-control explainer.
4. Generate a sanitized diagnostics report locally.
5. Require user review before opening a GitHub issue draft.

## 6. Storage model

### 6.1 Persistent storage

- Public contacts persist by default.
- Encrypted vault persistence is recommended and preselected during identity creation, but occurs only after the user's explicit final confirmation.
- Local settings may persist if the browser allows it.
- No plaintext identity, message history, or decrypted file cache may be stored persistently.
- The transient plaintext vault password must never be written to IndexedDB, settings, URLs, logs, service-worker caches, the standalone QR PNG, or `.ppxrecovery`.

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
- Camera scanning requires HTTPS. Insecure context, denied permission, missing hardware, busy hardware, and generic startup failure have distinct guidance while image upload remains available.
- Clipboard writes may be used for armor and short outputs where the user requests copy.
- If automatic and legacy copy both fail, select the complete text and give honest manual-copy instructions instead of claiming success.
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
