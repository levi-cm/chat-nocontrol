> **Authority:** Highest normative authority for Chat NoControl v1.
> **Version:** 1.0-draft
> **Status:** Public beta channel / stable release unavailable / operational status is external
> **Last verified:** 2026-07-13
> **Depends on:** [README.md](README.md), [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), [docs/product-spec.md](docs/product-spec.md), [docs/protocol-v1.md](docs/protocol-v1.md), [docs/security-architecture.md](docs/security-architecture.md), [docs/threat-model.md](docs/threat-model.md), [docs/design-spec.md](docs/design-spec.md), [docs/apple-visual-spec.md](docs/apple-visual-spec.md), [docs/ux-content-spec.md](docs/ux-content-spec.md), [docs/accessibility-i18n.md](docs/accessibility-i18n.md), [docs/user-guide.en.md](docs/user-guide.en.md), [docs/user-guide.de.md](docs/user-guide.de.md), [docs/testing-and-release.md](docs/testing-and-release.md), [docs/github-pages-deployment.md](docs/github-pages-deployment.md), [docs/references.md](docs/references.md)
> **Supersedes:** The original WebLibre plan is historical only. This document is the active v1 master; the historical plan remains archive context, not an operating specification.

# Chat NoControl Master Specification

## 1. Authority and hierarchy

This file is the master specification for Chat NoControl v1. It resolves product-level requirements and combines the existing topic docs into one self-contained source of truth for the v1 docs package.

Conflict rule:

- This master controls product requirements and release intent.
- `docs/protocol-v1.md` controls byte layout, object families, canonical serialization, and exact protocol constants.
- `docs/security-architecture.md` controls cryptographic boundaries, provider interfaces, and key-derivation behavior.
- `docs/ux-content-spec.md` controls user-visible copy and localized wording.
- `docs/design-spec.md` controls semantic flow, storage behavior, and responsive state rules; `docs/apple-visual-spec.md` controls the approved visual system.
- `docs/accessibility-i18n.md` controls accessibility and localization requirements.
- `docs/testing-and-release.md` controls test coverage and release gates.
- `docs/github-pages-deployment.md` controls the static hosting contract and CSP limits.
- Any inconsistency between these docs is a release blocker. Never silently choose one interpretation and move on.

This repository contains the static Preact implementation and the normative v1
documentation. A local or committed build is not a deployment claim: public
beta publication still requires the complete release gates, traceable commit,
signed tag, and GitHub Pages deployment evidence.

## 2. Executive summary

Chat NoControl is a calm, static, browser-first privacy tool with a satirical name and a serious interface. It is designed for public-contact exchange, one active local identity at a time, encrypted text, encrypted files, and local recovery. It has no backend, no relay, no key server, no account system, no telemetry, and no cloud sync.

The protocol family is PPX. Version 1 is a local-first public beta target with strict parsing, narrow security claims, and mandatory warnings around dangerous recovery material. It supports English and German at launch. It is intended for GitHub Pages hosting as a static site and for offline reuse of versioned assets after first load.

The product deliberately separates public contact material from private recovery material. A public contact is safe to share. A private recovery card, a PPXV vault, and the 24 recovery words are dangerous secrets. The UI must make that distinction obvious in copy, behavior, and visual semantics.

## 3. Goals, audience, and success

### 3.1 Audience

- Everyday users who want practical privacy for text and files.
- People who want a portable public contact and a private recovery path without creating an account.
- Mobile-first users, while still giving desktop users a complete client-like experience.
- Users who need English and German at launch.

### 3.2 Goals

- Create, import, export, and manage one active identity locally.
- Exchange one public contact per person and encrypt to one recipient per output.
- Encrypt and decrypt text and files locally without a server.
- Keep private material off the network and out of analytics or telemetry.
- Provide clear help that explains the security limits without hype.
- Support offline use after the first successful load, as long as the browser keeps the app shell and versioned assets.

### 3.3 Success criteria

- A first-time user can create or import an identity, export the mandatory recovery material, and reach Encrypt without ambiguity.
- A user can encrypt and decrypt text and files on mobile and desktop without leaving the browser.
- Public contacts and private recovery material remain visually and semantically distinct.
- The app works as a static GitHub Pages beta with no backend dependency.
- English and German remain semantically aligned.
- The product never needs analytics, telemetry, remote scripts, a key server, a relay, or cloud sync.

### 3.4 Deferred features

The following are explicitly out of scope for v1:

- Message history.
- Multiple identity management.
- Group messaging or bundled messaging.
- Relay, cloud sync, or server-side key directory.
- Account model.
- Native desktop wrapper.
- Forward secrecy.
- Ratcheting.
- Resume for interrupted file operations.
- In-app document rendering for unsupported files.
- Bespoke illustration, decorative asset, or brand-font work beyond the approved
  local system-font Apple-inspired visual specification.
- Any claim of stable production security before independent review.

## 4. Product definition and claims

### 4.1 Brand and voice

- Product brand: `Chat NoControl`
- Protocol family: `PPX`, short for `Portable Private Exchange`
- Protocol version: `1`
- Suite identifier: `PPX-HYBRID-1`
- Suite byte: `0x01`

The brand name is satirical. The interface is not. The interface voice must remain calm, plain, and trustworthy.

Use these product terms in user copy:

- `identity`
- `public contact`
- `private recovery card`
- `encrypted text`
- `encrypted file`

Do not use `account` or `seed card` for these concepts in user-visible copy. Do not use `WebLibre` except when referring to the historical archive plan.

### 4.2 Exact claims

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
- Signal-equivalent security.
- Forward secrecy.
- Message history.
- Guaranteed secure deletion.
- Verified identity without user review.
- Stable production security without independent review.

### 4.3 Non-negotiables

- One active identity at a time.
- One recipient per encrypted output.
- Public contacts persist by default unless the user chooses session-only mode or deletes them.
- Session-only mode must exist and must work when storage is unavailable or denied.
- Recovery export is mandatory before identity setup can finish.
- The public/private distinction must be obvious without hover or color alone.
- The app must never auto-submit diagnostics.
- No backend, no relay, no key server, no account service, no telemetry, no remote fonts, no remote scripts, no remote images, no crash reporting.
- Never silently relax a parsing, length, checksum, or authentication rule.

## 5. Threat boundaries and user warnings

### 5.1 Threat boundary

Version 1 assumes the attacker may be able to:

- Observe network traffic metadata.
- Store ciphertext for later cryptanalysis.
- Substitute the first contact seen by a user.
- Compromise the deployment and serve modified JavaScript.
- Compromise the browser, operating system, or an installed extension.
- Read clipboard contents.
- Capture screenshots or screen recordings.
- Cause storage eviction or local database loss.
- Exploit unaudited implementation side channels.
- Interact with the user through social engineering.

### 5.2 Protected against

Version 1 is intended to protect against:

