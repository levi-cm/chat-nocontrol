# WebLibre — Complete Product Specification and Implementation Plan

> **For agentic workers:** Implement this document task-by-task. Use test-driven development, keep cryptographic and protocol code isolated from UI code, run the stated verification commands after every task, and commit each independently testable task. Do not substitute algorithms, change binary layouts, weaken warnings, add analytics, or add network services without explicit approval.

**Working product name:** WebLibre  
**Repository/package name:** `weblibre`  
**Protocol family:** `WebLibre Protocol`  
**Protocol version:** `1`  
**License:** `AGPL-3.0-or-later`  
**Primary deployment:** Cloudflare Pages  
**Supported mirror:** GitHub Pages  

**Goal:** Build a static, accountless, installable browser application that creates portable cryptographic identities, imports public contacts through QR codes or files, encrypts and decrypts text and small images locally, and produces PGP-like armored messages that can be copied through any chat service.

**Architecture:** The site has no application backend and no account database. All cryptographic operations run locally in the browser. A 256-bit random master secret deterministically generates a post-quantum encryption key and a compact classical signing key. Public contacts fit into one high-error-correction QR code; private identities use visually unmistakable crimson recovery cards. Optional persistence uses encrypted IndexedDB records, never HTTP cache storage or plaintext local storage.

**Tech stack:** TypeScript, Preact, Vite, Web Crypto, `@noble/post-quantum`, `@noble/curves`, `@noble/hashes`, `@scure/bip39`, `qrcode`, `@zxing/browser`, IndexedDB through `idb`, Vitest, fast-check, Testing Library, Playwright, axe-core, GitHub Actions.

---

## 1. Non-negotiable decisions

1. The product is named **WebLibre** for this implementation. The public launch must still include a trademark and domain-name review.
2. Version 1 uses **ML-KEM-512**, not an invented “512-bit cipher.” ML-KEM-512 is the compact NIST post-quantum parameter set and provides NIST category-1 post-quantum confidentiality.
3. Version 1 uses **Ed25519 signatures** because its 32-byte public key allows the complete public contact to fit into one Version-40 QR code at error-correction level H. Sender authentication is therefore classical, not post-quantum.
4. The exact security claim is:
   - **Post-quantum-resistant message confidentiality at NIST category 1.**
   - **Classical Ed25519 sender authentication.**
   - **AES-256-GCM authenticated content encryption.**
5. The UI and documentation must not describe the complete system as “256-bit post-quantum security,” “512-bit encryption,” “quantum proof,” “unbreakable,” or “as secure as Signal.”
6. A fully post-quantum signature profile is deliberately deferred because ML-DSA-44 adds a 1,312-byte public key and a 2,420-byte signature, which conflicts with the single high-error-correction QR requirement.
7. The app is static. It must not contain an API endpoint, analytics, telemetry, advertising, remote fonts, remote scripts, remote images, crash reporting, key server, user directory, or message relay.
8. The application may be installed as a PWA, but installation is optional. Every core feature must work in a normal HTTPS browser tab.
9. Private identity material is never stored in plaintext. “Remember this identity” means storing an encrypted vault in IndexedDB.
10. The browser Cache API is used only for versioned application assets. It must never contain identities, contacts, messages, decrypted files, or QR payloads.

---

## 2. Why this cryptographic profile is selected

### 2.1 QR-size constraint

NIST FIPS 203 specifies these ML-KEM sizes:

| Parameter set | Public encapsulation key | Private decapsulation key | KEM ciphertext | Security category |
|---|---:|---:|---:|---:|
| ML-KEM-512 | 800 bytes | 1,632 bytes | 768 bytes | 1 |
| ML-KEM-768 | 1,184 bytes | 2,400 bytes | 1,088 bytes | 3 |
| ML-KEM-1024 | 1,568 bytes | 3,168 bytes | 1,568 bytes | 5 |

NIST recommends ML-KEM-768 as the general default, but explicitly permits another parameter set when object size or performance makes the default impractical. WebLibre’s one-QR, error-correction-H contact requirement is such a case.

A Version-40 QR code at error-correction level H carries at most 1,852 alphanumeric characters. Base45 encodes two binary bytes as three QR-alphanumeric characters. WebLibre’s maximum public contact is 912 binary bytes, which becomes 1,368 Base45 characters plus a short prefix. It therefore fits in one high-error-correction QR code.

ML-KEM-768 plus even a compact 32-byte signature public key would exceed this practical Base45 budget once framing and checksums are added.

### 2.2 Selected suite

The suite identifier is `WL-PQ1`, encoded as byte `0x01`.

| Purpose | Primitive | Parameters |
|---|---|---|
| Identity entropy | Browser CSPRNG | 32 random bytes from `crypto.getRandomValues` |
| Human recovery words | BIP39 English mnemonic | 256-bit entropy, 24 words, checksum included |
| Domain-separated derivation | HKDF-SHA-512 | Fixed WebLibre labels |
| Recipient key establishment | ML-KEM-512 | NIST FIPS 203 |
| Sender signatures | Ed25519 | RFC 8032-compatible implementation |
| Content encryption | AES-256-GCM | 256-bit key, 96-bit random nonce, 128-bit tag |
| Vault password KDF | scrypt | `N=65536`, `r=8`, `p=1`, 32-byte output, 16-byte salt |
| Fingerprints/checksums | SHA-512 | Truncated only where explicitly specified |
| QR transport encoding | Base45 | RFC 9285 |
| Clipboard/file encoding | Base64url | No padding in armored body |

### 2.3 Implementation warning

`@noble/post-quantum` is suitable for a transparent browser prototype and exposes ML-KEM-512, but its own documentation states that it is not independently audited and does not provide side-channel protection. Therefore:

- All ML-KEM calls must be hidden behind a `CryptoProvider` interface.
- Version 1 must pass NIST known-answer tests and WebLibre protocol vectors.
- A public “production secure” release is blocked until the pinned cryptographic implementation and the complete protocol receive an independent security review.
- The protocol format must not depend on library-specific key objects so the implementation can later be replaced without invalidating identities or messages.

---

## 3. Identity uniqueness and collision target

Each identity begins with 256 independently random bits.

Assume 8.2 billion people each create one million identities:

- Total generated identities: `8.2 × 10^15`
- Approximate birthday-collision probability: `N² / (2 × 2²⁵⁶)`
- Result: approximately `2.9 × 10⁻⁴⁶`

This is roughly one chance in `3.4 × 10^45`. Key collisions are therefore negligible. The implementation must still reject a newly generated identity if its public fingerprint already exists in the same local database, because that check is nearly free and catches implementation or RNG failures.

### 3.1 Population-scale operation

WebLibre does not create server-side accounts. Identity generation, contact storage, encryption, and decryption are independent local operations, so the cryptographic design does not become more collision-prone or require a larger database as adoption grows. Supporting billions of visitors is therefore a static-CDN bandwidth and availability problem rather than an account-database or key-allocation problem. Cloudflare Pages is the intended high-scale front end; GitHub Pages is a functional mirror rather than a guaranteed planet-scale service.

The username is only a display label. It is optional, not globally unique, not an account name, and not part of the cryptographic identity fingerprint.

---

## 4. Threat model and security boundaries

### 4.1 Protected against

