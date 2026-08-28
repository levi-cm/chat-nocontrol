> **Authority:** Normative CAT-5/V2 security architecture.
> **Target release:** `0.2.0-beta.1`
> **Depends on:** [protocol-cat5-v2.md](protocol-cat5-v2.md), [legacy-v1-compatibility.md](legacy-v1-compatibility.md), [threat-model.md](threat-model.md), [testing-and-release.md](testing-and-release.md)

# Security architecture

## Boundaries

- UI requests operations; it does not call primitives directly.
- Protocol modules own canonical codecs, bounds, and version/suite rejection.
- Crypto/provider modules own ML-KEM-1024, ML-DSA-87, HKDF-SHA-512,
  SHA-512, AES-256-GCM, scrypt, entropy, capabilities, and zeroization.
- Dedicated workers isolate long operations and cancellation.
- Storage accepts V2 encrypted vaults, validated V2 public contacts, and
  nonsensitive settings only.
- Service worker caches versioned shell assets only, never user artifacts.

CAT-5/V2 (`0x02/0x02`, `PPX-PQ-5`) is sole create/write/encrypt provider.
Legacy suite-1 code is a separate bounded reader/migrator with no write API.

## Claims

Implemented design claims are limited to:

- ML-KEM-1024 key establishment and ML-DSA-87 sender signatures;
- AES-256-GCM content confidentiality/integrity;
- exact domain and object-family separation;
- canonical, size-bounded parsing and decompression;
- fail-closed rejection of downgrade, mixed-suite, unknown flags, malformed
  lengths, family swaps, failed AEAD, and failed signatures;
- local-only processing with no application backend.

It does not claim forward secrecy, ratcheting, metadata protection from chosen
transport, endpoint security, secure deletion, anonymity, security proof,
independent-review completion, or guaranteed long-horizon/quantum safety.

## Capabilities and secret lifetime

Decryption receives only request-scoped decapsulation capability copies.
Encryption receives request-scoped signing capability copies. ML-KEM shared
secret, HKDF transcript, AES key, signing secret copy, master entropy copy,
temporary V1 identity, plaintext chunk, and cancellation state are owned by
one operation and best-effort zeroized in all terminal paths. Active identity
is not destroyed by an ordinary operation.

An exact V1 PPXQ sender contact is a distinct session capability: it is
decrypt-only, memory-only, never persisted, and may remain for the current
unlocked identity session so more messages from that legacy sender can be
decrypted. Each worker request owns and erases its copy after success, failure,
cancellation, or worker error. The session copy is cleared on lock, identity
replacement/import/deletion, erase-all, session teardown, reload, or tab close.

Browser memory cannot guarantee physical erasure. Documents and UI must not
claim otherwise.

## Authentication order

Readers enforce byte/text cap before allocation, parse canonical header, verify
version/suite/family/flags/length/checksum, decapsulate, authenticate AES-GCM,
verify recipient/sender/manifest binding and ML-DSA signature, then release
bounded plaintext. Gzip is decompressed only after AEAD/signature gates and is
limited to declared 262,144-byte UTF-8 length. File output is released only
after complete ordered manifest verification.

## Contacts and transports

V2 PPXC files/text are validated before persistence. PPXM requires an exact
saved V2 fingerprint; PPXT embeds sender contact. V2 creates no contact/message
QR. Recovery QR remains. V1 PPXQ sender PPXC is temporary, decrypt-only,
memory-only for the unlocked identity session, and never trusted as a persisted
V2 contact.

## Canonical link privacy

Writers emit only canonical HTTPS links under
`https://levi-cm.github.io/chat-nocontrol/`. Readers capture a bounded fragment
locally and never navigate to any URL, origin, or host encoded inside it. Before
parsing, they replace browser history with the same-origin neutral
`#/decrypt` route and remove query data. Message bodies, fragments, temporary
contacts, and decrypted content must not enter HTTP requests or referrers,
history state, logs, diagnostics, telemetry/crash reports, Web Storage,
IndexedDB, Cache Storage, or service-worker caches.

## Vault and recovery

PPXV uses scrypt `N=65,536`, `r=8`, `p=2` plus AES-256-GCM and generic
wrong-password-or-corruption errors. PPXR, recovery code, recovery QR, recovery
PDF, and 24 words expose equivalent private recovery authority. They are not
protected by vault password. Migration derives V2 identity from recovered
master entropy and emits only V2 artifacts.

## PWA and deployment

Service-worker activation exposes no update UI. An exact same-version client is
not interrupted. A legacy or different-version client receives one bounded,
same-origin/scope CAT5 navigation. Only allowlisted bounded fragments cross the
navigation; CAT5 captures them in memory and scrubs URL plus fragment-bearing
history before rendering. No payload enters requests, persistent storage,
caches, or diagnostics. Canonical hosting is GitHub Pages; CSP meta is
defense-in-depth, not equivalent to response headers. Release/deployment claims
require exact evidence in [testing contract](testing-and-release.md).

## Legacy V1 PPXF checker appendix

This literal contract exists only to keep decode-only V1 PPXF parsing and its
conformance checker exact. It authorizes no V1 writer, encryption, preview, or
new artifact. CAT-5/V2 PPXF remains controlled by
[protocol-cat5-v2.md](protocol-cat5-v2.md).

```ts
export interface FileHeader {
  magic: "PPXF";
  formatVersion: 0x01;
  suite: 0x01;
  flags: 0;
  recipientId: Uint8Array;
  mlKemCiphertext: Uint8Array;
  ephemeralX25519PublicKey: Uint8Array;
  noncePrefix: Uint8Array;
  salt: Uint8Array;
  declaredChunkCount: number;
  chunkSize: 1048576;
  totalFileLength: bigint;
}

export interface EncryptedManifestRecord {
  chunkIndex: 0xffffffff;
  plaintextLength: number;
  ciphertext: Uint8Array;
}

export interface EncryptedFileObject {
  header: FileHeader;
  chunks: ChunkRecord[];
  manifest: EncryptedManifestRecord;
  checksum: Uint8Array;
}
```