- A chat provider or file host reading message or file contents.
- Passive interception of encrypted objects.
- Object corruption in transit.
- Simple tampering with object bytes.
- Classical impersonation after the recipient has a verified sender contact.
- Accidental disclosure from incomplete QR or armored text transfers.
- Casual local theft of encrypted vault data when the passphrase is strong.

### 5.3 Not protected against

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

### 5.4 User-facing warnings

These warnings are normative and must be communicated plainly:

- A pseudonym is public and not a secret.
- A public contact is safe to share, but its fingerprint should be verified through a trusted channel when authenticity matters.
- The private recovery card is dangerous. Anyone who gets it can recover the private identity.
- The 24 recovery words are just as sensitive as the private recovery card.
- Losing private identity material and recovery material permanently loses access.
- The protocol hides content, not metadata.
- Version 1 combines ML-KEM-512 and classical X25519 confidentiality with classical Ed25519 sender authentication.

## 6. Identity and recovery model

### 6.1 Master entropy

An identity starts from exactly 32 bytes of master entropy generated by the browser CSPRNG.

The master entropy is the only root secret for the identity. Timestamps, usernames, device identifiers, cursor motion, and user-entered words do not contribute to the identity root.

### 6.2 Pseudonym rules

The pseudonym is a display label, not a cryptographic secret.

Normalization and validation:

- Normalize with Unicode NFKC.
- Trim leading and trailing Unicode whitespace.
- Reject control characters.
- Reject bidi overrides.
- Reject Unicode line separators.
- Reject null bytes.
- Require 1 to 48 UTF-8 bytes after normalization and trimming.

Consequences:

- The pseudonym is excluded from the identity fingerprint.
- The pseudonym is excluded from key-derivation inputs that define the public identity.
- The same pseudonym with different keys must remain separate.
- Repeat import of the same key must merge rather than duplicate.
- A collision warning must be shown when the same pseudonym appears with a different key.
- The pseudonym is public and nonunique.
- The recommended pseudonym is fictional and recognizable, not a real name.

### 6.3 Domain-separated key derivation

Use HKDF-SHA-512 with exact ASCII labels. These labels are protocol constants and must not be renamed or re-cased.

Salt:

```text
SHA-512(UTF8("PPX/IDENTITY/V1/SALT")) -> 64 bytes
```

Derived outputs:

```text
PPX/IDENTITY/V1/ML-KEM-512/KEYGEN-SEED   -> 64 bytes
PPX/IDENTITY/V1/X25519/RECEIVE-SECRET    -> 32 bytes
PPX/IDENTITY/V1/ED25519/SIGNING-SEED     -> 32 bytes
PPX/IDENTITY/V1/HISTORY-KEY              -> 32 bytes
```

The history key is for local encrypted metadata only. It is not part of protocol identity or message authentication.

### 6.4 Fingerprint and identity ID

Identity fingerprint:

```text
fingerprint = SHA-512(
  "PPX/IDENTITY/V1/FINGERPRINT" ||
  suiteByte ||
  kemPublicKey ||
  x25519PublicKey ||
  signingPublicKey
)[0..32]
```

Identity ID:

```text
identityId = fingerprint[0..20]
```

The fingerprint excludes the pseudonym and creation time. The pseudonym is a local presentation field only.

### 6.5 Recovery words

The exact 32 bytes of master entropy also have a BIP39 English 24-word reversible representation.

Rules for recovery words:

- Use BIP39 `entropyToMnemonic` and `mnemonicToEntropy` with the English word list and checksum.
- Normalize mnemonic text with BIP39 NFKD, lowercase canonical text, and single ASCII spaces for display and import.
- Reject anything that is not exactly 24 valid English words.
- Reject any checksum-invalid mnemonic.
- Never use BIP39 mnemonic-to-seed PBKDF2 for PPX keys.
- Never mix words or user data into entropy.

Recovery words are private and have authority equivalent to `PPXR`.

Words alone restore the keys and fingerprint, but they do not restore the public pseudonym or the original creation time.

On word import, the user must choose or re-enter a valid pseudonym in the 1..48 UTF-8 byte range after normalization.

The implementation then creates a new signed `PPXC` for the same fingerprint.

The import time is local metadata only and must not be presented as the original creation time.

## 7. PPX object families and validation

### 7.1 Family overview

Version 1 defines five object families and one suite byte.

| Family | Magic | Format version | Suite byte | File extension | MIME type |
|---|---|---:|---:|---|---|
| Public contact | `PPXC` | `0x01` | `0x01` | `.ppxcontact` | `application/x-ppx-contact` |
| Locked vault | `PPXV` | `0x01` | `0x01` | `.ppxvault` | `application/x-ppx-vault` |
| Unencrypted recovery | `PPXR` | `0x01` | `0x01` | `.ppxrecovery` | `application/x-ppx-recovery` |
| Encrypted text | `PPXT` | `0x01` | `0x01` | `.ppxmessage` | `application/x-ppx-message` |
| Encrypted file | `PPXF` | `0x01` | `0x01` | `.ppxfile` | `application/x-ppx-file` |

These MIME values are unregistered private values. They are hints for local handling only.

The protocol also defines the BIP39 English 24-word recovery representation for master entropy, but it is not a PPX object family.

### 7.2 Validation rules

Parsers must reject:

- Unknown format versions.
- Unknown suite bytes.
- Unknown mandatory flags.
- Impossible lengths.
- Duplicate fields.
- Trailing bytes.
- Noncanonical text encodings.
- Oversize objects before allocation.

Validation order is strict:

1. Read enough bytes to identify magic, version, suite, and length fields.
2. Reject impossible sizes before allocation.
3. Reject unknown versions, suites, or flags.
4. Parse canonical text and lengths.
5. Verify checksums.
6. Verify AEAD or signatures.

Checksums detect transfer damage only. Security comes from AEAD and signatures, not from checksums.

## 8. Public contact object `PPXC`

`PPXC` is the compact public contact object and the QR payload for a public identity.

### 8.1 Layout

Maximum size: `1008` bytes.

| Offset | Length | Field |
|---:|---:|---|
| 0 | 4 | ASCII magic `PPXC` |
| 4 | 1 | Format version `0x01` |
| 5 | 1 | Suite byte `0x01` |
| 6 | 1 | Flags, exactly `0x00` |
| 7 | 1 | Pseudonym UTF-8 length `1..48` |
| 8 | 8 | Creation time, Unix seconds, big-endian |
| 16 | 800 | ML-KEM-512 public key |
| 816 | 32 | X25519 public key |
| 848 | 32 | Ed25519 public key |
| 880 | N | Normalized pseudonym UTF-8 bytes |
| 880+N | 64 | Ed25519 self-signature |
| 944+N | 16 | `SHA-512(previous bytes)[0..16]` |

The self-signature uses the exact ASCII domain label:

```text
PPX/CONTACT/V1/SIGNATURE
```

The signed byte string is the domain label concatenated with all preceding bytes.

Every `PPXC` reserved flag bit is zero. Parsers must reject any nonzero flags
value.

### 8.2 QR transport

PPXC uses uppercase Base45 text for QR transport.