- A chat provider reading encrypted message contents.
- Passive storage of encrypted text or image files by third parties.
- Modification, insertion, or truncation of ciphertext without detection.
- Future quantum attacks against the ML-KEM-512 key-establishment step, within the assumptions of NIST category 1.
- Impersonation by ordinary classical attackers when the recipient has the sender’s verified Ed25519 public contact.
- Accidental copying of incomplete armored messages.
- Casual theft of a browser database when the identity vault is protected by a strong passphrase.

### 4.2 Not protected against

- Malware, a compromised operating system, malicious keyboards, malicious browser extensions, screenshots, screen recording, or clipboard monitoring.
- A compromised WebLibre deployment serving modified JavaScript.
- Traffic metadata such as who contacted whom, time, IP address, message size, and the transport account used.
- Future quantum forgery of Ed25519 sender signatures.
- Recovery after losing both the private recovery material and the remembered browser vault passphrase.
- Decryption of previously recorded messages after the recipient’s master identity is later compromised. Version 1 has no forward secrecy or ratchet.
- Man-in-the-middle substitution of an unverified first public contact.
- Secure deletion guarantees in JavaScript memory; wiping byte arrays is best-effort because engines may copy data internally.

### 4.3 Required user-facing wording

The Help and About screens must contain these statements in plain language:

- “WebLibre encrypts on this device. It does not create an online account.”
- “Your username is only a label. Two people can use the same name.”
- “The red private identity card controls your identity. Never send it to another person.”
- “Verify a contact’s public fingerprint through a trusted channel before treating messages as authenticated.”
- “Losing your private identity and recovery words permanently loses access.”
- “WebLibre hides message content, not transport metadata.”
- “Version 1 has post-quantum encryption but classical sender signatures.”

---

## 5. Master identity and deterministic key derivation

### 5.1 Master entropy

Generate exactly 32 bytes with:

```ts
const masterEntropy = crypto.getRandomValues(new Uint8Array(32));
```

Do not combine timestamps, usernames, device identifiers, mouse movements, or user-entered words with this value.

The 24-word mnemonic is a reversible representation of the same 32-byte entropy. Use BIP39 `entropyToMnemonic` and `mnemonicToEntropy`. Do not use the BIP39 PBKDF2 mnemonic-to-seed function for protocol key derivation.

### 5.2 HKDF labels

Derive independent seeds using HKDF-SHA-512:

```text
salt = SHA-512("WEBLIBRE-MASTER-SALT-V1")
KEM seed, 64 bytes  = HKDF(masterEntropy, salt, "WEBLIBRE/IDENTITY/V1/ML-KEM-512", 64)
Sign seed, 32 bytes = HKDF(masterEntropy, salt, "WEBLIBRE/IDENTITY/V1/ED25519", 32)
History key, 32     = HKDF(masterEntropy, salt, "WEBLIBRE/LOCAL/V1/HISTORY", 32)
```

All labels are exact UTF-8 strings and are protocol constants. Changing capitalization or punctuation creates a different identity and is forbidden in protocol version 1.

### 5.3 Derived identity

```ts
export interface DerivedIdentity {
  suite: 'WL-PQ1';
  masterEntropy: Uint8Array;      // 32 bytes; secret
  kemPublicKey: Uint8Array;       // 800 bytes
  kemSecretKey: Uint8Array;       // 1632 bytes; secret
  signingPublicKey: Uint8Array;   // 32 bytes
  signingSecretKey: Uint8Array;   // implementation-defined secret bytes
  fingerprint: Uint8Array;        // 32 bytes
  identityId: Uint8Array;         // first 20 fingerprint bytes
  verificationWords: string[];    // 8 public words
}
```

The full fingerprint is:

```text
SHA-512(
  "WEBLIBRE-FINGERPRINT-V1" ||
  suiteByte ||
  kemPublicKey ||
  signingPublicKey
)[0..32]
```

The internal identity ID is the first 20 bytes. Eight public verification words are produced from the first 88 bits, mapped into the BIP39 English list as eight 11-bit indices. These words must always be labeled **Public verification words**, never “seed words” or “recovery words.”

---

## 6. Username rules

- Optional.
- Normalize with Unicode NFKC.
- Trim leading and trailing Unicode whitespace.
- Reject control characters, bidi override characters, line separators, and null bytes.
- Maximum encoded UTF-8 length: 48 bytes.
- Empty after normalization means no username.
- Display usernames beside a shortened fingerprint; never display a username alone as proof of identity.
- A contact may have a local nickname stored separately. Local nicknames are not included in QR data or signatures.

---

## 7. Binary protocol formats

All integers are unsigned and big-endian. Parsers must reject unknown mandatory versions, impossible lengths, trailing bytes, duplicate fields, and objects larger than the limits in this specification.

### 7.1 Public contact object `WLC1`

Maximum size: 912 bytes.

| Offset | Length | Field |
|---:|---:|---|
| 0 | 4 | ASCII magic `WLC1` |
| 4 | 1 | Format version `0x01` |
| 5 | 1 | Suite `0x01` (`WL-PQ1`) |
| 6 | 1 | Flags; bit 0 means username present; other bits zero |
| 7 | 1 | Username UTF-8 byte length `0..48` |
| 8 | 8 | Creation Unix time in seconds; zero allowed |
| 16 | 800 | ML-KEM-512 public key |
| 816 | 32 | Ed25519 public key |
| 848 | N | Normalized username UTF-8 bytes |
| 848+N | 16 | `SHA-512(all previous bytes)[0..16]` |

The fingerprint is derived from the suite and public keys, not from the username or creation time.

File extension: `.wlcontact`  
MIME type: `application/vnd.weblibre.contact`  
QR prefix: `WL1:CONTACT:` followed by uppercase Base45.

### 7.2 Locked private identity vault `WLV1`

This is the default private QR and the only representation saved in IndexedDB.

Outer structure:

| Field | Length |
|---|---:|
| Magic `WLV1` | 4 |
| Format version | 1 |
| Suite | 1 |
| Flags; bit 0 encrypted must be set | 1 |
| KDF ID; `0x01` means scrypt | 1 |
| `log2(N)`; fixed `16` | 1 |
| `r`; fixed `8` | 2 |
| `p`; fixed `1` | 2 |
| Salt | 16 |
| AES-GCM nonce | 12 |
| Ciphertext length | 2 |
| Ciphertext including GCM tag | variable |
| Outer checksum `SHA-512(previous bytes)[0..16]` | 16 |

The decrypted inner plaintext is:

| Field | Length |
|---|---:|
| Magic `WLIS` | 4 |
| Inner version | 1 |
| Master entropy | 32 |
| Creation Unix time | 8 |
| Username length | 1 |
| Username | `0..48` |
| Inner checksum `SHA-512(previous inner bytes)[0..16]` | 16 |

The AES key is the 32-byte scrypt output. AES-GCM additional authenticated data is every outer field through the nonce, excluding the ciphertext length. Passphrases are encoded exactly as UTF-8 without Unicode normalization, must contain 12 to 256 UTF-8 bytes, and are case- and space-sensitive. The UI recommends at least 16 characters or a password-manager-generated value.

File extension: `.wlvault`  
MIME type: `application/vnd.weblibre.vault`  
QR prefix: `WL1:PRIVATE:` followed by uppercase Base45.

### 7.3 Unencrypted emergency recovery object `WLR1`

This is an advanced, explicitly dangerous export.

