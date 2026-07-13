# CryptoProvider and PPXF contract correction design

> **Date:** 2026-07-13
> **Status:** approved by user
> **Scope:** Correct the normative provider, worker, and PPXF contracts without changing PPX-HYBRID-1 primitives, security claims, limits, or backend-free deployment.

## 1. Problem and decision

Three normative gaps currently prevent a conforming implementation:

1. `EncryptTextInput` and `EncryptFileInput` provide a public sender contact but no sender signing capability.
2. `createHybridEncapsulation` receives public outputs but none of the secrets required to derive the hybrid key.
3. PPXF has no transport fields for hybrid encapsulation, represents the terminal manifest as plaintext, and has no canonical outer checksum position.

The approved correction uses request-scoped signing capability, provider-owned encapsulation, an encrypted terminal-manifest record, and a trailing checksum over all preceding canonical PPXF bytes. No hidden identity state, recoverable public-key secret, ad hoc worker message, backend, or relaxed validation is introduced.

## 2. Approaches considered

### A. Request-scoped capabilities and provider-owned encapsulation — selected

Each encryption request carries only the sender fields required to authenticate the public contact and sign the inner commitment. The provider generates the ephemeral X25519 key pair, ML-KEM encapsulation, random salt, and derived hybrid key internally. Workers remain stateless between requests.

Benefits: explicit authority, minimum persistent secret exposure, deterministic ownership, no hidden state, straightforward cancellation and zeroization.

### B. Stateful worker identity initialization — rejected

An `initialize-identity` worker request could retain the active identity for later encryption requests. This reduces repeated structured clones but creates hidden long-lived worker secret state, complicates lock/rotation/cancel behavior, and adds an unnecessary message lifecycle.

### C. Caller-supplied shared secrets — rejected

The main thread could compute ML-KEM/X25519 shared secrets and pass them to the provider. This violates the provider boundary and expands secret exposure into UI orchestration.

## 3. Corrected provider and request contracts

Add a narrow signing capability:

```ts
export interface SenderSigningCapability {
  fingerprint: Uint8Array; // 32 bytes
  signingPublicKey: Uint8Array; // 32 bytes
  signingSecretKey: Uint8Array; // 32-byte Ed25519 seed
}
```

`EncryptTextInput` and `EncryptFileInput` gain:

```ts
senderSigningCapability: SenderSigningCapability;
```

Before signing, the provider must constant-time compare the capability fingerprint and signing public key with `sender.fingerprint` and `sender.signingPublicKey`. Mismatch returns `invalid-signature`. The worker zeroizes its cloned signing secret after completion, error, or cancellation. The active identity held by the UI is not transferred wholesale for encryption.

Request construction copies the 32-byte signing seed. Worker/provider cleanup wipes only that request-owned copy, never the active identity's caller-owned seed.

Correct `createHybridEncapsulation` to own encapsulation:

```ts
createHybridEncapsulation(params: {
  recipientFingerprint: Uint8Array;
  recipientKemPublicKey: Uint8Array;
  recipientX25519PublicKey: Uint8Array;
}): HybridEncapsulation;
```

The provider generates a fresh 32-byte ephemeral X25519 secret, derives its public key, performs ML-KEM-512 encapsulation, computes the X25519 shared secret, generates a fresh 32-byte salt, and derives the AES-256 key with the existing `PPX/ENCRYPT/V1/HYBRID` construction. It wipes the ephemeral secret before returning. The encrypt operation wipes the returned shared-secret and AES-key arrays in a `finally` block. Serialized PPXT/PPXF output contains only the public encapsulation values and salt.

The existing `encrypt-text` and `encrypt-file` `PPXWorkerRequest` variants remain the only encryption message kinds. Their corrected input types now carry the required request-scoped capability; no identity-initialization message is added.

## 4. Corrected PPXF public types

Outer filename, MIME hint, and caption fields are removed from `FileHeader`. They exist only inside the encrypted manifest so an unauthenticated parser cannot expose them.

```ts
export interface FileHeader {
  magic: "PPXF";
  formatVersion: 0x01;
  suite: 0x01;
  flags: 0;
  recipientId: Uint8Array; // 20 bytes
  mlKemCiphertext: Uint8Array; // 768 bytes
  ephemeralX25519PublicKey: Uint8Array; // 32 bytes
  noncePrefix: Uint8Array; // 8 bytes
  salt: Uint8Array; // 32 bytes
  declaredChunkCount: number; // uint32
  chunkSize: 1048576;
  totalFileLength: bigint; // uint64
}

export interface EncryptedManifestRecord {
  chunkIndex: 0xffffffff;
  plaintextLength: number;
  ciphertext: Uint8Array; // plaintextLength + 16-byte GCM tag
}

export interface EncryptedFileObject {
  header: FileHeader;
  chunks: ChunkRecord[];
  manifest: EncryptedManifestRecord;
  checksum: Uint8Array; // 16 bytes
}
```

`FileManifest` remains the authenticated plaintext shape used only inside crypto/file modules and after successful decryption. It is never returned or rendered before manifest AEAD, full digest, length, chunk count, recipient ID, and signature validation all succeed.

## 5. Canonical PPXF byte layout

All integers are unsigned big-endian. Text is normalized UTF-8. No optional or duplicate fields exist.

### 5.1 Header