- Prefix: `PPX1:CONTACT:`
- Encoding: uppercase Base45 without lowercase aliases
- Maximum payload: `1008` bytes -> `1512` Base45 characters
- Prefix plus payload fits inside QR version 40, error correction level H, alphanumeric capacity `1852`

The public contact QR does not need a stable recipient hint beyond the identity data already carried inside `PPXC`.

### 8.3 Semantics

- The public fingerprint is derived only from the suite byte and all three public keys.
- The first 20 bytes of the fingerprint are the short identity ID displayed in the UI.
- The pseudonym is public, not unique, and never part of the fingerprint.
- The public contact is the normal sharing artifact for other people to encrypt to you.

## 9. Locked vault object `PPXV`

`PPXV` stores encrypted identity material for optional local persistence.

### 9.1 Vault policy

- The vault is encrypted.
- The vault is the only representation suitable for long-term local storage.
- The vault parameters are encoded in the object.
- The vault requires a user passphrase.
- Passphrases accept 1 to 256 UTF-8 bytes. The UI must not block a weak but non-empty passphrase.
- A local, deterministic strength estimate updates while the user types. It is red below 50 estimated bits, orange from 50 to 99 bits, and green from 100 bits. Text labels accompany color.
- The recommended guidance remains a longer, uncommon passphrase or multiple random words.
- The vault unlock failure must collapse wrong passphrase and corruption into one generic error.

QR transport for vault export uses uppercase Base45 with the exact prefix:

- `PPX1:PRIVATE:`

### 9.2 Outer structure

| Field | Length |
|---|---:|
| Magic `PPXV` | 4 |
| Format version | 1 |
| Suite byte | 1 |
| Flags, exactly `0x01` | 1 |
| KDF id `0x01` for scrypt | 1 |
| `N` | 8 |
| `r` | 4 |
| `p` | 4 |
| Salt | 16 |
| AES-GCM nonce | 12 |
| Ciphertext length | 4 |
| Ciphertext including tag | variable |
| Outer checksum | 16 |

The `PPXV` flags byte is exactly `0x01`: bit 0 declares an encrypted private
identity vault and every reserved bit is zero. Parsers must reject every other
flags value.

### 9.3 KDF and encryption

Vault KDF:

- `scrypt`
- `N = 65536`
- `r = 8`
- `p = 2`
- Salt length: `16` bytes

Vault encryption:

- AES-256-GCM
- Nonce length: `12` bytes

### 9.4 Inner plaintext

The encrypted inner vault has this exact plaintext layout before the AES-GCM
tag is added:

| Offset | Length | Field |
|---:|---:|---|
| 0 | 32 | Master entropy |
| 32 | 8 | Creation time, Unix seconds, big-endian |
| 40 | 1 | Pseudonym UTF-8 length `1..48` |
| 41 | N | Canonical normalized pseudonym UTF-8 bytes |

On unlock failure the implementation returns a generic wrong-passphrase-or-corruption error.

## 10. Recovery object `PPXR`

`PPXR` is an explicitly dangerous recovery representation.

Maximum size: `112` bytes.

| Offset | Length | Field |
|---:|---:|---|
| 0 | 4 | ASCII magic `PPXR` |
| 4 | 1 | Format version, exactly `0x01` |
| 5 | 1 | Suite byte, exactly `0x01` |
| 6 | 1 | Flags, exactly `0x00` |
| 7 | 1 | Pseudonym UTF-8 length `1..48` |
| 8 | 8 | Creation time, Unix seconds, big-endian |
| 16 | 32 | Master entropy in the clear |
| 48 | N | Canonical normalized pseudonym UTF-8 bytes |
| 48+N | 16 | `SHA-512(previous bytes)[0..16]` |

Every `PPXR` reserved flag bit is zero. Parsers must reject any nonzero flags
value before consuming the secret payload.

`PPXR` exists only for controlled recovery workflows and must be visually and textually dangerous in the UI and the documentation.

QR transport for recovery export uses uppercase Base45 with the exact prefix:

- `PPX1:RECOVERY:`

## 11. Encrypted text object `PPXT`

`PPXT` carries encrypted text messages up to `262144` UTF-8 bytes of plaintext.

### 11.1 Outer structure

The outer object exposes only:

- Format and suite
- ML-KEM ciphertext: `768` bytes
- Ephemeral X25519 public key: `32` bytes
- Salt: `32` bytes
- Nonce: `12` bytes
- Ciphertext length
- Checksum

Version 1 carries no stable recipient hint in the outer object. Recipient identity binding lives in the encrypted inner data and in cryptographic AAD. Version 1 assumes one active local identity and returns a generic wrong-identity-or-corruption failure on decryption failure.

### 11.2 Inner plaintext

The encrypted and signed inner payload includes:

- Sender `PPXC` contact
- Recipient ID
- Timestamps
- Message ID
- Plaintext text
- Ed25519 signature

Always embed the sender `PPXC` contact inside the encrypted content. This allows signature validation even when the outer envelope has no sender metadata.

The exact signature domain label is:

```text
PPX/TEXT/V1/SIGNATURE
```

The signed byte string is the canonical inner payload prefixed by that domain label.

### 11.3 Armor

Armored text uses these exact markers:

```text
-----BEGIN PPX ENCRYPTED TEXT-----
-----END PPX ENCRYPTED TEXT-----
```

Armored headers:

- `Version`
- `Suite`
- `Bytes`
- `Digest`

Body rules:

- Base64url without padding
- 72-character wrapping
- No alternative armor labels

## 12. Encrypted file object `PPXF`

`PPXF` carries one arbitrary file and a caption string. The caption field is always serialized; the empty string means absent.

### 12.1 Payload limits

- File count: exactly one
- File size: `0..104857600` bytes
- Caption string: required on the wire; normalized content is `0..16384` UTF-8 bytes; the empty string means absent
- Filename metadata after normalization and sanitization: at most `255` UTF-8 bytes
- MIME hint: at most `127` ASCII bytes
- Chunk size: `1048576` bytes

The MIME hint is untrusted and advisory only.

### 12.2 Canonical header

All integers are unsigned big-endian. The fixed canonical header is 884 bytes:

| Order | Field | Bytes |
| ---: | --- | ---: |
| 1 | ASCII `PPXF` | 4 |
| 2 | Format version | 1 |
| 3 | Suite | 1 |
| 4 | Flags, exactly zero | 2 |
| 5 | Recipient ID | 20 |
| 6 | ML-KEM-512 ciphertext | 768 |
| 7 | Ephemeral X25519 public key | 32 |
| 8 | Nonce prefix | 8 |
| 9 | Salt | 32 |
| 10 | Declared chunk count | 4 |
| 11 | Chunk size, exactly `1048576` | 4 |
| 12 | Total file length | 8 |

The declared chunk count equals `ceil(totalFileLength / 1048576)`; a zero-byte
file has zero data records. Filename, MIME hint, caption, sender contact,
digest, and signature appear only inside the encrypted terminal manifest.