| Field | Length |
|---|---:|
| Magic `WLR1` | 4 |
| Version | 1 |
| Suite | 1 |
| Master entropy | 32 |
| Creation time | 8 |
| Username length | 1 |
| Username | `0..48` |
| Checksum `SHA-512(previous bytes)[0..16]` | 16 |

QR prefix: `WL1:RECOVERY:`.

The UI must require all of the following before creating it:

1. A checkbox: “I understand this image is the complete unencrypted identity.”
2. A second checkbox: “Anyone who copies it can impersonate me and decrypt messages sent to this identity.”
3. A three-second press-and-hold confirmation.

### 7.4 Message outer envelope `WLM1`

| Field | Length |
|---|---:|
| Magic `WLM1` | 4 |
| Format version | 1 |
| Suite | 1 |
| Public content type: text `0x01`, images `0x02`, mixed `0x03` | 1 |
| Flags; bit 0 embeds sender contact | 1 |
| Recipient hint: first 8 bytes of recipient identity ID | 8 |
| ML-KEM-512 ciphertext | 768 |
| HKDF salt | 32 |
| AES-GCM nonce | 12 |
| Encrypted payload length | 4 |
| AES-GCM ciphertext including tag | variable |
| Copy checksum `SHA-512(all previous bytes)[0..16]` | 16 |

Maximum binary message size: 8 MiB plus envelope overhead. Reject declared or actual larger messages before allocation.

### 7.5 Signed inner payload `WLI1`

| Field | Length |
|---|---:|
| Magic `WLI1` | 4 |
| Inner version | 1 |
| Flags | 1 |
| Creation Unix time | 8 |
| Random message ID | 16 |
| Sender identity ID | 20 |
| Recipient identity ID | 20 |
| Username length | 1 |
| Username | `0..48` |
| Embedded public-contact length | 2; zero or `864..912` |
| Embedded public contact | variable |
| Text length | 4; maximum 262,144 bytes |
| UTF-8 text | variable |
| Attachment count | 1; `0..4` |
| Attachment records | variable |
| Ed25519 signature | 64 |

Each attachment record contains:

| Field | Length |
|---|---:|
| MIME code: JPEG `1`, PNG `2`, WebP `3` | 1 |
| Filename length | 1; `0..80` |
| Sanitized filename UTF-8 | variable |
| Data length | 4 |
| Raw bytes | variable |
| SHA-512 digest truncated to 32 bytes | 32 |

The signature input is:

```text
UTF8("WEBLIBRE-SIGNED-MESSAGE-V1") || all inner payload bytes before the signature
```

For known contacts, omit the embedded public contact to reduce message length. For a first-contact message, include the complete public contact so the recipient can save a reply key. A valid signature from a new, unverified key must be displayed as **Cryptographically valid, identity not yet verified**.

### 7.6 Message encryption flow

1. Serialize the unsigned inner payload.
2. Sign it with Ed25519 and append the 64-byte signature.
3. Call ML-KEM-512 encapsulation with the recipient public key, producing `kemCiphertext` and `sharedSecret`.
4. Generate a fresh 32-byte HKDF salt and fresh 12-byte AES-GCM nonce.
5. Derive the AES key:

```text
HKDF-SHA-512(
  inputKeyMaterial = sharedSecret,
  salt = messageSalt,
  info = UTF8("WEBLIBRE-MESSAGE-KEY-V1") || recipientIdentityId || SHA-512(kemCiphertext)[0..16],
  length = 32
)
```

6. Build the outer header through the nonce. Use that exact header as AES-GCM additional authenticated data.
7. Encrypt the complete signed inner payload with AES-256-GCM.
8. Append the copy checksum.
9. Best-effort wipe the shared secret, derived AES bytes, serialized plaintext, and temporary private-key arrays.

### 7.7 Message decryption flow

1. Parse armor and verify the begin marker, end marker, declared byte length, and armor digest.
2. Parse `WLM1`, enforce every length limit, and verify the copy checksum.
3. Select the local identity using the 8-byte recipient hint. If multiple match, try each candidate without exposing timing details in the UI.
4. ML-KEM decapsulate and derive the AES key.
5. AES-GCM decrypt with the exact outer header as AAD.
6. Parse `WLI1` and enforce limits before rendering.
7. Locate the sender contact by identity ID, or parse the embedded first-contact object.
8. Verify the Ed25519 signature.
9. Show one of the required states:
   - **Verified known sender**
   - **Valid signature, unverified new contact**
   - **Known name, different key — possible key change or impersonation**
   - **Invalid signature — do not trust this message**
   - **Wrong identity or corrupted message**
10. Best-effort wipe private intermediate arrays after display state is created.

---

## 8. PGP-like ASCII armor

Use this exact format:

```text
-----BEGIN WEBLIBRE ENCRYPTED MESSAGE-----
Version: 1
Suite: WL-PQ1
Type: TEXT
Bytes: 1234
Digest: AbCdEf0123456789abcdEF

<base64url without padding, wrapped at 72 characters>
-----END WEBLIBRE ENCRYPTED MESSAGE-----
```

Rules:

- Header and footer must match exactly.
- Supported `Type` values are `TEXT`, `IMAGES`, and `MIXED`.
- `Bytes` is the decoded envelope length.
- `Digest` is Base64url of `SHA-512(envelope)[0..16]`.
- Body line wrapping is 72 characters, but the parser accepts arbitrary ASCII whitespace inside the body.
- The parser rejects non-Base64url body characters, duplicate headers, unsupported suites, excessive length, missing blank line, missing footer, data after the footer, and digest mismatch.
- A missing footer produces: **“This WebLibre message appears incomplete. Copy it again including the END line.”**
- A checksum mismatch produces: **“The message was changed or damaged before decryption.”**

Binary message file extension: `.wlmessage`  
MIME type: `application/vnd.weblibre.message`.

---

## 9. QR and image specification

### 9.1 Encoding

- Base45, uppercase QR-alphanumeric alphabet.
- Error correction: **H** for every identity and contact QR.
- Version: smallest version that fits, up to Version 40.
- Quiet zone: exactly four or more modules.
- No logos, center images, gradients, rounded modules, transparent background, decorative cuts, or inverted colors.
- PNG export: 2,048 × 2,048 pixels minimum.
- Printed export: at least 90 mm square for Version-40 public contacts.
- Scanner must accept camera frames, uploaded PNG/JPEG/WebP images, clipboard-pasted images where supported, and `.wlcontact`/`.wlvault` files.
- Prefer native `BarcodeDetector` only as an optional acceleration. Always retain ZXing as the cross-browser fallback.

### 9.2 Private-card visual identity

The private identity card must not rely on color alone, but it must use a consistent danger color:

- Card background: `#B00020`.
- QR modules: `#5A0014`.
- QR background and quiet zone: `#FFFFFF`.
- Main title: `PRIVATE IDENTITY — NEVER SHARE`.
- Secondary warning: `Anyone with this card may control your WebLibre identity.`
- Add a lock icon for encrypted private cards.
- Add an open-lock icon and diagonal `UNENCRYPTED SECRET` band for emergency recovery cards.
- Repeat the first and last two public fingerprint groups outside the QR to help users identify which identity the card belongs to without exposing secret material.
- The filename is `weblibre-private-<fingerprint-prefix>.png`.