| Order | Field | Bytes |
| ---: | --- | ---: |
| 1 | ASCII `PPXF` | 4 |
| 2 | format version | 1 |
| 3 | suite | 1 |
| 4 | flags | 2 |
| 5 | recipient ID | 20 |
| 6 | ML-KEM-512 ciphertext | 768 |
| 7 | ephemeral X25519 public key | 32 |
| 8 | nonce prefix | 8 |
| 9 | salt | 32 |
| 10 | declared chunk count | 4 |
| 11 | chunk size | 4 |
| 12 | total file length | 8 |

The fixed canonical header is 884 bytes. Flags must equal zero. Chunk size must equal `1048576`. Declared chunk count must equal `ceil(totalFileLength / 1048576)`, with zero bytes producing zero data chunks.

### 5.2 Data and terminal records

Every record uses:

| Order | Field | Bytes |
| ---: | --- | ---: |
| 1 | chunk index | 4 |
| 2 | plaintext length | 4 |
| 3 | ciphertext length | 4 |
| 4 | ciphertext including GCM tag | declared ciphertext length |

For data records, ciphertext length must equal plaintext length plus 16. Data indexes are contiguous from zero and strictly ordered. Every non-final data plaintext length is exactly `1048576`; the final data length matches the remaining total, including zero only when no data records exist.

The terminal record is last, uses index `0xffffffff`, and follows the same record layout. Its ciphertext length equals encoded manifest plaintext length plus 16. No records may follow it.

### 5.3 Trailing checksum

The final 16 bytes are:

```text
SHA-512(canonicalHeader || allCanonicalDataRecords || canonicalTerminalRecord)[0..16)
```

The checksum is verified before hybrid decapsulation or any AEAD operation. It detects transfer damage only and does not replace AEAD or signatures.

## 6. Nonces, AAD, and encrypted manifest

Record nonce:

```text
noncePrefix[8] || uint32be(chunkIndex)
```

AAD for every data or terminal record:

```text
SHA-512(canonicalHeader) ||
uint32be(chunkIndex) ||
uint32be(plaintextLength) ||
uint32be(declaredChunkCount) ||
uint64be(totalFileLength)
```

The manifest plaintext canonical order is:

1. ASCII `PPXF`, format version, suite, and terminal index `0xffffffff`.
2. `uint16be` sender PPXC byte length, then canonical PPXC bytes.
3. Recipient ID, 20 bytes.
4. `uint16be` filename byte length and normalized/sanitized filename, at most 255 bytes.
5. `uint8` MIME-hint byte length and sanitized ASCII MIME hint, at most 127 bytes.
6. `uint32be` caption byte length and normalized caption, at most 16384 bytes.
7. File length `uint64be`, chunk count `uint32be`, full plaintext SHA-512 digest, and Ed25519 signature.

The signature is over the preceding manifest commitment fields excluding the signature, prefixed with exact ASCII domain `PPX/FILE/V1/MANIFEST-SIGNATURE`. The encoded manifest is capped at 18000 bytes before AEAD allocation.

## 7. Encryption, decryption, and worker flow

Encryption validates all limits first, computes the provider-owned hybrid encapsulation once, builds the immutable header, then processes input with `Blob.slice` one chunk at a time. Each plaintext chunk is hashed, encrypted, wiped, and appended as a ciphertext part. After the last chunk, the worker signs and encrypts the manifest, computes the trailing checksum, and emits completion. Cancellation discards partial parts and wipes request-scoped secrets.

Decryption parses lengths and verifies the checksum before decapsulation. It requires exact record order and sizes, decrypts each data record into private worker-held Blob parts while hashing, then decrypts and parses the terminal manifest. Only after recipient ID, metadata normalization, file length, chunk count, digest, and Ed25519 signature pass does it compose and emit the output Blob and metadata. Any failure collapses to a safe PPX error and releases no partial output.

## 8. UI and compatibility behavior

The existing explicit file-unavailable state is replaced with local file encrypt/decrypt flows after PPXF tests pass. UI uses one recipient, enforces the 100 MiB limit before worker allocation, exposes progress/cancel, and never previews unvalidated content. Image/audio/video preview uses local Blob URLs revoked on replacement, lock, navigation, and unmount. Other MIME types use download-only handling.

This is a protocol draft correction. No backward PPXF compatibility is required because no conforming PPXF implementation or golden fixture has been released. Existing PPXC, PPXV, PPXR, and PPXT version-1 bytes remain unchanged.

## 9. Tests and release evidence

TDD adds failing tests first for:

- request-scoped signing capability and provider-owned encapsulation;
- exact header/record/manifest/checksum golden bytes;
- checksum corruption, AEAD corruption, truncation, reordering, duplicate/missing chunks, and trailing bytes;
- 0-byte, 1-byte, chunk-boundary, and 100 MiB file limits;
- cancel with zero output, bounded one-chunk plaintext retention, and secret zeroization;
- EN/DE file UI, unknown sender, preview/download, Blob URL cleanup, mobile/desktop reflow, accessibility, offline, and no-network behavior.

Release requires fresh `npm run verify`, the complete five-project Playwright matrix, accessibility, network-denial, offline, visual QA, dependency audit, SBOM, reproducibility, build, clean staged diff review, an initial `main` commit, and a signed `v0.1.0-beta.1` tag. Push occurs only after local commit/tag verification and a final remote-main ancestry check. GitHub Pages remains workflow-driven and static; no backend, analytics, telemetry, or remote assets are added.

## 10. Security status

The suite remains custom and unaudited. This correction makes the documented construction implementable; it does not claim independent cryptographic review, forward secrecy, ratcheting, quantum-proof security, secure deletion, or protection from a compromised browser/deployment.