### 12.3 Chunking and worker execution

Files are processed in `1048576`-byte chunks.

- Each chunk is independently authenticated with AES-GCM.
- Chunk processing runs in a worker.
- No preview or download is allowed before all chunks, the final manifest, the digest, and the signature validate.

### 12.4 Nonce and record structure

Nonce construction:

- Random 8-byte per-file prefix
- Big-endian 32-bit chunk index

The terminal manifest uses reserved chunk index `0xffffffff`.

Each chunk record includes:

- Chunk index: 4 bytes
- Plaintext length: 4 bytes
- Ciphertext length: 4 bytes
- Ciphertext plus 16-byte tag: the declared ciphertext length

For data records, ciphertext length equals plaintext length plus 16. Data
indexes are contiguous from zero and strictly ordered. The encrypted terminal
record is last, uses `0xffffffff`, and no record may follow it.

### 12.5 AAD and manifest

AAD binds:

- Hash of the immutable outer header
- Chunk index
- Plaintext length
- Declared chunk count
- Total file length

The encrypted terminal manifest contains:

- Sender `PPXC` contact
- Recipient ID
- Filename
- MIME hint
- Caption
- File length
- `SHA-512` digest of the full plaintext file
- Chunk count
- Ed25519 signature over an exact domain-separated commitment

The exact manifest-signing domain label is:

```text
PPX/FILE/V1/MANIFEST-SIGNATURE
```

The signed byte string is the canonical manifest commitment prefixed by that domain label.

The canonical manifest plaintext is capped at 18000 bytes before AEAD
allocation. It is encrypted using the terminal record nonce and the same AAD
shape as a data record.

### 12.6 Trailing checksum

The final 16 bytes are exactly:

```text
SHA-512(canonicalHeader || allCanonicalDataRecords || canonicalTerminalRecord)[0..16)
```

The checksum is verified before hybrid decapsulation or AEAD. It detects
transfer damage only; record AEAD and the manifest signature provide security.

### 12.7 Memory and interruption policy

The implementation should keep JavaScript memory bounded by using `Blob.slice` for input and `Blob` composition for output.

WebCrypto is buffer-based, so the implementation must still avoid retaining unnecessary copies in application state.

Progress and cancel are supported. An interrupted file operation restarts from the beginning after interruption.

## 13. Cryptography and hybrid secret derivation

### 13.1 Security claims

Version 1 claims:

- Hybrid confidentiality from ML-KEM-512 and classical X25519.
- Classical sender authentication from Ed25519.
- AES-256-GCM content integrity and confidentiality.
- Strict local parsing with explicit length and version checks.

Version 1 does not claim:

- Post-quantum signatures.
- Forward secrecy.
- A continuous ratchet.
- Quantum-proof security.
- Signal-equivalent security.

### 13.2 Primitive set

The required primitives are:

- SHA-512
- HKDF-SHA-512
- scrypt
- ML-KEM-512
- X25519
- Ed25519
- AES-256-GCM

### 13.3 Hybrid encryption architecture

The sender uses:

- Recipient ML-KEM-512 public key
- Recipient static X25519 public key
- Sender ephemeral X25519 key pair generated per item
- A random 32-byte salt

The sender computes:

- `mlkemShared`
- `x25519Shared`

Then combines them as:

```text
IKM = mlkemShared || x25519Shared
```

Key derivation:

```text
info = "PPX/ENCRYPT/V1/HYBRID" ||
       suiteByte ||
       recipientFingerprint ||
       SHA-512(mlKemCiphertext || ephemeralX25519PublicKey)

aes256Key = HKDF-SHA-512(IKM, salt, info, 32)
```

This is a custom hybrid suite. It requires external cryptographic review before the current public beta or any later security-sensitive public release.

### 13.4 AEAD

AES-256-GCM protects the text or file payload.

- Key length: 32 bytes
- Nonce length: 12 bytes unless a format-specific nonce construction is explicitly defined
- Tag length: 16 bytes

Associated data must bind the immutable outer header and any fields needed to prevent replay between incompatible objects.

### 13.5 Sender authentication

Sender authentication remains classical Ed25519.

Mandatory rule:

- The sender `PPXC` contact must be embedded inside the encrypted content.

Reason:

- A recipient can validate a sender signature even when the outer envelope does not expose sender metadata.
- Unknown-sender workflows can still authenticate the sender after decryption.

### 13.6 Error model

Parsing and cryptographic operations must distinguish structural failure from authentication failure without revealing extra detail to attackers.

Required error classes:

```ts
export type PPXParseError =
  | 'unknown-format-version'
  | 'unknown-suite'
  | 'unknown-flags'
  | 'impossible-length'
  | 'duplicate-field'
  | 'trailing-bytes'
  | 'noncanonical-text'
  | 'oversize-before-allocation'
  | 'checksum-mismatch';

export type PPXCryptoError =
  | 'wrong-identity-or-corruption'
  | 'wrong-passphrase-or-corruption'
  | 'invalid-aead'
  | 'invalid-signature'
  | 'invalid-hybrid-encapsulation'
  | 'invalid-passphrase'
  | 'corrupted-vault';
```

The user-facing vault unlock failure must collapse passphrase and corruption into a single generic message.

### 13.7 Zeroization and side-channel policy

Zeroization must be best effort only.

Required policy:

- Wipe byte arrays after use when the runtime allows it.
- Never assume JavaScript memory is fully scrubbed.
- Never claim constant-time behavior from a high-level runtime unless the primitive library explicitly provides it and the code path can preserve it.
- Treat side-channel resistance as limited and outside the security claim unless a release-specific review explicitly covers it.

## 14. Interfaces and worker contracts

The exact TypeScript shapes live in `docs/protocol-v1.md` and `docs/security-architecture.md`. This master file summarizes their required behavior and the role they play in the architecture.

### 14.1 Security provider interfaces

- `CryptoProvider` owns identity derivation, public contact construction, parsing, text/file encrypt-decrypt, and vault lock-unlock.
- Encryption requests carry only a request-owned `SenderSigningCapability`; the
  capability fingerprint and signing public key must match the public sender.
- `CryptoProvider.createHybridEncapsulation` accepts only the recipient
  fingerprint, ML-KEM public key, and X25519 public key. It owns fresh
  ephemeral generation, encapsulation, salt generation, key derivation, and
  secret cleanup.
- `RecoveryWordCodec` owns the reversible 32-byte entropy <-> 24-word BIP39 English mapping.
- UI code and storage code must not call concrete cryptographic library functions directly.
- The provider interface is mandatory so that the implementation can swap crypto backends without changing protocol objects.

### 14.2 Core data types