The QR generator must run automated contrast and decode tests for these exact colors. If the crimson module color fails on a tested scanner, retain the crimson card but render QR modules as `#220008`; do not lower error correction.

### 9.3 Public contact card

- Card accent: `#075985` or a system-theme equivalent with WCAG AA contrast.
- QR modules: `#061826` on `#FFFFFF`.
- Title: username when present; otherwise `WebLibre contact`.
- Show all eight public verification words.
- Show a shortened hexadecimal fingerprint.
- Label: `PUBLIC — SAFE TO SHARE`.
- Filename: `weblibre-contact-<fingerprint-prefix>.png`.

### 9.4 Compression warning

QR error correction can recover some damaged codewords, but it does not guarantee recovery after aggressive image resizing, blur, cropping, or social-network JPEG conversion. The UI must recommend sending the original PNG as a file when possible. Public keys are pseudorandom and should not be expected to compress meaningfully.

---

## 10. Browser persistence and local context

### 10.1 Database

Use IndexedDB database `weblibre-v1`, version `1`, with these stores:

```ts
interface StoredVaultRecord {
  id: string;                 // base64url of 20-byte identity ID
  label: string | null;       // non-secret display label
  vaultBytes: Uint8Array;     // complete encrypted WLV1 object
  createdAt: number;
  lastUsedAt: number;
}

interface StoredContactRecord {
  id: string;
  contactBytes: Uint8Array;
  localNickname: string | null;
  verification: 'unverified' | 'verified-in-person' | 'verified-other-channel';
  verifiedAt: number | null;
  createdAt: number;
  lastUsedAt: number;
}

interface StoredHistoryRecord {
  id: string;                 // random record ID
  conversationId: string;     // sorted pair of identity IDs, hashed
  nonce: Uint8Array;
  ciphertext: Uint8Array;     // AES-GCM encrypted with identity history key
  createdAt: number;
}

interface AppSettingRecord {
  key: string;
  value: boolean | string | number;
}
```

### 10.2 Identity persistence

- “Remember this identity on this device” stores only `WLV1` encrypted bytes.
- Unlock requires the vault passphrase after a browser restart.
- Decrypted identity keys remain only in an in-memory session object.
- Default automatic lock: 10 minutes without interaction.
- Lock immediately when the user presses Lock.
- Lock after the document has remained hidden for 5 minutes.
- Clear clipboard content created by WebLibre after 60 seconds when the Clipboard API permits and the page still has permission.
- Do not promise that deleting IndexedDB securely erases flash storage.

### 10.3 Contacts and context

- Public contact cards may be stored unencrypted because they are public.
- Save username, local nickname, verification status, fingerprint, last-used time, and the original contact bytes.
- Optional local message history is disabled by default.
- When enabled, store only locally encrypted history records under the identity-derived history key.
- Provide per-conversation and global “Delete local history” controls.
- Never sync contacts or history to a server.
- Display a warning that private browsing modes and mobile operating systems may evict browser storage; exported recovery material remains mandatory.

---

## 11. User experience specification

### 11.1 Navigation

Mobile uses a fixed bottom navigation with five tabs:

1. **Encrypt**
2. **Decrypt**
3. **Contacts**
4. **Identity**
5. **Help**

Desktop at widths of 900 px or more uses the same five destinations in a left navigation rail. Do not create different information architecture between mobile and desktop.

When no identity exists, start on Identity. When a remembered identity exists but is locked, show the unlock screen. When an identity is unlocked, start on Encrypt.

### 11.2 First-run identity wizard

Steps:

1. Explain that no account or server registration is created.
2. Ask for an optional username.
3. Generate identity only after a user press; show a short entropy-generation progress state to avoid accidental double-clicks.
4. Display the 24 recovery words once with screenshot warning.
5. Require the user to confirm four randomly selected word positions.
6. Ask for and confirm a vault passphrase.
7. Generate the crimson locked private card.
8. Require the user to download or share-to-files the private card before continuing.
9. Generate the blue public contact card.
10. Offer “Remember encrypted identity on this device,” enabled only after explaining that the passphrase is still required.
11. Finish on a checklist: private saved, public shareable, fingerprint visible.

### 11.3 Encrypt flow

- Contact picker with search by username, nickname, and fingerprint.
- Import-contact button when no contact is selected.
- Text editor with live UTF-8 byte count and 262,144-byte limit.
- Up to four image attachments, 8 MiB total.
- Toggle: “Include my public contact for first reply,” automatically enabled for unverified/new recipients.
- Primary action: `Encrypt message`.
- Result options:
  - Copy armored text.
  - Download `.wlmessage`.
  - Native Share API when available.
  - Save encrypted copy to local history if history is enabled.
- Show exact warning when the armor is long enough that a chat service may truncate it; recommend file export.

### 11.4 Decrypt flow

Input methods:

- Paste armored text.
- Upload `.wlmessage`.
- Share-target import when installed as a PWA and supported.

Output:

- Large verification-status banner.
- Sender username plus fingerprint; username alone is never used as identity.
- Plain text with no HTML interpretation.
- Safe image previews through Blob URLs.
- Download attachments using sanitized filenames.
- Save new public contact only after explicit confirmation.
- Mark a contact verified only through a separate verification action, never automatically because a signature is valid.

### 11.5 Contacts flow

- Scan live QR.
- Upload a QR image.
- Import `.wlcontact`.
- Show contact detail, fingerprint words, verification status, creation date, and local nickname.
- “Verify contact” offers:
  - `Scanned in person`
  - `Compared through another trusted channel`
- Detect an imported contact with the same username but a different fingerprint and show a red key-change warning.
- Export the stored original public contact card.
- Delete contact without deleting message files outside the app.

### 11.6 Identity flow

- Locked/unlocked state.
- Current username and fingerprint.
- Export public card.
- Export new locked private card after passphrase confirmation.
- Advanced emergency recovery export.
- Show 24 recovery words only after passphrase confirmation and a screen-obscuring warning.
- Change local vault passphrase without changing identity keys.
- Lock now.
- Remove remembered vault from this browser.
- Permanently replace identity only after typing `REPLACE` and confirming recovery backup.

### 11.7 Help flow

Use short illustrated steps, not cryptographic jargon, as the default. Include expandable technical sections for:

- What public and private cards mean.
- How to verify a fingerprint.
- What “post-quantum encryption, classical signature” means.
- Why usernames are not unique.
- Why there is no password reset.
- What browser storage does.
- What WebLibre cannot hide.
- How to use the site offline.
- Build version, source commit, dependency notices, and security-reporting instructions.

---

## 12. Accessibility and internationalization

- Minimum WCAG 2.2 AA target.
- All controls keyboard accessible.
- Visible focus indicators.
- Touch targets at least 44 × 44 CSS pixels.
- Respect `prefers-reduced-motion`.
- Do not rely solely on red/blue color distinctions; use text and icons.
- Screen readers must announce private-card warnings before export actions.
- Error summaries must receive focus after validation failure.
- Use system fonts only.
- Initial language: English.
- All UI strings live in `src/i18n/en.ts`; no hard-coded feature strings in components.
- Protocol strings, armor markers, algorithm labels, and QR prefixes are never translated.

---

## 13. Browser and device compatibility

Required baseline:

- iOS/iPadOS Safari 16.4 or newer.
- Android 9 or newer with a maintained Chromium-based browser or Firefox.
- Current and previous two stable releases of Chrome, Edge, Firefox, and Safari on desktop.
- PWA installation is optional and may differ by platform.

