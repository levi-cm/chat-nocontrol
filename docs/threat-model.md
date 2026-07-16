> **Authority:** Chat NoControl documentation authority; this file normatively defines the threat model for PPX Protocol v1.
> **Version:** 1.0-draft
> **Status:** Public beta channel / stable release unavailable / operational status is external
> **Depends on:** [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [../Chat_NoControl_full_plan.md](../Chat_NoControl_full_plan.md), [product-spec.md](product-spec.md), [design-spec.md](design-spec.md), [ux-content-spec.md](ux-content-spec.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# PPX Threat Model

## 1. Scope

This threat model covers the browser application, the PPX protocol objects, local storage, QR import/export, clipboard interactions, file handling, and the user-visible identity workflow.

The model is for Chat NoControl as a product and PPX as the protocol. It is not a claim about the security of every possible browser, operating system, extension, or deployment.

### 1.1 Optional compact message-QR boundary

Ordinary PPXT is the primary message format and PPXQ creation defaults off.
Enabling the optional output changes no cryptographic rule. PPXQ protects
message content with the same hybrid encryption and sender signature as text
messages, but requires an exact pre-saved sender contact. Receiving remains
available while creation is disabled.

Attacker-controlled QR text, URLs, screenshots, gzip members, and claimed
lengths are untrusted. Parsing and allocation are bounded; authentication,
sender lookup, recipient binding, signature, decompression, length, and UTF-8
must all succeed before plaintext. Ciphertext length still leaks coarse size and
compression information. Fragments are transient and immediately scrubbed.

## 2. Assets

Protected assets:

- Master entropy
- Vault passphrase
- Plaintext browser-vault password while the identity wizard is open and on the private recovery document
- Private keys
- Recovery object content
- Plaintext messages
- Plaintext files
- Sender and recipient identity continuity
- Local contact list integrity

Public assets:

- PPXC public contacts
- Pseudonyms
- Fingerprints
- Armor text
- Object checksums

## 3. Assumed attacker capabilities

Version 1 assumes an attacker may have one or more of these capabilities:

- Observe network traffic metadata.
- Store ciphertext for later cryptanalysis.
- Substitute the first contact seen by a user.
- Compromise the deployment and serve modified JavaScript.
- Compromise the browser, operating system, or an installed extension.
- Read clipboard contents.
- Capture screenshots or screen recordings.
- Cause storage eviction or local database loss.
- Use unaudited implementation side channels.
- Interact with a user through social engineering.

## 4. Protected against

Version 1 is intended to protect against:

- A chat provider or file host reading message or file contents.
- Passive interception of encrypted objects.
- Object corruption in transit.
- Simple tampering with object bytes.
- Classical impersonation after the recipient has a verified sender contact.
- Accidental disclosure from incomplete QR or armored text transfers.
- Casual local theft of encrypted vault data when the passphrase is strong.

## 5. Not protected against

Version 1 is not intended to protect against:

- Malware.
- A compromised operating system.
- Malicious browser extensions.
- Compromised keyboards.
- Clipboard monitoring.
- Screenshots.
- Screen recording.
- A compromised deployment serving altered code.
- Traffic metadata, including who talked to whom, when, where, and how much.
- File size, object size, and message length leakage.
- First-contact substitution before verification.
- Loss of both recovery material and the remembered vault passphrase.
- Forward secrecy or ratcheting.
- Post-compromise secrecy for previously recorded traffic.
- Guaranteed secure deletion in JavaScript memory.

## 6. Threats by workflow

### 6.1 Identity creation

Threats:

- Weak RNG or RNG failure.
- User confusion between a public contact and a private recovery object.
- User confusion among QR, `.ppxrecovery`, recovery code, recovery words, recovery document, and the separately encrypted browser vault.
- Secret redisplay through scrolling or Back navigation after the user claims to have stored recovery material.
- Plaintext password leakage into storage, logs, QR/PPXR artifacts, or global UI state.
- Display-label impersonation.

Mitigations:

- Derive identity from 32 bytes of CSPRNG entropy.
- Show the short identity ID with the username; `Username` remains UI terminology mapped to the protocol pseudonym.
- Keep the pseudonym out of the fingerprint.
- Make recovery objects visually dangerous.
- Use a seven-screen state machine that clears the password, words, recovery code, QR presentation, and print model after the recovery-document step and cannot recreate them through Back navigation.
- Require both QR PNG and `.ppxrecovery` downloads with safe-storage attestations, plus separate confirmations for all 24 handwritten words and a safely stored downloaded PDF.
- Require practice restoring the pending identity from QR, then `.ppxrecovery`, then four random word positions; unlimited retries avoid lockout, and restart is offered after ten failures.
- Permit the confirmed expert skip to bypass only restore practice, never backup gates.
- Render the plaintext vault password only in the private A4 print/PDF and never persist or serialize it into QR/PPXR artifacts.

### 6.2 Contact exchange

Threats:

- First-contact substitution.
- QR transcription mistakes.
- Copy/paste corruption.

Mitigations:

- Use checksums for transfer damage.
- Require public fingerprint verification through a trusted channel.
- Keep object parsing strict and reject malformed encodings.

### 6.3 Text messaging

Threats:

- Passive ciphertext storage.
- Sender impersonation.
- Outer metadata exposure.

Mitigations:

- ML-KEM-512 plus X25519 hybrid confidentiality.
- Inner sender PPXC contact for signature validation.
- Ed25519 signatures over the signed inner payload.
- Omit stable sender metadata from the outer object when possible.

### 6.4 File transfer

Threats:

- Large-file memory exhaustion.
- Partial download misuse.
- Tampering with individual chunks.

Mitigations:

- Chunk files at `1048576` bytes.
- Authenticate each chunk.
- Withhold preview and download until the full manifest, digest, and signature validate.
- Keep processing in a worker and bound memory with `Blob.slice`.

### 6.5 Vault storage

Threats:

- Password guessing.
- Local database theft.
- Storage corruption.
- User confusion about what is encrypted.

Mitigations:

- Use scrypt with `N = 65536`, `r = 8`, `p = 2`.
- Store only encrypted vaults in persistent local storage.
- Recommend and preselect encrypted IndexedDB storage, but do not write the vault before the user's explicit final confirmation; offer session-only and fall back to it when persistence is unavailable.
- Return a generic wrong-passphrase-or-corruption error.
- Never store plaintext identities in long-term storage.
- Keep logged-in PPXV QR and file exports absent from the DOM until the user
  re-enters the vault password. Reset that export authorization on route leave,
  lock, or background, and zeroize the verification identity after comparing
  its fingerprint with the active identity.

## 7. Explicit user-facing warnings

The product must communicate these facts plainly:

- Encrypts on this device and does not create an online account.
- A username is only a label and maps to the PPX pseudonym field.
- The danger-styled private recovery QR/PPXR, recovery code, 24 English words, and recovery document are equivalent ways to regain the identity. The remembered PPXV vault is a separate encrypted convenience copy.
- The recovery document also contains the exact plaintext browser-vault password and must never be shared; that password is not required for QR, PPXR, or word recovery.
- A public fingerprint must be verified through a trusted channel before authenticity is trusted.
- Losing every recovery copy and access to the remembered browser vault permanently prevents identity recovery and message decryption.
- The protocol hides content, not metadata.
- Version 1 combines post-quantum ML-KEM-512 and classical X25519 confidentiality, with classical Ed25519 sender authentication.

## 8. Residual risks

Residual risks are accepted by design:

- Metadata exposure.
- Compromised endpoints.
- Side-channel limitations.
- Browser engine memory copies.
- Human verification mistakes.
- Untrusted transport channels.

These risks are not implementation defects if the documented warnings and validation rules are preserved.

## 9. Release and review posture

Because the implementation is custom public-beta software with no stable-security claim:

- Security claims must stay narrow and literal.
- The repository remains private until an approved public-beta candidate satisfies every release gate and receives explicit sign-off.
- Release-specific independent review evidence is required for every public-beta release.
- External review and explicit approval are required before any stronger marketing claim.
- Any future protocol extension must re-evaluate the threat model and the object formats.

## 10. Cross references

- [protocol-v1.md](protocol-v1.md)
- [security-architecture.md](security-architecture.md)
- [product-spec.md](product-spec.md)
- [design-spec.md](design-spec.md)
- [ux-content-spec.md](ux-content-spec.md)
- [testing-and-release.md](testing-and-release.md)
- [references.md](references.md)