- `DerivedIdentity` contains creation time, the root secret, derived public keys, derived secret keys, fingerprint, identity ID, and normalized pseudonym.
- `PublicContact` contains the public contact fields, signature, checksum, fingerprint, and identity ID.
- `LockedVaultObject` contains the encrypted identity vault material.
- `RecoveryObject` contains the dangerous cleartext recovery material.
- `EncryptedTextObject` and `DecryptedTextOutput` describe text encryption and decryption results.
- `EncryptedFileObject` describes the canonical PPXF wire object. `EncryptedFileBlobOutput` is the bounded-memory worker transport for encrypted output, and `DecryptedFileOutput` is released only after full validation. Blob transport does not change the wire format.
- `FileHeader`, `ChunkRecord`, and `FileManifest` define the file object internals.
- `PPXWorkerRequest`, `PPXWorkerEvent`, and `PPXSafeWorkerError` define the only sanctioned main-thread to worker message shapes.

### 14.3 Worker boundary

The worker contracts are the only sanctioned message shapes between the main thread and crypto workers. The implementation must not add ad hoc message kinds without updating the protocol docs.

No completed decrypt event, output `Blob`, preview URL, filename, caption, MIME hint, or downloadable content may be released to the main thread until every chunk AEAD, terminal manifest AEAD, file length, full SHA-512 digest, and Ed25519 signature have succeeded. On any error or cancel, discard partial output and wipe best effort.

## 15. Storage, session, and contact schema behavior

### 15.1 Persistent storage

- Public contacts persist by default.
- Encrypted vault persistence is recommended and preselected during creation, but occurs only after explicit final confirmation.
- Local settings may persist if the browser allows it.
- No plaintext identity, message history, or decrypted file cache may be stored persistently.
- The plaintext browser-vault password must never be persisted, logged, placed in URLs, cached by the service worker, or included in the standalone QR PNG or `.ppxrecovery`.

### 15.2 Session-only mode

- No identity persistence.
- No contact persistence.
- No operation-data persistence.
- Automatic fallback when storage is denied or unavailable.
- Current-session work must continue even if persistence cannot be used.

### 15.3 Erasure and retention

- Delete contact.
- Delete vault.
- Confirmed erase-all.
- Clipboard clearing is best effort after 60 seconds.
- Storage eviction must be warned as a data-loss risk.
- No secure deletion guarantee may be claimed.

### 15.4 Contacts

- Contacts are public records by default.
- Local nicknames are allowed and private to the device.
- There is no stored trust status in v1; trust remains a human verification step, not a database field.
- Importing the same key again merges the entry.
- The same pseudonym with different keys must remain separate until the user verifies which one to keep.
- Contacts can be deleted locally without affecting external files or the identity.

### 15.5 Identity state

- Single active identity only.
- Manual identity replacement only.
- Show active identity information and recovery state.
- Support lock now, delete vault, delete contacts, and confirmed erase-all.

## 16. UX, navigation, onboarding, import, recovery, encrypt, decrypt, media, update, and help

### 16.1 Global navigation

- Mobile uses bottom navigation.
- Desktop uses a left rail.
- Nav items are Encrypt, Decrypt, Contacts, Identity, Help.
- The active destination must always be visibly clear without relying on color alone.
- The app should open on Create identity / Import identity for first-time use.
- When the user is ready to work, Encrypt is the first operational screen.

### 16.2 Identity setup

Creation uses a seven-screen state-machine wizard, not one vertically scrollable secret page:

1. **Username — `30%`:** collect the public, nonunique username, map it to the protocol `pseudonym`, and generate only after validation and explicit action.
2. **Create password — `42%`:** require matching printable-ASCII browser-vault password fields. Internal spaces are allowed, leading/trailing spaces are rejected, and the maximum is `256` bytes. Prepare the encrypted `LockedVaultObject` without persisting it.
3. **Digital backups — `54%`:** require ordinary-click downloads of the branded private QR PNG and `.ppxrecovery`, with separate safe-storage attestations.
4. **Words and recovery document — `66%`:** show the 24 English words, an embedded desktop PDF preview, and one direct one-page A4 PDF Download action. Require both confirmation of handwritten words and confirmation of a safely stored downloaded PDF; the PDF confirmation remains unavailable until download. The document includes the username, localized and ISO creation dates, private recovery QR, full wrapped `PPX1:RECOVERY:...` code, all 24 numbered words, and the exact plaintext browser-vault password.
5. **QR restore practice — `78%`:** teach the cleared-browser import path and verify a saved QR image, camera scan, or pasted recovery code by deriving and comparing the pending identity ID.
6. **File and word restore practice — `90%`:** verify the saved `.ppxrecovery`, then request four stable unique random word positions together. Allow unlimited retries, identify incorrect fields, and offer confirmed restart after ten failures.
7. **Local storage and finish — `100%`:** recommend and preselect encrypted IndexedDB persistence, but write only after explicit confirmation. Session-only is the secondary opt-out and the fallback when persistence is unavailable.

Identity setup and import must support these exact content behaviors:

- First screen: `Create identity or import identity` / `Identität erstellen oder importieren`
- The creation UI uses `Username` / `Benutzername`; protocol data continues to use the `pseudonym` field with no PPX wire-format change.
- Public label warning: the username/pseudonym is public and does not protect the identity.
- The QR, `.ppxrecovery`, recovery code, 24 words, and recovery document are equivalent means of regaining the identity. Losing all recovery copies and browser-vault access permanently prevents identity recovery and message decryption.
- Recovery export uses ordinary click actions and no press-and-hold gesture or typed `EXPORT PRIVATE` / `PRIVAT EXPORTIEREN` phrase.
- The quiet expert skip may skip only restore practice, never downloads or backup attestations.
- After leaving the recovery-document screen, clear its plaintext password, words, recovery code, QR presentation, and print/PDF model; Back must not recreate them.
- The plaintext password appears only in the private A4 recovery print/PDF. It must never be persisted, logged, placed in URLs, included in the standalone QR PNG or `.ppxrecovery`, or exposed to application-wide state.
- The standalone recovery PNG is `1024 x 1280`, places the username and localized `PRIVATE KEY — NEVER SHARE` warning above a dark-red `#7f1d1d` QR, and preserves a four-module quiet zone and high error correction.
- The export surfaces must never resemble the public contact card.

### 16.3 Identity import

Supported import sources:

- Locked `PPXV` vault
- Unencrypted `PPXR` recovery card or `PPXR` QR image
- 24 recovery words

Import behavior:

- Validate the imported material before continuing.
- For words, accept exactly 24 English words.
- Normalize words with BIP39 NFKD and single ASCII spaces.
- Reject anything that is not exactly 24 valid English words with a matching checksum.
- Warn that `PPXR` is unencrypted and dangerous.
- Ask for the vault passphrase when the source is `PPXV`.
- Derive the identity and verify that it matches the imported recovery material.
- If recovery words were used, require the user to choose or re-enter a pseudonym before continuing.
- The import time is local metadata only and is not the original creation time.
- Create a new signed public contact for the same fingerprint.
- Keep public-contact import behavior in Contacts, not in the recovery flow itself.

### 16.4 Share your public contact

