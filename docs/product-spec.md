> **Authority:** Chat NoControl documentation authority; this file normatively defines the product requirements for Chat NoControl v1.
> **Version:** 1.0-draft
> **Status:** Public beta candidate / unaudited / not deployed
> **Depends on:** [../Chat_NoControl_full_plan.md](../Chat_NoControl_full_plan.md), [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [design-spec.md](design-spec.md), [ux-content-spec.md](ux-content-spec.md), [accessibility-i18n.md](accessibility-i18n.md), [user-guide.en.md](user-guide.en.md), [user-guide.de.md](user-guide.de.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# Product Specification

## 1. Product identity

Chat NoControl is a static, accountless, backend-free browser app and PWA for public-contact exchange, local identity management, encrypted text, and encrypted file transfer.

The brand voice is dry bureaucratic satire only in name. The interface itself must be calm, plain, and trustworthy. The product serves everyday users who want practical privacy first, not political messaging in critical workflows.

## 2. Audience

- Everyday users who need a practical privacy tool for text and files.
- People who want a portable public contact and a private recovery card without creating an account.
- Users on mobile first, but also on desktop where the app should feel client-like and complete.
- Users who need English and German complete at launch.

## 3. Goals

- Create, import, export, and manage one active identity locally.
- Exchange one public contact per person and encrypt to one recipient per output.
- Encrypt and decrypt text and files locally without a server.
- Keep private material off the network and out of analytics/telemetry.
- Provide a clear help layer that explains the security limits without hype.
- Support offline use after the first successful load where the browser preserves the app shell and assets.

## 4. Success criteria

- A first-time user can create or import an identity, export the mandatory recovery material, and reach the Encrypt screen without ambiguity.
- A user can encrypt and decrypt text and files on both mobile and desktop without leaving the browser.
- Public contacts and private recovery material are visually and semantically distinct.
- The app works as a static GitHub Pages beta with no backend dependency.
- English and German content remain semantically aligned, not heading-only translations.
- The product never needs analytics, telemetry, remote scripts, a key server, a relay, or cloud sync.

## 5. Scope

### 5.1 In scope

- One active identity.
- One recipient per encrypted output.
- Text up to `256 KiB` for copy/paste armor or file save.
- One arbitrary file up to `100 MiB`.
- Optional file caption up to `16 KiB`.
- Public contacts that persist by default and may carry a local nickname.
- Session-only mode that never persists identity, contacts, or operation data.
- Local delete for contacts, vault, or confirmed erase-all.
- Diagnostics that remain local until the user reviews and opens a GitHub issue draft.

### 5.2 Out of scope

- Message history.
- Multiple identity management.
- Bundled or group messaging.
- Relay, cloud sync, key server, or account backend.
- Native desktop wrapper.
- Forward secrecy.
- Resume for interrupted file operations.
- In-app document rendering for unsupported files.
- Bespoke visual assets or brand-font work beyond the approved local
  system-font rules in `apple-visual-spec.md`.

## 6. Product claims

The product may claim only the following, and only in plain language:

- Encrypts on this device.
- Does not create an online account.
- Uses a public contact and a private recovery card model.
- Keeps no analytics or telemetry.
- Supports local-only identity persistence through encrypted vault storage if the user explicitly chooses to remember the identity.
- Uses a backend-free static deployment for the beta release.

The product must not claim:

- Quantum-proof security.
- Unbreakable security.
- Forward secrecy.
- Message history.
- Guaranteed secure deletion.
- Verified identity without user review.

## 7. Release levels

### 7.1 Local draft

- Used for implementation and manual review.
- May run from a local file server or dev server.
- Must still respect the same functional behavior and warnings.

### 7.2 Public beta

- Deployed as a static GitHub Pages site.
- No backend, analytics, or telemetry.
- A candidate may be shared for external review, but public-beta deployment waits for independent review clearance.
- Requires the release and testing contract in the related docs before broad promotion.

### 7.3 Future production

- Not part of v1.
- Any move beyond public beta requires fresh security review and explicit approval.

## 8. Identity model

- The required pseudonym is public and nonunique.
- It must be normalized to UTF-8 and limited to `1..48` bytes after normalization.
- The recommended pseudonym is a fictional, recognizable name, not a real name.
- User copy must use the terms `identity`, `public contact`, `private recovery card`, `encrypted text`, and `encrypted file`.
- User copy must never use `seed card` or `account` for these concepts.

## 9. Required user experience

- The app starts on Create identity / Import identity.
- When the user is ready to work, the first functional destination is Encrypt.
- Mobile uses bottom navigation.
- Desktop uses a left rail.
- The navigation items are Encrypt, Decrypt, Contacts, Identity, and Help.
- Public contact display must show the pseudonym above the QR code.
- The private recovery material must always be warned as dangerous.
- The user must export recovery material before finishing identity setup.
- The user must be asked separately whether to remember the private identity locally.
- If storage is unavailable, the app must fall back to session-only mode automatically.

## 10. Data handling requirements

- No message history is stored.
- Contacts persist by default unless the user chooses session-only mode or deletes them.
- Local nicknames are allowed and private to the device.
- Importing the same key again is idempotent and should merge rather than duplicate.
- The same pseudonym with different keys must remain separate and must warn about collision risk.
- Unknown-sender decrypts are allowed if the payload is cryptographically valid, with an explicit unknown-sender warning.
- Manual identity replacement only; no automatic swapping of the active identity.

## 11. Media and file behavior

- Images may preview inline only after full authentication.
- Audio and video may preview only after full authentication and must stay contained in an approximately half-workspace player with normal controls.
- The user must press play for media playback.
- Manual fullscreen is allowed.
- Documents and unsupported media must offer safe download only.

## 12. Update and offline behavior

- After a deployed version changes, the app must prompt: `A newer version is available.`
- Never reload mid-operation or while unlocked/decrypted content is visible.
- After the first successful load, the app should remain usable offline as long as the browser retains the app shell and versioned assets.
- If storage is unavailable, the current loaded session must continue to work, but future offline reload is not guaranteed.

## 13. Privacy and diagnostics

- No analytics.
- No telemetry.
- No remote crash reporting.
- Sanitized diagnostics are built locally.
- The user must review diagnostics before a GitHub issue draft is opened.
- The app must never auto-submit an issue.

## 14. Acceptance

The product spec is satisfied only if all of the following are true:

- The docs package and the implementation agree on terminology and user-visible claims.
- Every required flow can be completed without a backend.
- English and German launch content are complete.
- Recovery export is mandatory before finish.
- Session-only mode is available and works when persistent storage is denied.
- The app remains static-host compatible and does not depend on an account service.
- The visual layer remains unconstrained by this spec except where semantic states and responsive behavior are required.