Do not require:

- Native BarcodeDetector.
- SharedArrayBuffer.
- WebGPU.
- WebAssembly threads.
- File System Access API.
- A particular password manager.

Fallbacks:

- ZXing for QR decoding.
- `<input type="file" accept="image/*">` for platforms without camera permission or live scanning.
- Download links when Web Share is absent.
- IndexedDB feature test with a no-persistence session mode if unavailable.

Manual release devices must include at least:

- One lower-memory Android phone with 4 GB RAM.
- One current Android phone.
- iPhone SE second generation or equivalent older supported iPhone.
- One current iPhone.
- Desktop Chrome, Firefox, and Safari.

---

## 14. Security headers and deployment

### 14.1 Content Security Policy

Cloudflare Pages `_headers` must include a policy equivalent to:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; worker-src 'self' blob:; manifest-src 'self'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()
Cross-Origin-Opener-Policy: same-origin
```

GitHub Pages cannot provide the same response-header control. Include a strict CSP meta element in `index.html`, document the limitation, and identify Cloudflare Pages as the recommended security deployment.

### 14.2 Build and cache rules

- Hashed JS/CSS assets: one-year immutable cache.
- `index.html`, service worker, and manifest: no-cache/revalidate.
- Never cache imported user files.
- Show source commit and build timestamp in About.
- Build must be reproducible from the lockfile.
- Generate and publish SHA-256 checksums for release ZIP files.
- Activate a discovered service worker silently, but never force-reload the open document. The newest activated build loads on the next manual reload or app reopen.

### 14.3 GitHub Pages

- Build with the repository base path from `VITE_BASE_PATH`.
- Use hash-based client navigation or a single-page fallback that works without server rewrites.
- GitHub Actions deploys only after unit, property, E2E, dependency, and production-build checks pass.

---

## 15. Repository structure

```text
weblibre/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-github-pages.yml
│       └── release.yml
├── docs/
│   ├── protocol-v1.md
│   ├── threat-model.md
│   ├── security.md
│   ├── user-guide.md
│   └── release-checklist.md
├── e2e/
│   ├── identity.spec.ts
│   ├── contacts.spec.ts
│   ├── message-roundtrip.spec.ts
│   ├── qr-import.spec.ts
│   ├── offline.spec.ts
│   └── accessibility.spec.ts
├── public/
│   ├── _headers
│   ├── manifest.webmanifest
│   ├── icons/
│   └── qr-fixtures/
├── scripts/
│   ├── generate-protocol-vectors.ts
│   ├── verify-protocol-vectors.ts
│   └── build-release-manifest.ts
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── AppShell.tsx
│   │   ├── navigation.ts
│   │   └── state.ts
│   ├── crypto/
│   │   ├── CryptoProvider.ts
│   │   ├── NobleCryptoProvider.ts
│   │   ├── deriveIdentity.ts
│   │   ├── kdf.ts
│   │   ├── mnemonic.ts
│   │   ├── random.ts
│   │   └── wipe.ts
│   ├── protocol/
│   │   ├── constants.ts
│   │   ├── BinaryReader.ts
│   │   ├── BinaryWriter.ts
│   │   ├── contact.ts
│   │   ├── vault.ts
│   │   ├── recovery.ts
│   │   ├── message.ts
│   │   ├── armor.ts
│   │   ├── fingerprint.ts
│   │   └── errors.ts
│   ├── qr/
│   │   ├── base45.ts
│   │   ├── generateQr.ts
│   │   ├── renderCards.ts
│   │   ├── scanQr.ts
│   │   └── classifyQr.ts
│   ├── storage/
│   │   ├── db.ts
│   │   ├── vaultStore.ts
│   │   ├── contactStore.ts
│   │   ├── historyStore.ts
│   │   └── settingsStore.ts
│   ├── session/
│   │   ├── IdentitySession.ts
│   │   └── autoLock.ts
│   ├── features/
│   │   ├── identity/
│   │   ├── encrypt/
│   │   ├── decrypt/
│   │   ├── contacts/
│   │   └── help/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Dialog.tsx
│   │   ├── FileDrop.tsx
│   │   ├── StatusBanner.tsx
│   │   ├── Tabs.tsx
│   │   └── styles.css
│   ├── i18n/
│   │   └── en.ts
│   ├── main.tsx
│   └── sw.ts
├── tests/
│   ├── crypto/
│   ├── protocol/
│   ├── qr/
│   ├── storage/
│   └── fixtures/
├── index.html
├── package.json
├── package-lock.json
├── playwright.config.ts
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

# Implementation plan

## Global engineering constraints

- Node.js 22 LTS.
- `npm` with committed `package-lock.json`.
- TypeScript `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` enabled.
- No `any` in protocol, cryptographic, QR, or storage modules.
- Every external byte array is length-checked before cryptographic use.
- No protocol object is represented by ordinary JSON on the wire.
- No cryptographic code in Preact components.
- No UI code in protocol or cryptographic modules.
- All dependency versions installed with `--save-exact`.
- No application-data network call is permitted at runtime; production CSP restricts `connect-src` to `'self'` only for same-origin static-asset and service-worker update traffic.
- Every task ends with tests and a commit.

---

## Task 1: Scaffold the static application and quality gates

**Files:** Create the base project, configuration files, `src/app/AppShell.tsx`, `src/ui/styles.css`, and `.github/workflows/ci.yml`.

**Commands:**

```bash
npm create vite@latest . -- --template preact-ts
npm install --save-exact preact idb @noble/post-quantum @noble/curves @noble/hashes @scure/bip39 qrcode @zxing/browser
npm install --save-dev --save-exact vitest jsdom fast-check fake-indexeddb @types/qrcode tsx @testing-library/preact @testing-library/user-event @playwright/test @axe-core/playwright eslint prettier typescript vite
npx playwright install --with-deps chromium firefox webkit
```

**Required tests:**

```ts
// src/app/App.test.tsx
import { render, screen } from '@testing-library/preact';
import App from './App';

it('renders the five primary destinations', () => {
  render(<App />);
  for (const label of ['Encrypt', 'Decrypt', 'Contacts', 'Identity', 'Help']) {
    expect(screen.getByRole('button', { name: label })).toBeTruthy();
  }
});
```

**Acceptance:**

- `npm run typecheck`, `npm test`, `npm run build`, and `npx playwright test` are defined.
- CI runs typecheck, lint, unit tests, production build, and Chromium E2E.
- App shell uses bottom navigation below 900 px and a left rail at 900 px or wider.
- No external font or remote asset request appears in a production build.

**Commit:**

```bash
git add .
git commit -m "chore: scaffold WebLibre static application"
```

---

## Task 2: Implement strict byte utilities and binary codecs

**Files:** `src/protocol/BinaryReader.ts`, `BinaryWriter.ts`, `errors.ts`, tests under `tests/protocol/`.

**Interfaces:**

```ts
export class BinaryWriter {
  u8(value: number): this;
  u16(value: number): this;
  u32(value: number): this;
  u64(value: bigint): this;
  bytes(value: Uint8Array): this;
  finish(): Uint8Array;
}

export class BinaryReader {
  constructor(bytes: Uint8Array, maximumBytes: number);
  u8(): number;
  u16(): number;
  u32(): number;
  u64(): bigint;
  bytes(length: number): Uint8Array;
  expectEnd(): void;
  remaining(): number;
}
```

