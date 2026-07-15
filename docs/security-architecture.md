> **Authority:** Chat NoControl documentation authority; this file normatively defines the security architecture for PPX Protocol v1.
> **Version:** 1.0-draft
> **Status:** Public beta channel / stable release unavailable / operational status is external
> **Depends on:** [protocol-v1.md](protocol-v1.md), [../Chat_NoControl_full_plan.md](../Chat_NoControl_full_plan.md), [threat-model.md](threat-model.md), [product-spec.md](product-spec.md), [design-spec.md](design-spec.md), [ux-content-spec.md](ux-content-spec.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# PPX Security Architecture

## 1. Security boundaries

All cryptographic operations must stay isolated from UI code and from storage adapters.

Required boundaries:

- UI code may request encryption, decryption, import, export, and validation.
- Protocol code owns canonical parsing, serialization, and byte layouts.
- Crypto code owns primitives and key derivation.
- Storage code may hold only encrypted vaults or public contacts.

The architecture must keep crypto replaceable so that a future implementation can swap providers without invalidating existing protocol objects.

## 2. Security claims

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

## 3. Primitive set

The required primitives are:

- SHA-512
- HKDF-SHA-512
- scrypt
- ML-KEM-512
- X25519
- Ed25519
- AES-256-GCM

The suite byte is `0x01`. The suite name is `PPX-HYBRID-1`.

## 4. CryptoProvider interface

The implementation must depend on an abstract provider with these exact capability names.

```ts
export interface CryptoProvider {
  deriveIdentity(masterEntropy: Uint8Array): Promise<DerivedIdentity>;
  createPublicContact(identity: DerivedIdentity, pseudonym: string, creationTime: bigint): PublicContact;
  parsePublicContact(bytes: Uint8Array): PublicContact;
  createHybridEncapsulation(params: {
    recipientFingerprint: Uint8Array;
    recipientKemPublicKey: Uint8Array;
    recipientX25519PublicKey: Uint8Array;
  }): HybridEncapsulation;
  encryptText(input: EncryptTextInput): Promise<EncryptedTextObject>;
  decryptText(input: DecryptTextInput): Promise<DecryptedTextOutput>;
  encryptFile(input: EncryptFileInput, hooks?: FileCryptoHooks): Promise<EncryptedFileObject>;
  encryptFileToBlob(input: EncryptFileInput, hooks?: FileCryptoHooks): Promise<EncryptedFileBlobOutput>;
  decryptFile(input: DecryptFileInput, hooks?: FileCryptoHooks): Promise<DecryptedFileOutput>;
  lockVault(input: LockVaultInput): Promise<LockedVaultObject>;
  unlockVault(input: UnlockVaultInput): Promise<DerivedIdentity>;
}

export interface RecoveryWordCodec {
  entropyToRecoveryWords(entropy32: Uint8Array): string[];
  recoveryWordsToEntropy(words: string[]): Uint8Array;
}
```

The provider interface is mandatory. UI code and storage code must not call concrete cryptographic library functions directly.

Encryption requests carry a request-owned `SenderSigningCapability`. The
provider validates its fingerprint and signing public key against the public
sender contact, uses its copied 32-byte Ed25519 seed for exactly one operation,
and wipes that copy on completion, error, or cancellation. The active identity
is never wiped by an encryption operation.

`createHybridEncapsulation` owns fresh ephemeral X25519 key generation,
ML-KEM-512 encapsulation, the random 32-byte salt, both shared secrets, and the
derived AES-256 key. Callers supply only the recipient fingerprint and public
keys. The provider wipes the ephemeral secret before returning; the encrypt
operation wipes returned shared-secret and AES-key arrays in `finally`.

The recovery-word codec is mandatory wherever the product exposes the 24-word recovery representation.

It must use the BIP39 English word list and checksum and must never use mnemonic-to-seed PBKDF2 for PPX key derivation.

## 5. Core data types

These types are normative.

```ts
export interface DerivedIdentity {
  suite: 0x01;
  creationTime: bigint;             // preserved by PPXV and PPXR; new local time only for word imports
  masterEntropy: Uint8Array;        // 32 bytes; secret
  kemPublicKey: Uint8Array;         // 800 bytes
  kemSecretKey: Uint8Array;         // secret, implementation-defined length
  x25519PublicKey: Uint8Array;      // 32 bytes
  x25519SecretKey: Uint8Array;      // 32 bytes; secret
  signingPublicKey: Uint8Array;     // 32 bytes
  signingSecretKey: Uint8Array;     // 32 bytes seed or equivalent secret form
  fingerprint: Uint8Array;          // 32 bytes
  identityId: Uint8Array;           // first 20 fingerprint bytes
  pseudonym: string;                // normalized display label
}

export interface PublicContact {
  magic: 'PPXC';
  formatVersion: 0x01;
  suite: 0x01;
  creationTime: bigint;
  pseudonym: string;
  kemPublicKey: Uint8Array;         // 800 bytes
  x25519PublicKey: Uint8Array;      // 32 bytes
  signingPublicKey: Uint8Array;     // 32 bytes
  selfSignature: Uint8Array;        // 64 bytes
  checksum: Uint8Array;             // 16 bytes
  fingerprint: Uint8Array;          // 32 bytes
  identityId: Uint8Array;           // first 20 fingerprint bytes
}

export interface HybridEncapsulation {
  suite: 0x01;
  recipientFingerprint: Uint8Array;  // 32 bytes
  salt: Uint8Array;                 // 32 bytes
  ephemeralX25519PublicKey: Uint8Array; // 32 bytes
  mlKemCiphertext: Uint8Array;      // 768 bytes
  x25519SharedSecret: Uint8Array;   // 32 bytes internal only
  mlKemSharedSecret: Uint8Array;     // 32 bytes internal only
  aes256Key: Uint8Array;            // 32 bytes internal only
}
```

`HybridEncapsulation` is an internal construction helper. The serialized object may omit internal fields, but the provider must still produce and consume them conceptually.

## 6. Exact key derivation

The identity derivation uses exact ASCII labels from [protocol-v1.md](protocol-v1.md).

Inputs:

- `masterEntropy`: exactly 32 bytes
- `salt`: `SHA-512(UTF8("PPX/IDENTITY/V1/SALT"))`, 64 bytes

Outputs:

```text
PPX/IDENTITY/V1/ML-KEM-512/KEYGEN-SEED   -> 64 bytes
PPX/IDENTITY/V1/X25519/RECEIVE-SECRET    -> 32 bytes
PPX/IDENTITY/V1/ED25519/SIGNING-SEED     -> 32 bytes
PPX/IDENTITY/V1/HISTORY-KEY              -> 32 bytes
```

The fingerprint label is:

```text
PPX/IDENTITY/V1/FINGERPRINT
```

The fingerprint input is only the suite byte and the three public keys. It must not include pseudonym, creation time, password material, or transport metadata.

Recovery words are only a reversible encoding of the 32-byte master entropy.

They must never be mixed with user data before key derivation.

## 7. Hybrid encryption architecture

### 7.1 Encapsulation inputs

The sender uses:

- Recipient ML-KEM-512 public key
- Recipient static X25519 public key
- Sender ephemeral X25519 key pair generated per item
- A random 32-byte salt

### 7.2 Shared-secret combination

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

This is a custom hybrid suite. It requires external cryptographic review before any security-sensitive public release.

### 7.3 AEAD

AES-256-GCM protects the text or file payload.

- Key length: 32 bytes
- Nonce length: 12 bytes unless a format-specific nonce construction is explicitly defined
- Tag length: 16 bytes

Associated data must bind the immutable outer header and any fields needed to prevent replay between incompatible objects.

## 8. Sender authentication

Sender authentication remains classical Ed25519.

Mandatory rule:

- The sender PPXC contact must be embedded inside the encrypted content.

Reason:

- A recipient can validate a sender signature even when the outer envelope does not expose sender metadata.
- Unknown-sender workflows can still authenticate the sender after decryption.

The outer object may omit stable sender metadata. The encrypted inner payload carries the sender contact and the sender signature.

See [Section 16.2](#162-text-contracts) for the exact `EncryptedTextObject` and `DecryptedTextOutput` contracts.

## 9. Vault architecture

The vault encrypts the master entropy and associated local fields.

Required vault KDF:

- `scrypt`
- `N = 65536`
- `r = 8`
- `p = 2`
- Salt length `16` bytes

Required vault AEAD:

- AES-256-GCM
- Nonce length `12` bytes

Vault unlock failures must not disclose whether the passphrase was wrong or the data was corrupted.

Post-login PPXV export is a separate re-authentication boundary. Before
verification, the DOM must contain only a non-secret placeholder, never a real
QR hidden with CSS. The existing vault-unlock worker verifies the entered
password, the derived fingerprint must match the active identity, and temporary
identity secrets are zeroized. One successful check enables the PPXV QR, QR PNG,
and `.ppxvault` download together; route leave, identity lock, or app background
resets the boundary. Onboarding recovery artifacts and public-contact exports
remain outside this gate.

See [Section 16.1](#161-vault-contracts) for the exact `LockedVaultObject` and `RecoveryObject` contracts.

Identity creation requires a matching browser-vault password before recovery artifacts are shown. The UI accepts only printable ASCII, allows internal spaces, rejects leading or trailing spaces, and limits the value to `256` bytes. The prepared `LockedVaultObject` remains transient until the user explicitly confirms the recommended, preselected IndexedDB option on the final wizard screen. Session-only completion discards that prepared vault.

The plaintext password may exist only in wizard-local transient memory through recovery-document generation. It may be rendered only in the private A4 print/PDF and must be cleared when the user leaves that screen. It must never enter IndexedDB, settings, URLs, logs, diagnostics, service-worker caches, application-wide state, the standalone private QR PNG, or the serialized `PPXR` recovery file.

The QR, serialized `PPXR`, recovery armor, and 24 English words are representations of the same master-entropy recovery authority. The A4 document may package those representations together with the separate plaintext vault password, but doing so does not alter `LockedVaultObject`, `RecoveryObject`, or any PPX wire bytes.

## 10. Text encryption workflow

Text encryption steps:

1. Normalize and validate the sender and recipient contacts.
2. Generate a fresh ephemeral X25519 key pair.
3. Run ML-KEM-512 encapsulation against the recipient public key.
4. Run X25519 against the recipient static public key and the ephemeral private key.
5. Combine the shared secrets and derive an AES-256 key with HKDF-SHA-512.
6. Build the signed inner payload with sender PPXC, recipient ID, timestamps, message ID, and plaintext text.
7. Encrypt the inner payload with AES-256-GCM.
8. Serialize the outer `PPXT` object and checksum it.

Decryption reverses the process and must fail closed on any invalid parse, checksum mismatch, AEAD failure, or signature failure.

For eligible text, adaptive PPXT v2 may gzip the complete already-signed inner
before AES-GCM. Version and flags are authenticated as AAD, decompression is
bounded to 264,000 bytes, and every decompression error fails closed before
plaintext release. Ciphertext length can reveal coarse information about input
length and repetition. The current manual local message workflow has no remote
request/response compression oracle. This compressor must never be reused for
attacker-chosen text combined with hidden secrets where repeated observable
ciphertext lengths could become an oracle.

## 11. File encryption workflow

Compact PPXQ messages reuse the hybrid encapsulation and AES-GCM primitives but
replace the embedded sender contact with its fingerprint. Decryption releases
plaintext only after canonical parsing, hybrid decapsulation, AEAD, exact saved
sender lookup, Ed25519 verification, recipient binding, bounded optional gzip,
length equality, and fatal UTF-8. Unknown sender, wrong identity, tampering, and
decompression failure fail closed. QR links carry ciphertext only after `#` and
are scrubbed immediately; settings persist, pending ciphertext does not.

File encryption steps:

1. Normalize the filename and optional caption.
2. Create one provider-owned hybrid encapsulation and immutable 884-byte header.
3. Process the file as `1048576`-byte chunks.
4. Hash and encrypt each chunk independently with AES-256-GCM.
5. Sign the terminal manifest commitment with the request-owned Ed25519 capability.
6. Encrypt the manifest as terminal record `0xffffffff`.
7. Serialize the records and append the outer transfer checksum.

The worker must preserve bounded memory by using `Blob.slice` and by composing `Blob` outputs instead of hoarding plaintext copies.

The browser WebCrypto API is buffer-oriented. The implementation must therefore avoid claiming true streaming if it only has chunked buffering.

See [Section 16.3](#163-file-contracts) for the exact `EncryptedFileObject`, `FileHeader`, `FileManifest`, and `ChunkRecord` contracts.

## 12. Error model

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
  | 'unsupported-compression'
  | 'invalid-passphrase'
  | 'corrupted-vault';
```

The user-facing vault unlock failure must collapse passphrase and corruption into a single generic message.

```ts
export interface RecoveryWordsImportInput {
  words: string[]; // exactly 24 valid English words after BIP39 normalization
  pseudonym: string; // user-chosen or re-entered; 1..48 UTF-8 bytes after normalization
  importedAt: bigint; // local metadata only; not the original creation time
}

export interface RecoveryWordsImportOutput {
  identity: DerivedIdentity;
  publicContact: PublicContact; // newly signed PPXC for the same fingerprint
  importedAt: bigint; // local metadata only; not the original creation time
}
```

Recovery-word import flow requirements:

- Recover the exact master entropy from the 24 words.
- Derive the same keys and fingerprint as the original identity.
- Require the user to choose or re-enter a valid pseudonym after word import.
- Create a new signed `PPXC` for the same fingerprint.
- Preserve the import timestamp only as local metadata.
- Never claim the import time is the original creation time.

## 13. Zeroization and side-channel policy

Zeroization must be best effort only.

Required policy:

- Wipe byte arrays after use when the runtime allows it.
- Clear the wizard's plaintext password, recovery-word presentation, recovery code, QR presentation, and recovery-document model when ownership leaves the secret screen; Back navigation must not recreate them.
- Wipe temporary identities and recovery payloads produced by QR/file practice on success, failure, cancellation, and component exit.
- Never assume JavaScript memory is fully scrubbed.
- Never claim constant-time behavior from a high-level runtime unless the primitive library explicitly provides it and the code path can preserve it.
- Treat side-channel resistance as limited and outside the security claim unless a release-specific review explicitly covers it.

## 14. Verification requirements

The implementation must include verification for:

- NIST known-answer vectors for ML-KEM-512, X25519, Ed25519, SHA-512, HKDF-SHA-512, scrypt, and AES-256-GCM.
- PPX golden vectors for `PPXC`, `PPXV`, `PPXR`, `PPXT`, and `PPXF`.
- 32-byte entropy to 24-word recovery round-trips and the inverse.
- Rejection of checksum-invalid recovery words.
- Rejection of invalid recovery words and invalid word counts.
- BIP39 NFKD canonicalization and lowercase single-space normalization for imported mnemonics.
- Same-entropy tests proving identical keys and fingerprint after recovery-word round-trip.
- Mutation tests that corrupt version bytes, suite bytes, lengths, flags, and checksums.
- Truncation tests on every object family.
- Property tests for round-trip parse/serialize behavior.
- Best-effort zeroization checks where feasible.
- Identity-creation checks proving QR and `.ppxrecovery` restore to the pending identity, four-word practice uses unique stable positions, and the plaintext password appears only in private print/PDF output.
- Storage checks proving no vault write occurs before the final explicit confirmation and session-only completion discards the prepared vault.
- Negative tests for duplicate fields and trailing bytes.

These tests are required because the implementation is custom and the format is intentionally strict; review evidence does not replace regression coverage.

## 15. Cross references

- [protocol-v1.md](protocol-v1.md)
- [threat-model.md](threat-model.md)
- [product-spec.md](product-spec.md)
- [design-spec.md](design-spec.md)
- [ux-content-spec.md](ux-content-spec.md)
- [testing-and-release.md](testing-and-release.md)
- [references.md](references.md)

## 16. Normative contracts

### 16.1 Vault contracts

```ts
export interface LockedVaultObject {
  magic: 'PPXV';
  formatVersion: 0x01;
  suite: 0x01;
  flags: number; // bit 0 set for encrypted vaults
  kdfId: 0x01;
  scryptN: 65536;
  scryptR: 8;
  scryptP: 2;
  salt: Uint8Array; // 16 bytes
  nonce: Uint8Array; // 12 bytes
  ciphertextLength: number;
  ciphertext: Uint8Array; // includes AES-GCM tag
  checksum: Uint8Array; // 16 bytes
}

export interface RecoveryObject {
  magic: 'PPXR';
  formatVersion: 0x01;
  suite: 0x01;
  flags: number;
  masterEntropy: Uint8Array; // 32 bytes
  creationTime: bigint;
  pseudonym: string;
  checksum: Uint8Array; // 16 bytes
}

export interface UnlockVaultInput {
  vault: LockedVaultObject;
  passphrase: string;
}

export interface LockVaultInput {
  identity: DerivedIdentity;
  passphrase: string;
}
```

### 16.2 Text contracts

```ts
export interface SenderSigningCapability {
  fingerprint: Uint8Array; // 32 bytes
  signingPublicKey: Uint8Array; // 32 bytes
  signingSecretKey: Uint8Array; // request-owned 32-byte Ed25519 seed
}

export interface EncryptTextInput {
  sender: PublicContact;
  senderSigningCapability: SenderSigningCapability;
  recipient: PublicContact;
  plaintext: string;
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
}

export interface DecryptTextInput {
  object: EncryptedTextObject;
  activeIdentity: DerivedIdentity;
}

export interface EncryptedTextObject {
  magic: 'PPXT';
  formatVersion: 0x01;
  suite: 0x01;
  flags: number;
  mlKemCiphertext: Uint8Array; // 768 bytes
  ephemeralX25519PublicKey: Uint8Array; // 32 bytes
  salt: Uint8Array; // 32 bytes
  nonce: Uint8Array; // 12 bytes
  ciphertextLength: number;
  ciphertext: Uint8Array;
  checksum: Uint8Array; // 16 bytes
}

export interface DecryptedTextOutput {
  senderContact: PublicContact;
  recipientId: Uint8Array; // 20 bytes
  messageId: Uint8Array;
  sentAt: bigint;
  createdAt: bigint;
  plaintext: string;
  signatureValid: true;
}
```

### 16.3 File contracts

```ts
export interface EncryptFileInput {
  sender: PublicContact;
  senderSigningCapability: SenderSigningCapability;
  recipient: PublicContact;
  file: Blob;
  filename: string;
  mimeHint: string;
  caption: string; // normalized 0..16384 UTF-8 bytes; empty string means absent
  fileLength: bigint;
}

export interface DecryptFileInput {
  object: EncryptedFileObject | Blob;
  activeIdentity: DerivedIdentity;
}

export interface FileCryptoHooks {
  isCancelled?: () => boolean;
  onProgress?: (input: {
    stage: 'parse' | 'encrypt' | 'decrypt' | 'sign' | 'serialize';
    completedBytes: bigint;
    totalBytes: bigint;
    chunkIndex?: number;
  }) => void;
  onPlaintextRetained?: (bytes: number) => void;
  onCiphertextRetained?: (bytes: number) => void;
}

export interface FileHeader {
  magic: 'PPXF';
  formatVersion: 0x01;
  suite: 0x01;
  flags: 0;
  recipientId: Uint8Array; // 20 bytes
  mlKemCiphertext: Uint8Array; // 768 bytes
  ephemeralX25519PublicKey: Uint8Array; // 32 bytes
  noncePrefix: Uint8Array; // 8 bytes
  salt: Uint8Array; // 32 bytes
  declaredChunkCount: number;
  chunkSize: 1048576;
  totalFileLength: bigint;
}

export interface ChunkRecord {
  chunkIndex: number; // 0..0xfffffffe; 0xffffffff reserved for terminal manifest
  plaintextLength: number;
  ciphertext: Uint8Array; // includes AES-GCM tag
}

export interface FileManifest {
  magic: 'PPXF';
  formatVersion: 0x01;
  suite: 0x01;
  chunkIndex: 0xffffffff;
  senderContact: PublicContact;
  recipientId: Uint8Array; // 20 bytes
  filename: string;
  mimeHint: string;
  caption: string; // normalized 0..16384 UTF-8 bytes; empty string means absent
  fileLength: bigint;
  chunkCount: number;
  fullPlaintextDigest: Uint8Array; // 64 bytes
  signature: Uint8Array; // 64 bytes
}

export interface EncryptedManifestRecord {
  chunkIndex: 0xffffffff;
  plaintextLength: number;
  ciphertext: Uint8Array; // plaintext length plus 16-byte GCM tag
}

export interface EncryptedFileObject {
  header: FileHeader;
  chunks: ChunkRecord[];
  manifest: EncryptedManifestRecord;
  checksum: Uint8Array; // trailing 16 bytes
}

export interface EncryptedFileBlobOutput {
  blob: Blob;
  plaintextLength: bigint;
  encodedLength: bigint;
}

export interface DecryptedFileOutput {
  senderContact: PublicContact;
  recipientId: Uint8Array; // 20 bytes
  filename: string;
  mimeHint: string;
  caption: string; // normalized 0..16384 UTF-8 bytes; empty string means absent
  fileLength: bigint;
  blob: Blob;
  digestValid: true;
  signatureValid: true;
}
```

The canonical fixed header is 884 bytes. All integers are unsigned big-endian.
It contains, in order: `PPXF`, version, suite, flags, recipient ID, ML-KEM-512
ciphertext, ephemeral X25519 public key, nonce prefix, salt, declared chunk
count, chunk size, and total file length. Filename, MIME hint, caption, sender
contact, digest, and signature exist only inside the encrypted manifest.

Each data and terminal record serializes `uint32be(chunkIndex)`,
`uint32be(plaintextLength)`, `uint32be(ciphertext length)`, and ciphertext plus
its GCM tag. Data indexes are contiguous from zero. The final record uses
`0xffffffff`; no record follows it. The encrypted manifest plaintext is capped
at 18000 bytes.

The final 16 bytes are exactly:

```text
SHA-512(canonicalHeader || allCanonicalDataRecords || canonicalTerminalRecord)[0..16)
```

This checksum is verified before decapsulation. It detects transfer damage and
does not replace record AEAD or the manifest signature.

### 16.4 Worker contracts

```ts
export type PPXWorkerRequest =
  | {
      kind: 'encrypt-text';
      requestId: string;
      input: EncryptTextInput;
    }
  | {
      kind: 'decrypt-text';
      requestId: string;
      input: DecryptTextInput;
    }
  | {
      kind: 'encrypt-file';
      requestId: string;
      input: EncryptFileInput;
    }
  | {
      kind: 'decrypt-file';
      requestId: string;
      input: DecryptFileInput;
    }
  | {
      kind: 'unlock-vault';
      requestId: string;
      input: UnlockVaultInput;
    }
  | {
      kind: 'lock-vault';
      requestId: string;
      input: LockVaultInput;
    }
  | {
      kind: 'cancel';
      requestId: string;
    };

export type PPXWorkerEvent =
  | {
      kind: 'progress';
      requestId: string;
      stage: 'parse' | 'derive' | 'encrypt' | 'decrypt' | 'sign' | 'serialize';
      completedBytes: bigint;
      totalBytes: bigint;
      chunkIndex?: number;
    }
  | {
      kind: 'completed';
      requestId: string;
      result:
        | EncryptedTextObject
        | EncryptedFileObject
        | EncryptedFileBlobOutput
        | LockedVaultObject
        | DerivedIdentity;
    }
  | {
      kind: 'completed';
      requestId: string;
      result: DecryptedTextOutput | DecryptedFileOutput;
    }
  | {
      kind: 'error';
      requestId: string;
      code: PPXSafeWorkerError;
    }
  | {
      kind: 'cancelled';
      requestId: string;
    };

export type PPXSafeWorkerError = PPXParseError | PPXCryptoError;
```

The worker contracts are the only sanctioned message shapes between the main thread and crypto workers. The implementation must not add ad hoc message kinds without updating this section and [protocol-v1.md](protocol-v1.md).

`EncryptedFileBlobOutput` is the bounded-memory worker transport for encrypted
files. `DecryptFileInput.object` accepts a `Blob` so a worker can perform a
checksum pass, parse records with `Blob.slice`, and decrypt one chunk at a time.
This is a transport and memory-safety correction only; it does not change the
canonical PPXF wire format represented by `EncryptedFileObject`.

No completed decrypt event, output `Blob`, preview URL, filename, caption, MIME hint, or downloadable content may be released to the main thread until every chunk AEAD, terminal manifest AEAD, file length, full SHA-512 digest, and Ed25519 signature have succeeded. On any error or cancel, discard partial output and wipe best effort.