- The Identity screen must show the public contact.
- The public contact is shared by QR or file.
- The pseudonym must appear above the QR code.
- The user should be told that the contact is safe to share and is meant for other people to encrypt to them.
- If authenticity matters, the user must be told to verify the public fingerprint through a trusted channel.

### 16.5 Contacts

Flow:

1. Open Contacts.
2. Import a public contact by QR, QR image, or file.
3. Optionally add a local nickname.
4. Open contact details.
5. Delete contact if desired.

Contacts behavior:

- Local nicknames are private to the device.
- Repeat imports of the same key merge.
- Same pseudonym, different key must warn about collision risk.
- Search by pseudonym, nickname, and fingerprint detail.
- The contact details delete action removes only the local public contact and nickname.

### 16.6 Encrypt

Encrypt flow:

1. Select one recipient from searchable contacts.
2. Choose text or file mode.
3. Enforce byte limits before expensive work.
4. Show progress and allow cancel.
5. Offer copy, save, or share where capability detection allows it.
6. Restart file operations from the beginning if interrupted.

Text mode:

- Input label: `Encrypted text`
- Counter label: `Bytes used`
- Limit note: `Maximum plaintext: 256 KiB`
- Capability note: `Copy, save, or share when available`

File mode:

- Input label: `Encrypted file`
- Filename label: `File name`
- Caption label: `Caption`
- Limit note: `Maximum file size: 100 MiB`
- Limit note: `Caption optional, up to 16 KiB`
- Interrupted file operations restart from the beginning.

### 16.7 Decrypt

Decrypt flow:

1. Accept a single smart paste, drop, or file area.
2. Detect armored text or file objects.
3. Route to text or file decrypt.
4. Show safe failure messages first.
5. Reveal sanitized technical details only through an expander.
6. Revoke Blob URLs after use.

Success and warning behavior:

- Unknown-sender decrypts are allowed if the payload is cryptographically valid.
- A successful but unknown sender must surface an explicit unknown-sender warning.
- The user must be able to save that sender as a contact after decryption.
- Images may preview inline only after full authentication.
- Audio and video may preview only after full authentication and must stay contained in an approximately half-workspace player with normal controls.
- The user must press play for media playback.
- Manual fullscreen is allowed.
- Documents and unsupported media must offer safe download only.

Safe failure copy:

- `Could not decrypt` / `Entschlüsselung nicht möglich`
- `This item does not match your active identity or is damaged.` / `Dieses Element passt nicht zu deiner aktiven Identität oder ist beschädigt.`
- `The item decrypted, but the sender check failed.` / `Das Element wurde entschlüsselt, aber die Absenderprüfung ist fehlgeschlagen.`

### 16.8 Update, offline, and session fallback

- A discovered service-worker update must activate silently without user approval.
- Never force-reload the current document; the newest activated build loads on
  the next manual reload or app reopen.
- After the first successful load, the app should remain usable offline as long as the browser retains the app shell and versioned assets.
- If storage is unavailable, the current loaded session must continue to work, but future offline reload is not guaranteed.
- Session-only mode is the fallback when storage is denied or unavailable.

### 16.9 Help, About, and diagnostics

- Help and About must surface the product limits in plain language.
- Help and About must show exact claims and non-claims.
- Help and About must link the dedicated chat-control explainer.
- Help and About must provide source/build information.
- Diagnostics are sanitized locally.
- The user must review diagnostics before a GitHub issue draft is opened.
- The app must never auto-submit an issue.
- The issue path is for sanitized non-security diagnostics only; security vulnerabilities use the private reporting path in `SECURITY.md`.

## 17. Accessibility, i18n, and visual styling

### 17.1 Accessibility target

The product must meet WCAG 2.2 AA goals for keyboard access, focus management, contrast handling, error reporting, and non-color-dependent status communication.

Required capabilities:

- Keyboard complete operation.
- Screen reader use.
- 44x44 CSS pixel targets where practical for touch controls.
- 200% zoom and high reflow.
- Reduced motion preference.
- Language selection and proper document language metadata.

### 17.2 Critical warning handling

- Private recovery warnings and identity loss warnings are safety-critical.
- They must be announced to screen readers.
- They must not depend on color alone.
- They must be visible without hover.
- Required recovery downloads and separate safe-storage attestations must be keyboard, pointer, touch, and switch accessible through ordinary activation.
- Every wizard screen must expose `Step {n} of 7` and its progress value as text, not through color or bar width alone.
- Focus moves to each new screen heading; field errors and the four requested word positions are programmatically associated and announced.
- The recovery PDF preview and its single Download action, the expert-skip confirmation, and all practice alternatives must be keyboard complete.
- The identity flow must not depend on a time-based hold gesture or typed export phrase.

### 17.3 Localization rules

- Launch locales are `en` and `de`.
- German uses friendly informal `du` consistently.
- English is the fallback locale.
- The UI must set a correct `html lang` value for the active locale.
- All date, time, number, and plural rendering must go through locale-aware formatting.
- All user-visible strings must come from keyed resources.
- Protocol strings, magic values, object identifiers, and cryptographic labels are not translated.
- Interpolation must be ICU-like and safe for reordering.
- Plural rules must be locale aware.
- Translations must preserve meaning, warnings, and severity.
- English and German must ship with semantic parity at launch.
- The same workflow cannot have a stronger warning in one language and a weaker warning in the other.

### 17.4 Visual styling boundary

The user-approved visual direction is normative in
[`docs/apple-visual-spec.md`](docs/apple-visual-spec.md): an Apple-inspired,
calm local web interface using system fonts, semantic light/dark variables,
cool-blue product accent, red danger surfaces, 16px panels, 12px controls,
subtle material, restrained motion, opaque fallbacks, and no remote assets.

Private `PPXV` and `PPXR` cards use the specified red danger treatment with
visible warning text and iconography. Public `PPXC` cards use a clearly
non-danger blue treatment. Meaning must never depend on color alone.

## 18. Architecture and planned repository structure

### 18.1 Architectural model

The app is a static browser/PWA shell composed of these functional areas:

- App shell and navigation.
- Identity setup and identity detail views.
- Encrypt workflow.
- Decrypt workflow.
- Contacts management.
- Help/About and diagnostics.
- Localization and accessibility layer.

The shell talks only to local browser capabilities and local storage. It does not talk to a backend.

### 18.2 Functional boundaries

- UI code may request import, export, encrypt, decrypt, validate, delete, and diagnostics generation.
- Protocol code owns parsing, serialization, and wire-format validation.
- Crypto code owns key derivation, encryption, decryption, signatures, and object wrapping.
- Storage code may hold only public contacts, encrypted vault data, and user-approved local settings.
- No component may silently persist message history.
- The crypto/provider boundary must stay explicit so the implementation can be swapped without changing protocol objects.

### 18.3 Planned repository structure

This is the intended implementation layout, not a claim about current files:

- `src/app/` for app shell, routing, and top-level state.
- `src/components/` for reusable UI elements.
- `src/flows/` for identity, encrypt, decrypt, contacts, help, and diagnostics screens.
- `src/protocol/` for canonical PPX serialization and parsing.
- `src/crypto/` for provider-backed derivation, encryption, decryption, signatures, and BIP39 recovery-word handling.
- `src/storage/` for contacts, vault persistence, local settings, and session-only fallbacks.
- `src/workers/` for encryption and decryption workers.
- `src/sw/` for the service worker and versioned caching policy.
- `src/diagnostics/` for sanitized local report generation.
- `src/i18n/` for keyed locale resources and parity checks.
- `tests/` and `fixtures/` for protocol vectors, golden objects, and release checks.

### 18.4 Data flow

Expected data flow:

1. UI collects intent and user consent.
2. UI passes requests to protocol and crypto boundaries.
3. Crypto provider derives identities and performs encryption or decryption.
4. Storage stores only public contacts, encrypted vaults, and approved local settings.
5. Workers handle chunked file operations and other expensive crypto tasks.
6. The service worker caches only versioned shell assets.
7. Diagnostics are built locally and only opened as a user-reviewed issue draft.

### 18.5 Offline and service worker model

- The service worker may cache only the application shell and versioned static assets.
- It must never cache user data, decrypted content, imported files, private vault material, recovery material, or generated diagnostics still under review.
- The offline goal is availability of the app shell and previously fetched versioned assets, not silent data persistence.

## 19. GitHub Pages deployment, CSP, and provenance

### 19.1 Deployment model

The public beta is deployed only as a static GitHub Pages site built from a GitHub Actions artifact.

The deployment must stay backend-free:

- no application server;
- no database;
- no user account service;
- no remote script dependency;
- no telemetry endpoint;
- no remote font or image dependency.

Custom domains may be added later, but the current contract remains GitHub Pages first.

### 19.2 Routing and assets

- The app must work from a repository subpath.
- Derive the base path from the deployment location.
- Do not hardcode `/` as the app root.
- Use hash routing for client-side navigation.
- Keep asset URLs relative or base-aware.
- Make offline shell assets versioned and cacheable.

Hash routing is required because GitHub Pages does not provide an app server that can rewrite arbitrary deep links to `index.html`.

### 19.3 CSP and response-header limits

GitHub Pages does not give this design arbitrary project-controlled response headers.

That means:

- The app must not depend on custom headers for correctness.
- `frame-ancestors` cannot be enforced through a `<meta>` CSP tag and is therefore not available as a reliable policy control here.
- Any CSP in this deployment is partial mitigation only.

Use this exact meta CSP baseline in deployed HTML where practical:

```text
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data: blob:;
media-src 'self' blob:;
connect-src 'self';
font-src 'self';
object-src 'none';
base-uri 'none';
form-action 'none';
worker-src 'self' blob:;
manifest-src 'self'
```

Rules:

- Remote resources are prohibited.
- Inline remote scripts are prohibited.
- Third-party analytics are prohibited.
- Third-party fonts are prohibited.
- Third-party embeds are prohibited unless a separate review explicitly changes this contract.

### 19.4 Release provenance