**Required tests:**

```ts
it('round-trips big-endian integers and bytes', () => {
  const encoded = new BinaryWriter()
    .u8(0xab)
    .u16(0xcdef)
    .u32(0x12345678)
    .u64(0x0102030405060708n)
    .bytes(Uint8Array.of(9, 10))
    .finish();
  const reader = new BinaryReader(encoded, 64);
  expect(reader.u8()).toBe(0xab);
  expect(reader.u16()).toBe(0xcdef);
  expect(reader.u32()).toBe(0x12345678);
  expect(reader.u64()).toBe(0x0102030405060708n);
  expect(reader.bytes(2)).toEqual(Uint8Array.of(9, 10));
  reader.expectEnd();
});

it('rejects declared reads beyond the configured limit', () => {
  expect(() => new BinaryReader(new Uint8Array(9), 8)).toThrow('object exceeds limit');
});
```

Add fast-check properties for random integer/byte round trips and malformed truncation.

**Acceptance:** No unchecked `DataView` access and no parser allocation based on an unvalidated length.

**Commit:** `feat: add strict binary protocol codecs`

---

## Task 3: Implement Base45 and transport encodings

**Files:** `src/qr/base45.ts`, `src/protocol/armor.ts` skeleton, `tests/qr/base45.test.ts`.

**Interfaces:**

```ts
export function encodeBase45(bytes: Uint8Array): string;
export function decodeBase45(value: string, maximumBytes: number): Uint8Array;
export function encodeBase64Url(bytes: Uint8Array): string;
export function decodeBase64Url(value: string, maximumBytes: number): Uint8Array;
```

**Required RFC 9285 tests:**

```ts
expect(encodeBase45(new TextEncoder().encode('AB'))).toBe('BB8');
expect(encodeBase45(new TextEncoder().encode('Hello!!'))).toBe('%69 VD92EX0');
expect(new TextDecoder().decode(decodeBase45('BB8', 8))).toBe('AB');
expect(() => decodeBase45('abc', 8)).toThrow(); // lowercase is outside the alphabet
```

Reject invalid alphabet characters, overflowed three-character groups, impossible final-group lengths, and decoded output over the caller limit.

**Commit:** `feat: add strict Base45 and base64url codecs`

---

## Task 4: Create the cryptographic provider boundary

**Files:** `src/crypto/CryptoProvider.ts`, `NobleCryptoProvider.ts`, `random.ts`, `kdf.ts`, `wipe.ts`, tests under `tests/crypto/`.

**Interface:**

```ts
export interface CryptoProvider {
  randomBytes(length: number): Uint8Array;
  sha512(data: Uint8Array): Uint8Array;
  hkdfSha512(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Uint8Array;
  scrypt(passphrase: Uint8Array, salt: Uint8Array): Promise<Uint8Array>;
  mlKem512Keygen(seed64: Uint8Array): { publicKey: Uint8Array; secretKey: Uint8Array };
  mlKem512Encapsulate(publicKey: Uint8Array): { cipherText: Uint8Array; sharedSecret: Uint8Array };
  mlKem512Decapsulate(cipherText: Uint8Array, secretKey: Uint8Array): Uint8Array;
  ed25519PublicKey(seed32: Uint8Array): Uint8Array;
  ed25519Sign(message: Uint8Array, seed32: Uint8Array): Uint8Array;
  ed25519Verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean;
  aesGcmEncrypt(key32: Uint8Array, nonce12: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
  aesGcmDecrypt(key32: Uint8Array, nonce12: Uint8Array, ciphertext: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
}
```

**Required tests:**

- ML-KEM key sizes are exactly 800 and 1,632 bytes.
- ML-KEM ciphertext is 768 bytes and both parties derive the same 32-byte shared secret.
- Mutated KEM ciphertext does not derive the original shared secret.
- Ed25519 signature length is 64 and mutation fails verification.
- AES-GCM round-trip succeeds; changed AAD, nonce, ciphertext, or tag fails.
- scrypt returns 32 bytes using the fixed parameters.
- Random generation rejects zero, negative, non-integer, and excessive requested lengths.

Use fixed test seeds for determinism. Import official NIST ML-KEM known-answer vectors into `tests/fixtures/nist-ml-kem-512/` and verify the provider against them.

**Acceptance:** The rest of the application imports only `CryptoProvider`, never Noble modules directly.

**Commit:** `feat: add replaceable cryptographic provider`

---

## Task 5: Implement mnemonic and deterministic identity derivation

**Files:** `src/crypto/mnemonic.ts`, `deriveIdentity.ts`, `src/protocol/fingerprint.ts`, tests.

**Interfaces:**

```ts
export function entropyToRecoveryWords(entropy32: Uint8Array): string[];
export function recoveryWordsToEntropy(words: readonly string[]): Uint8Array;
export function normalizeUsername(input: string): string | null;
export function deriveIdentity(masterEntropy: Uint8Array, crypto: CryptoProvider): DerivedIdentity;
```

**Required tests:**

- 32 bytes produce exactly 24 words.
- One changed or invalid word fails checksum validation.
- Mnemonic round-trip restores exact entropy.
- Same entropy always gives identical KEM/signing public keys and fingerprint.
- Different entropy gives a different fingerprint.
- Username normalization rejects controls and byte length greater than 48.
- Fingerprint does not change when the username changes.
- Eight verification words are stable and are never used to recover the master entropy.

**Security behavior:** Generate 32 bytes in one `getRandomValues` call. Do not derive entropy from the username or passphrase.

**Commit:** `feat: add 24-word deterministic identities`

---

## Task 6: Implement contact, vault, and recovery formats

**Files:** `src/protocol/contact.ts`, `vault.ts`, `recovery.ts`, protocol tests.

**Interfaces:**

```ts
export interface PublicContact {
  suite: 'WL-PQ1';
  createdAt: number;
  username: string | null;
  kemPublicKey: Uint8Array;
  signingPublicKey: Uint8Array;
  fingerprint: Uint8Array;
  identityId: Uint8Array;
}

export function encodeContact(contact: PublicContact, crypto: CryptoProvider): Uint8Array;
export function decodeContact(bytes: Uint8Array, crypto: CryptoProvider): PublicContact;
export async function createLockedVault(identity: DerivedIdentity, username: string | null, createdAt: number, passphrase: string, crypto: CryptoProvider): Promise<Uint8Array>;
export async function unlockVault(bytes: Uint8Array, passphrase: string, crypto: CryptoProvider): Promise<{ masterEntropy: Uint8Array; username: string | null; createdAt: number }>;
export function encodeEmergencyRecovery(...): Uint8Array;
export function decodeEmergencyRecovery(...): { masterEntropy: Uint8Array; username: string | null; createdAt: number };
```

**Required tests:**

- Contact maximum encoded length is exactly `<= 912` bytes.
- Contact parser rejects wrong magic, version, suite, flags, key lengths, username length, checksum, trailing bytes, and over-limit input.
- Correct passphrase unlocks a vault; wrong passphrase produces one generic error.
- Corrupted vault header, salt, nonce, ciphertext, tag, inner checksum, and outer checksum fail.
- Emergency recovery round-trips but is represented by a distinct type that cannot be inserted into the contacts store.
- Vault creation never includes the mnemonic text; only the 32-byte entropy is encrypted.