The source tree must not hardcode whether the application is currently
published or deployed. Current operational status comes from the
[GitHub Releases](https://github.com/levi-cm/chat-nocontrol/releases), the
[Pages site](https://levi-cm.github.io/chat-nocontrol/), and their GitHub
workflow, attestation, and deployment records.

Release records must include:

- the release tag;
- the commit SHA;
- the artifact hash;
- the build log;
- the SBOM;
- the deployment URL;
- the rollback pointer for the previous deployed artifact;
- any review notes that changed the release decision.

Independent review uses a two-commit contract:

1. Freeze a candidate commit and give that exact commit to a genuinely
   independent human reviewer.
2. The reviewer returns a real Markdown or PDF report, a signature using SSH
   namespace `chat-nocontrol-security-review-v1`, and their public
   allowed-signers entry. The reviewer never shares a private key.
3. A single immediate child commit adds only
   `docs/independent-security-review.json`, the named report under
   `docs/reviews/`, `<report>.sig`, and `<report>.allowed_signers`.
4. `reviewedCommit` is the immediate parent of that evidence commit and an
   ancestor of release `HEAD`. The complete `reviewedCommit..HEAD` diff must be
   exactly those four newly added, non-symlink, non-executable regular files.
5. Any extra commit or any source, dependency, workflow, configuration,
   protocol, UI, or executable-script change invalidates the review. Freeze a
   new candidate and obtain a new independent review; do not reuse evidence.

The gate must also verify schema version 2, the report SHA-256, SSH signature,
signing identity, namespace, ISO-8601 UTC completion time, outcome
`cleared-for-public-beta`, the independence statement, and zero open critical
or high findings. It must reject invalid ancestry, renames, path traversal,
symlinks, unexpected files, and companion filenames that are not derived from
the report path.

The public-beta package-version tag must be annotated and signed. Its target,
local signature verification result, and exact remote tag object ID must be
recorded.

### 19.5 Reproducible builds

The v1 release process must be able to trace a deployment back to a specific commit and build. Where supported, the recorded source state should rebuild to the same artifact hash. Reproducibility is an evidence goal, not a cosmetic note.

## 20. Testing matrix and release levels

### 20.1 Release levels

#### Preview

Preview builds are local or branch-only builds used for implementation and review.

Requirements:

- may be incomplete;
- may fail non-blocking tests;
- must still follow the protocol and safety rules;
- must not claim public beta readiness.
- repository visibility remains private throughout implementation, review, and beta preparation.

#### Public beta

Public beta is the current target.

Requirements:

- repository visibility changes to public only after every beta gate and explicit sign-off pass, as part of the approved publication checklist;
- static GitHub Pages deployment only;
- no backend;
- no telemetry;
- no open critical or high-severity known issues for the release scope;
- independent cryptographic review has cleared the public-beta posture;
- a usable private vulnerability reporting path exists;
- test matrix completed for the shipping browser set;
- accessibility and localization checks passed;
- release record and rollback path prepared.

#### Stable

Stable is not available yet.

Stable requires fresh release-level review and:

- independent review;
- a private vulnerability reporting path;
- documented remediation workflow;
- release sign-off beyond the implementation team;
- explicit approval to raise the status beyond public beta.

### 20.2 Required test matrix

Static quality:

- `typecheck`
- `lint`
- `format:check`
- `unit`

Cryptography and protocol:

- `test:primitive-vectors` for NIST primitives, including AES-256-GCM, SHA-512, HKDF-SHA-512, scrypt, X25519, Ed25519, and ML-KEM vectors.
- `test:ppx-golden` for canonical object fixtures.
- `test:parser-property` for round-trip parse/serialize and rejection properties.
- `test:parser-fuzz` for a 100000-case extended fuzz run with no crashes or unsafe accepts.
- `test:mutations` for corrupted inputs.
- `test:truncations` for short inputs.
- `test:boundaries` for size and version limits.
- `test:qr-degradation` for damaged QR payloads.
- `test:bip39` for the English 24-word recovery round-trip and checksum handling.

Product flows:

- `test:storage` for persistent and denied-storage paths.
- `test:session-only` for no persistence after session end.
- `test:chunks` for file chunking and reassembly.
- `test:order` and `test:manifest` for file order and terminal manifest handling.
- `test:file-limits` for the 0 to 100 MiB boundaries.
- `test:cancel` for safe cancellation and discarded partial output.
- `test:memory` for bounded memory use.
- `test:en-de` for English and German semantic parity.
- `test:e2e` for identity creation, exchange, encrypt, decrypt, and delete flows.
- `test:unknown-sender` for valid but unsaved sender warnings.
- unit and `test:e2e` coverage for all seven onboarding transitions, progress values, safe Back behavior, secret cleanup, required artifact downloads/attestations, A4 print/PDF, QR/file/four-word restore practice, unlimited retries, ten-failure restart, expert-skip boundaries, preselected local storage, explicit persistence confirmation, session-only opt-out, and storage-unavailable fallback.
- password tests for empty/mismatched values, printable ASCII, internal spaces, leading/trailing-space rejection, case sensitivity, the `256`-byte maximum, exact print/PDF rendering, and absence from persistent storage, URLs, logs, QR PNG, `.ppxrecovery`, and post-secret DOM state.

Accessibility and offline behavior:

- `test:accessibility` for keyboard, screen reader, focus, contrast, and zoom.
- `test:i18n` for language parity and translation rules.
- `test:offline` for app-shell offline behavior after first load.
- `test:pwa-update-policy` for silent activation without forced reloads or
  update prompts.
- `test:network-denial` for safe behavior without network access.

Release engineering:

- `test:release` for artifact, tag, and rollback consistency.
- `test:sbom` for SBOM generation and storage.
- `test:reproducibility` for rebuild traceability.
- `test:dependency-review` for dependency review before shipping.

### 20.3 Release blockers

Do not mark a release ready if any of the following remain true:

- A critical security issue is known and unaddressed.
- The private vulnerability reporting path does not exist.
- Independent review has not happened for the target release level.
- The accessibility matrix has not passed.
- The German and English user-visible warnings diverge in meaning.
- The deployment contract is not compatible with GitHub Pages.
- The release artifact cannot be traced back to a specific commit and build.
- The repository was made public before every beta gate and explicit sign-off completed.

### 20.4 Evidence to keep with each release

Each release should keep:

- the build log;
- the commit SHA;
- the release tag;
- the artifact hash;
- the SBOM;
- the test report;
- the deployment URL;
- the rollback target;
- any review notes that changed the release decision.

### 20.5 Escalation policy

Security or privacy issues that affect users should be reported privately first.

Public disclosure should wait for the release process to capture:

- triage;
- reproduction;
- fix or mitigation;
- regression test;
- release note update.

## 21. Implementation sequence

This section gives the high-level implementation phases. The detailed execution plan belongs in `docs/implementation-plan.md`, which will be created separately and must not contradict this master spec.

### Phase 1: Lock the contract

- Freeze terminology, claims, and conflict rules.
- Verify all normative docs agree on limits and warnings.
- Capture exact object layouts and text strings.

### Phase 2: Protocol and crypto core

- Implement the provider boundary.
- Implement identity derivation and recovery-word codec.
- Implement PPXC, PPXV, PPXR, PPXT, and PPXF parsing and serialization.
- Implement validation order, checksums, signatures, and AEAD behavior.

### Phase 3: Storage and worker model

- Implement public contact storage.
- Implement encrypted vault storage and session-only fallback.
- Implement worker-backed text and file operations.
- Implement cancel, restart-on-interrupt, and bounded-memory behavior.

### Phase 4: UI flows and content

- Implement onboarding, identity, contact, encrypt, decrypt, help, and diagnostics flows.
- Apply the English and German copy contract.
- Enforce dangerous-vs-public card semantics.

### Phase 5: Accessibility, offline, and deployment

- Complete keyboard, screen reader, zoom, and reduced-motion behavior.
- Implement offline shell caching and silent service-worker activation without
  forced reloads.
- Apply the GitHub Pages routing and CSP constraints.

### Phase 6: Testing and release hardening

- Run the protocol and product test matrix.
- Prepare release provenance records.
- Resolve any release blockers before public beta promotion.

## 22. Documentation map and normative references

This map is for orientation, not as a substitute for the actual requirements in the topic docs.

| Document | Normative focus |
|---|---|
| `README.md` | Repository overview and docs package navigation |
| `SECURITY.md` | Security claims and vulnerability reporting rules |
| `CONTRIBUTING.md` | Contribution rules and terminology discipline |
| `docs/product-spec.md` | Product identity, audience, goals, scope, and release levels |
| `docs/protocol-v1.md` | PPX object families, byte layout, and recovery representation |
| `docs/security-architecture.md` | Crypto interfaces, hybrid derivation, and worker contracts |
| `docs/threat-model.md` | Threat boundaries, protected assets, and user warnings |
| `docs/design-spec.md` | State flow, storage rules, offline behavior, and semantic layout |
| `docs/ux-content-spec.md` | Screen copy, navigation, and exact user-facing strings |
| `docs/accessibility-i18n.md` | WCAG goals, keyboard and screen-reader requirements, and locale parity |
| `docs/user-guide.en.md` | English end-user guidance |
| `docs/user-guide.de.md` | German end-user guidance |
| `docs/testing-and-release.md` | Test matrix, release levels, blockers, and evidence |
| `docs/github-pages-deployment.md` | Static hosting, routing, CSP, and provenance contract |
| `docs/references.md` | Source registry and supporting references |

Normative external references used by the docs package include NIST FIPS 203, FIPS 197, SP 800-38D, RFC 5869, RFC 7914, RFC 8032, RFC 9285, the BIP39 English word list source, the Web Crypto API, the web platform APIs listed in `docs/references.md`, WCAG 2.2, and GitHub Pages hosting limits.

## 23. Definition of done

### 23.1 Docs package done

The docs package is done only when all of the following are true:

- The master spec is complete and internally consistent.
- The topic docs agree with the master spec on terminology, limits, and warnings.
- The protocol, security, UX, accessibility, deployment, and release documents all cross-reference the correct requirements.
- There are no unresolved conflicts between docs.
- The historical WebLibre plan is clearly archive-only.
- The implementation plan points forward from this master without pretending implementation has already happened.

### 23.2 Future v1 done

Future v1 is done only when all of the following are true:

- The implementation matches the documented object layouts and behaviors.
- The public beta release level is supported by the required test matrix.
- The accessibility and localization checks pass.
- The GitHub Pages deployment contract is satisfied.
- The release artifact is traceable to a specific commit, build, and provenance record.
- Independent review has cleared the public-beta security posture.
- The private vulnerability reporting path exists and is usable.

## 24. Final instruction

If any implementation, UI text, protocol byte, deployment assumption, or release claim conflicts with this master spec, this master spec wins for v1 and the conflict must be treated as a blocker until the dependent docs are updated together.