**Commit:** `feat: add portable contact and private vault formats`

---

## Task 7: Implement QR generation, scanning, and card rendering

**Files:** all `src/qr/` modules, `public/qr-fixtures/`, QR tests.

**Interfaces:**

```ts
export type ClassifiedQr =
  | { kind: 'contact'; bytes: Uint8Array }
  | { kind: 'private-vault'; bytes: Uint8Array }
  | { kind: 'emergency-recovery'; bytes: Uint8Array };

export function contactToQrText(bytes: Uint8Array): string;
export function privateVaultToQrText(bytes: Uint8Array): string;
export function classifyQrText(text: string): ClassifiedQr;
export async function renderPublicContactCard(...): Promise<Blob>;
export async function renderPrivateIdentityCard(...): Promise<Blob>;
export async function decodeQrFromImage(source: Blob | ImageBitmap): Promise<string>;
```

**Required tests:**

- Maximum contact encodes in one QR with error correction H and version no greater than 40.
- Every exported PNG is at least 2,048 × 2,048.
- Public and private PNG fixtures decode back to exact bytes.
- Private QR uses module color `#5A0014`, white quiet zone, and crimson card background.
- QR survives these fixture transformations independently: resize to 1,024 px, JPEG quality 85, 2-degree rotation, 5% edge padding loss without quiet-zone crop, and mild Gaussian blur.
- A deliberately cropped quiet zone fails with a useful instruction rather than a crash.
- Scanner classifies private QR as private and displays a warning before any import action.

Do not put the username or secret payload in PNG metadata. The QR is the storage carrier.

**Commit:** `feat: add resilient public and private QR cards`

---

## Task 8: Implement message serialization, encryption, and armor

**Files:** `src/protocol/message.ts`, complete `armor.ts`, tests, protocol-vector scripts.

**Interfaces:**

```ts
export interface MessageAttachment {
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  filename: string;
  bytes: Uint8Array;
}

export interface EncryptMessageInput {
  sender: DerivedIdentity;
  senderUsername: string | null;
  recipient: PublicContact;
  text: string;
  attachments: MessageAttachment[];
  includeSenderContact: boolean;
  createdAt: number;
}

export async function encryptMessage(input: EncryptMessageInput, crypto: CryptoProvider): Promise<Uint8Array>;
export async function decryptMessage(envelope: Uint8Array, candidateIdentities: DerivedIdentity[], contacts: Map<string, PublicContact>, crypto: CryptoProvider): Promise<DecryptedMessage>;
export function armorMessage(envelope: Uint8Array, publicType: 'TEXT' | 'IMAGES' | 'MIXED', crypto: CryptoProvider): string;
export function dearmorMessage(input: string, crypto: CryptoProvider): Uint8Array;
```

**Required tests:**

- Two independently derived identities complete text round-trip.
- First-contact message embeds a reply contact and verifies its signature.
- Known-contact message omits the contact and is smaller.
- Changed outer header, recipient hint, KEM ciphertext, salt, nonce, encrypted payload, GCM tag, inner content, attachment digest, or signature fails.
- Missing END line produces the exact incomplete-copy message.
- Armor whitespace wrapping is accepted; non-Base64url characters are rejected.
- Text over 262,144 UTF-8 bytes, more than four files, unsupported MIME, unsafe filename, or total data over 8 MiB is rejected before encryption.
- Decrypted text containing HTML is rendered later as text, never interpreted.
- Property tests feed random truncations and bit flips into every parser; no test may hang or allocate beyond the specified limit.

Generate a committed `tests/fixtures/protocol-v1-vectors.json` containing fixed master entropies, public fingerprints, encoded-contact digests, envelope digest, and expected decrypted content. The verification script must run in CI.

**Commit:** `feat: add signed post-quantum message envelopes`

---

## Task 9: Implement IndexedDB and encrypted local history

**Files:** all `src/storage/` modules and storage tests.

**Acceptance behavior:**

- Vault store accepts only validated `WLV1` bytes.
- Contact store accepts only validated `WLC1` bytes.
- Stores use identity ID as canonical key.
- Importing identical contact bytes is idempotent.
- Same username with a different key is allowed but marked as a conflict in returned query data.
- History encryption uses a fresh 12-byte nonce per record and the identity-derived history key.
- History record AAD includes record ID, conversation ID, and creation time.
- Database migration failures switch to no-persistence mode without exposing vault bytes in logs.

**Required fake-indexeddb tests:** create, read, update nickname, verification state, delete, clear history, and database version migration.

**Commit:** `feat: add encrypted local persistence`

---

## Task 10: Implement identity session and automatic locking

**Files:** `src/session/IdentitySession.ts`, `autoLock.ts`, tests.

**Interface:**

```ts
export interface IdentitySessionState {
  status: 'locked' | 'unlocking' | 'unlocked';
  identityId: string | null;
  lastActivityAt: number | null;
}

export class IdentitySession {
  unlock(masterEntropy: Uint8Array, username: string | null): void;
  withIdentity<T>(operation: (identity: DerivedIdentity) => Promise<T> | T): Promise<T>;
  touch(): void;
  lock(): void;
  state(): IdentitySessionState;
}
```

**Required tests:**

- Locked session refuses cryptographic operations.
- Inactivity locks after 10 minutes using fake timers.
- Hidden document locks after 5 minutes.
- Explicit lock wipes owned byte arrays and clears references.
- An in-progress encryption either finishes atomically or is canceled; it must not leave a half-rendered plaintext/ciphertext state.

Document that wipe is best-effort in JavaScript.

**Commit:** `feat: add locked in-memory identity sessions`

---

## Task 11: Build the first-run identity and unlock UI

**Files:** `src/features/identity/`, related UI tests and `e2e/identity.spec.ts`.

**Required screens:** no-account explanation, optional username, generation, 24-word display, four-word confirmation, passphrase creation, private card export, public card export, remember-device choice, completion.

**Critical tests:**

- Cannot continue without confirming four correct word positions.
- Cannot finish before the private card export action has completed.
- Passphrase fields are not stored in component state longer than required and are cleared after vault creation.
- Emergency export requires two checkboxes and a three-second hold.
- Screen reader text announces private export danger.
- Reload with remembered vault shows unlock, not plaintext identity.

**Commit:** `feat: add safe identity onboarding and unlock flow`

---

## Task 12: Build contacts management and QR import UI

**Files:** `src/features/contacts/`, `e2e/contacts.spec.ts`, QR fixture E2E.

**Required behavior:**

- Camera permission is requested only after pressing Scan.
- Camera stream tracks stop when leaving the screen or closing the dialog.
- Image-upload scanning works without camera permission.
- Public contact import shows username, verification words, and fingerprint before save.
- Private/recovery QR scanned in Contacts is blocked with a red warning and never saved.
- Same-name/different-key import shows a key-conflict warning.
- Verification status requires explicit user action.
- Contact export reproduces a decodable public card.

**Commit:** `feat: add QR-based contact management`

---

## Task 13: Build encrypt and decrypt interfaces

**Files:** `src/features/encrypt/`, `src/features/decrypt/`, E2E round-trip tests.

**Required behavior:**

- Encrypt requires an unlocked identity and a selected contact.
- Live UTF-8 count, attachment count, and total bytes are visible.
- Unsupported images are rejected before reading entire contents where possible.
- Encryption runs outside the render loop and displays progress without exposing secret values.
- Copy, file download, and Web Share are capability-detected.
- Decrypt accepts paste and file input.
- Missing footer, wrong identity, corruption, and invalid signature have distinct safe messages.
- Decrypted text uses text nodes or textarea rendering only.
- Blob URLs are revoked when previews unmount.
- New embedded sender contact is not marked verified automatically.
- Optional local history toggle is off by default.

**E2E:** Create Alice and Bob from fixed test identities, exchange contacts, encrypt mixed text+PNG, transfer armor, decrypt, verify status, and compare attachment bytes.

**Commit:** `feat: add complete encrypt and decrypt workflows`

---

## Task 14: Add PWA, offline behavior, headers, and static deployments

**Files:** `src/sw.ts`, `public/manifest.webmanifest`, `public/_headers`, Vite config, GitHub workflows.

**Required behavior:**

- First successful online load precaches only versioned application assets.
- App reloads and creates/decrypts a test message with network disabled.
- Discovered service workers activate silently without force-reloading the active app; the newest activated build loads on the next manual reload or app reopen.
- Production build contains no runtime URL beginning with `http://` or `https://` except documentation text intentionally displayed to users.
- Cloudflare headers match Section 14.
- GitHub Pages build uses configured base path.
- `connect-src 'self'` is sufficient for same-origin static assets and service-worker updates; no third-party connection is attempted.

**E2E:** Playwright offline test loads a previously installed build, imports fixture vault/contact, encrypts, and decrypts with all requests blocked.

**Commit:** `feat: add offline PWA and hardened static deployment`

---

## Task 15: Add help, accessibility, and nontechnical instructions

**Files:** `src/features/help/`, `src/i18n/en.ts`, documentation files, accessibility tests.

**Required content:** Every statement in Sections 4.3 and 11.7, illustrated private/public card distinction, fingerprint verification walkthrough, no-account explanation, storage eviction warning, and security limitations.

**Required tests:**

- axe-core reports no serious or critical violations on every primary screen.
- Full keyboard-only completion of identity creation, contact import, encrypt, and decrypt.
- 200% text zoom does not hide actions.
- Private warning is understandable without color.
- Reduced-motion mode removes nonessential animation.

**Commit:** `docs: add accessible user guidance and security limits`

---

## Task 16: Performance, fuzzing, compatibility, and release hardening

**Files:** benchmark scripts, expanded property tests, `docs/release-checklist.md`, CI updates.

**Performance targets on the lower-memory Android test device:**

- Identity derivation under 2 seconds after scrypt-independent key generation.
- ML-KEM encapsulation or decapsulation under 1 second.
- Text-only encryption/decryption under 2 seconds.
- Vault unlock with fixed scrypt parameters under 4 seconds.
- Maximum 8 MiB message operation does not crash; UI remains responsive through worker/off-main-thread execution where required.
- Initial compressed JS transfer target under 350 KiB; hard ceiling 600 KiB without explicit review.

**Fuzz/property requirements:**

- At least 100,000 randomized cases across Base45, binary readers, contact parser, vault parser, armor parser, and envelope parser in CI’s extended job.
- Random truncation at every byte boundary for all protocol objects.
- Declared-length values at `0`, maximum, maximum+1, and `2³²-1`.
- Unicode filename and username normalization corpus.
- QR decode corpus with resizing, JPEG conversion, rotation, blur, and contrast variants.

**Release blockers:**

- No high/critical production dependency advisory.
- NIST ML-KEM vectors pass.
- WebLibre golden protocol vectors pass.
- Reproducible build hash matches in two clean environments.
- Manual iOS/Android matrix passes.
- Independent cryptographic/protocol review completed before claims beyond “experimental preview.”
- Security contact and coordinated-disclosure process published.

**Commit:** `test: complete WebLibre release hardening`

---

## 16. CI and release commands

The final project must expose:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings=0",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:property": "vitest run tests/property --testTimeout=120000",
    "test:e2e": "playwright test",
    "test:vectors": "tsx scripts/verify-protocol-vectors.ts",
    "verify": "npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:vectors && npm run build && npm run test:e2e"
  }
}
```

Add `tsx` as an exact development dependency when vector scripts are introduced.

A release is created only from a signed Git tag after `npm ci && npm run verify` succeeds in a clean environment.

---

## 17. Explicitly deferred features

Do not add these to protocol version 1:

- Groups or broadcast encryption.
- Global usernames or contact search.
- Key servers, DNS lookup, blockchain lookup, IPFS dependency, or URL short codes.
- Message relay or cloud mailbox.
- Password reset or recovery service.
- Full post-quantum signatures.
- Forward-secure double ratchet.
- Voice/video calls.
- Arbitrary file types.
- SVG rendering.
- HTML or Markdown message rendering.
- Automatic cloud backups.
- Browser-extension integration.
- Multi-device synchronization.
- QR-encoded full messages beyond small diagnostic fixtures.

The binary suite and version fields reserve room for later profiles without changing version-1 behavior.

---

## 18. Definition of done

WebLibre version 1 is complete only when all of the following are true:

- A new user can create a 24-word identity entirely offline.
- The user receives a clearly crimson private card and a clearly public contact card.
- The maximum valid public contact fits in one Version-40-or-smaller QR code at error correction H.
- iPhone and Android users can scan through camera or upload an image.
- Two users can exchange public cards, encrypt a text/image message, copy or save it, and decrypt it on another device.
- Armored messages clearly identify beginning, end, protocol version, suite, type, length, and digest.
- Truncated or damaged armor is detected before decryption.
- Optional browser persistence stores only encrypted private identity data.
- Public contacts and optional encrypted local context survive reloads.
- The site works from Cloudflare Pages and GitHub Pages, with Cloudflare documented as the hardened primary deployment.
- The app works offline after first load.
- No application-data request, analytics event, remote dependency, or backend storage occurs; network traffic is limited to same-origin static assets and update checks.
- All unit, property, protocol-vector, E2E, accessibility, and compatibility tests pass.
- The About screen states the exact security profile and limitations.
- The public release remains labeled experimental until independent review is complete.

---

## 19. Standards and implementation references

Use these as normative or implementation references during development:

- NIST FIPS 203, Module-Lattice-Based Key-Encapsulation Mechanism Standard.
- NIST FIPS 204, Module-Lattice-Based Digital Signature Standard, for understanding why ML-DSA is deferred from the compact profile.
- NIST FIPS 197, Advanced Encryption Standard.
- NIST SP 800-38D, Galois/Counter Mode.
- RFC 5869, HKDF.
- RFC 7914, scrypt.
- RFC 8032, Ed25519.
- RFC 9285, Base45.
- BIP39 mnemonic specification and English word list.
- ISO/IEC 18004 QR Code model 2 requirements, with DENSO WAVE capacity/error-correction guidance.
- W3C Web Cryptography API.
- MDN guidance for `getUserMedia`, IndexedDB, Blob URLs, Clipboard, and Web Share.
- The pinned dependency source repositories and their security/audit documentation.

When a reference conflicts with this protocol’s fixed byte layout, cryptographic primitives follow the standard while WebLibre framing follows this document. Any protocol-layout correction requires a new version or a documented pre-release breaking change before identities are publicly issued.
