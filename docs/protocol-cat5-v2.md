> **Authority:** Complete normative CAT-5/V2 wire and transport authority.
> **Target release:** `0.2.0-beta.1`
> **Status:** Sole create/write/encrypt format. V1 is decode/migration-only.
> **Depends on:** [legacy-v1-compatibility.md](legacy-v1-compatibility.md), [security-architecture.md](security-architecture.md), [testing-and-release.md](testing-and-release.md)

# CAT-5/V2 protocol

This document controls every newly created PPX artifact. All integers are
unsigned big-endian. Offsets are zero-based and lengths are bytes. Text is
strict UTF-8 in its required normalized form. `checksum16(X)` means
`SHA-512(X)[0..16)`. A checksum detects transfer damage; only AEAD and ML-DSA
authenticate content.

CAT-5/V2 uses `formatVersion = 0x02`, suite `0x02`, suite name `PPX-PQ-5`,
ML-KEM-1024, ML-DSA-87, HKDF-SHA-512, SHA-512, scrypt where stated, and
AES-256-GCM. There is no negotiation, classical fallback, mixed-suite mode, or
V1 writer. Unknown/mismatched version, suite, family, flags, length, or trailing
bytes fail closed.

## 1. Primitive sizes

| Value | Bytes |
| --- | ---: |
| Master entropy | 32 |
| ML-KEM-1024 public key | 1,568 |
| ML-KEM-1024 secret key | 3,168 |
| ML-KEM-1024 ciphertext | 1,568 |
| ML-KEM shared secret | 32 |
| ML-DSA-87 public key | 2,592 |
| ML-DSA-87 secret key | 4,896 |
| ML-DSA-87 signature | 4,627 |
| ML-DSA signing entropy | 32 |
| AES-256-GCM key | 32 |
| AES-GCM tag | 16 |
| Transfer checksum | 16 |

## 2. Identity and domain separation

HKDF-SHA-512 uses `SHA-512("PPX/IDENTITY/V2/SALT")` as salt and derives:

- 64 bytes under `PPX/IDENTITY/V2/ML-KEM-1024/KEYGEN-SEED`;
- 32 bytes under `PPX/IDENTITY/V2/ML-DSA-87/SIGNING-SEED`.

Fingerprint is the first 32 bytes of SHA-512 over
`PPX/IDENTITY/V2/FINGERPRINT || 0x02 || kemPublicKey || signingPublicKey`.
Identity ID is its first 20 bytes.

ML-KEM is the only key agreement. It produces a 32-byte shared secret and a
1,568-byte ciphertext. A fresh 32-byte salt feeds HKDF-SHA-512. Exact HKDF info
is `PPX/ENCRYPT/V2/ML-KEM-1024 || objectFamily || 0x02 || 0x02 ||
recipientFingerprint || SHA-512(mlKemCiphertext)`. Output is the 32-byte
AES-256-GCM key.

Object-family bytes are PPXC/contact `0x01`, PPXT/full text `0x02`,
PPXM/compact text `0x03`, PPXF/file `0x04`, PPXV/vault `0x05`, and
PPXR/recovery `0x06`. Family binding prevents cross-family decapsulation.

ML-DSA contexts are contact `PPX/CONTACT/V2`, full text
`PPX/TEXT/FULL/V2`, compact text `PPX/TEXT/COMPACT/V2`, and file manifest
`PPX/FILE/MANIFEST/V2`. Each signature uses fresh 32-byte signing entropy.

## 3. PPXC public contact

### Wire layout

| Offset | Length | Field |
| ---: | ---: | --- |
| 0 | 4 | ASCII `PPXC` |
| 4 | 1 | format version `0x02` |
| 5 | 1 | suite `0x02` |
| 6 | 1 | flags `0x00` |
| 7 | 1 | pseudonym length `N`, 1..48 |
| 8 | 8 | creation time |
| 16 | 1,568 | ML-KEM-1024 public key |
| 1,584 | 2,592 | ML-DSA-87 public key |
| 4,176 | `N` | normalized pseudonym UTF-8 |
| `4,176 + N` | 4,627 | ML-DSA self-signature |
| `8,803 + N` | 16 | transfer checksum |

Unsigned signature transcript is bytes `[0, 4,176 + N)`. Checksum transcript
is bytes `[0, 8,803 + N)`, including the signature. Total length is
`8,819 + N`: 8,820..8,867 bytes. Fingerprint and identity ID are derived, not
serialized.

Text transport is `PPX2:CONTACT:` plus canonical uppercase Base45, with at most
13,301 body characters. V2 contacts use `.ppxcontact` files or text. CAT-5
creates no contact QR.

## 4. PPXT and PPXM encrypted text

PPXT embeds a complete V2 sender PPXC. PPXM stores only sender fingerprint and
requires the exact validated V2 contact already saved in the unlocked session.

### Shared outer layout

| Offset | Length | Field |
| ---: | ---: | --- |
| 0 | 4 | ASCII `PPXT` or `PPXM` |
| 4 | 1 | format version `0x02` |
| 5 | 1 | suite `0x02` |
| 6 | 1 | flags: `0x00` raw or `0x01` gzip |
| 7 | 1,568 | ML-KEM-1024 ciphertext |
| 1,575 | 32 | HKDF salt |
| 1,607 | 12 | AES-GCM nonce |
| 1,619 | 4 | ciphertext length `C` |
| 1,623 | `C` | AES-GCM ciphertext including 16-byte tag |
| `1,623 + C` | 16 | transfer checksum |

The exact 1,623-byte header is AES-GCM AAD. Checksum transcript is
`header || ciphertext`. Total length is `1,639 + C`, capped at 300,000 bytes.
Minimum `C` is 13,524 for PPXT and 4,731 for PPXM. Empty canonical objects are
15,163 and 6,370 bytes respectively.

### PPXT full signed inner

Let `S` be encoded PPXC length and `P` stored payload length.

| Offset | Length | Field |
| ---: | ---: | --- |
| 0 | 4 | sender contact length `S` |
| 4 | `S` | canonical PPXC V2 |
| `4 + S` | 20 | recipient identity ID |
| `24 + S` | 1 | message ID length, exactly 16 |
| `25 + S` | 16 | message ID |
| `41 + S` | 8 | sent time |
| `49 + S` | 8 | created time |
| `57 + S` | 4 | original UTF-8 length |
| `61 + S` | `P` | raw UTF-8 or one gzip member |
| `61 + S + P` | 4,627 | ML-DSA signature |

Signature transcript is every preceding inner byte. Inner length is
`4,688 + S + P`; minimum is 13,508 bytes.

### PPXM compact signed inner

| Offset | Length | Field |
| ---: | ---: | --- |
| 0 | 32 | sender fingerprint |
| 32 | 20 | recipient identity ID |
| 52 | 16 | message ID |
| 68 | 8 | sent time |
| 76 | 8 | created time |
| 84 | 4 | original UTF-8 length |
| 88 | `P` | raw UTF-8 or one gzip member |
| `88 + P` | 4,627 | ML-DSA signature |

Signature transcript is every preceding inner byte. Inner length is
`4,715 + P`. Unknown or mismatched PPXM sender fails closed.

Original UTF-8, stored payload, and released plaintext are each capped at
262,144 bytes; signed inner is capped at 275,700 bytes. Writer uses gzip only
when savings are at least `max(64, ceil(originalLength * 0.10))`. Reader parses
and authenticates AES-GCM, verifies recipient and ML-DSA sender binding, then
performs bounded one-member decompression and fatal UTF-8 decoding. Decoded
length must equal the declared original length.

PPXT armor is exact: begin marker, `Version: 2`, `Suite: PPX-PQ-5`, decimal
byte length, lowercase 128-hex SHA-512 digest, blank line, unpadded base64url
wrapped at 72 characters, and end marker. Armor input cap is 406,000 characters.

## 5. PPXF encrypted file

### Fixed header

| Offset | Length | Field |
| ---: | ---: | --- |
| 0 | 4 | ASCII `PPXF` |
| 4 | 1 | format version `0x02` |
| 5 | 1 | suite `0x02` |
| 6 | 1 | flags `0x00` |
| 7 | 20 | recipient identity ID |
| 27 | 1,568 | ML-KEM-1024 ciphertext |
| 1,595 | 8 | nonce prefix |
| 1,603 | 32 | HKDF salt |
| 1,635 | 4 | declared data-chunk count |
| 1,639 | 4 | chunk size, exactly 1,048,576 |
| 1,643 | 8 | total plaintext file length |

Header length is exactly 1,651 bytes. File length is 0..104,857,600 bytes.
Chunk count is exactly `ceil(fileLength / 1,048,576)`, or zero for empty file.

### Records, nonce, and AAD

Each record is `chunkIndex:uint32 || plaintextLength:uint32 ||
ciphertextLength:uint32 || ciphertext`. Prefix length is 12 bytes.
`ciphertextLength = plaintextLength + 16`.

Data record indices are consecutive `0..declaredChunkCount-1`; each plaintext
length is the exact remaining chunk length. One terminal record follows with
index `0xffffffff` and manifest plaintext length 1..30,375. No record follows
the terminal record.

For every data or terminal record:

- nonce is `noncePrefix8 || uint32be(chunkIndex)`;
- `headerHash = SHA-512(canonicalHeader)`;
- AAD is `headerHash64 || uint32be(chunkIndex) ||
  uint32be(plaintextLength) || uint32be(declaredChunkCount) ||
  uint64be(totalFileLength)`, exactly 84 bytes.

### Signed terminal manifest plaintext

Let `S`, `F`, `M`, and `D` be sender-contact, filename, MIME, and caption byte
lengths.

| Offset | Length | Field |
| ---: | ---: | --- |
| 0 | 4 | ASCII `PPXF` |
| 4 | 1 | format version `0x02` |
| 5 | 1 | suite `0x02` |
| 6 | 4 | terminal index `0xffffffff` |
| 10 | 2 | sender contact length `S` |
| 12 | `S` | canonical PPXC V2 |
| `12 + S` | 20 | recipient identity ID |
| `32 + S` | 2 | filename length `F`, 1..255 |
| `34 + S` | `F` | normalized filename UTF-8 |
| `34 + S + F` | 1 | MIME length `M`, 0..127 |
| `35 + S + F` | `M` | normalized MIME UTF-8 |
| `35 + S + F + M` | 4 | caption length `D`, 0..16,384 |
| `39 + S + F + M` | `D` | normalized caption UTF-8 |
| `39 + S + F + M + D` | 8 | plaintext file length |
| `47 + S + F + M + D` | 4 | data-chunk count |
| `51 + S + F + M + D` | 64 | SHA-512 of full plaintext file |
| `115 + S + F + M + D` | 4,627 | ML-DSA signature |

Signature transcript is every preceding manifest byte. Manifest plaintext is
13,563..30,375 bytes. The terminal manifest is then encrypted as an ordinary
record using index `0xffffffff`, its nonce, and its AAD.

Final transfer checksum is
`SHA-512(canonicalHeader || every complete canonical record)[0..16)` and is the
last 16 bytes. Complete encoded cap is 104,892,470 bytes. Reader validates cap,
checksum, record order/sizes, every AEAD, signed manifest, recipient, file
length/chunk count, and full plaintext SHA-512 before releasing output. Legacy
V1 files are download-only and never receive inline preview.

## 6. PPXR unencrypted recovery

| Offset | Length | Field |
| ---: | ---: | --- |
| 0 | 4 | ASCII `PPXR` |
| 4 | 1 | format version `0x02` |
| 5 | 1 | suite `0x02` |
| 6 | 1 | flags `0x00` |
| 7 | 1 | pseudonym length `N`, 1..48 |
| 8 | 8 | creation time |
| 16 | 32 | master entropy |
| 48 | `N` | normalized pseudonym UTF-8 |
| `48 + N` | 16 | transfer checksum |

Checksum transcript is all preceding bytes. Total length is `64 + N`, 65..112
bytes. Text is `PPX2:RECOVERY:` plus uppercase Base45, maximum 168 body
characters. PPXR is unencrypted private identity authority. File, text/code,
24 words, PDF, and recovery QR are active recovery transports.

## 7. PPXV locked vault

### Outer layout

| Offset | Length | Field |
| ---: | ---: | --- |
| 0 | 4 | ASCII `PPXV` |
| 4 | 1 | format version `0x02` |
| 5 | 1 | suite `0x02` |
| 6 | 1 | flags `0x01` |
| 7 | 1 | KDF ID `0x01` |
| 8 | 8 | scrypt N, exactly 65,536 |
| 16 | 4 | scrypt r, exactly 8 |
| 20 | 4 | scrypt p, exactly 2 |
| 24 | 16 | scrypt salt |
| 40 | 12 | AES-GCM nonce |
| 52 | 4 | ciphertext length `C`, 58..105 |
| 56 | `C` | AES-GCM ciphertext including tag |
| `56 + C` | 16 | transfer checksum |

Exact 56-byte header is AES-GCM AAD. Checksum transcript is
`header || ciphertext`. Total length is `72 + C`, 130..177 bytes. Base45 body
is capped at 266 characters. Private text/QR prefix is `PPX2:PRIVATE:`.

### Vault inner plaintext

| Offset | Length | Field |
| ---: | ---: | --- |
| 0 | 32 | master entropy |
| 32 | 8 | creation time |
| 40 | 1 | pseudonym length `N`, 1..48 |
| 41 | `N` | normalized pseudonym UTF-8 |

Inner length is `41 + N`, 42..89 bytes; AES-GCM adds the 16-byte tag. Wrong
password and corruption share one safe error. PPXV transports are `.ppxvault`,
local storage, and encrypted private-vault text/QR. Public contact/message QR
does not exist.

## 8. Canonical parsing and allocation

Every parser checks encoded text/raw byte cap before decode/allocation, then
magic, exact version/suite/family, flags, fixed fields, declared lengths,
canonical normalization, checksum, exact end-of-input, AEAD, binding, and
signature in that order as applicable. Unknown fields, downgrade pairs,
V1/V2 mixtures, PPXT/PPXM family swaps, gaps/duplicate records, trailing bytes,
noncanonical base encodings, and decompression overflow fail closed. Owned
secret/transcript buffers are best-effort zeroized; browser physical erasure is
not guaranteed.

## 9. Transport and fragment authority

| Use | CAT-5/V2 create transport |
| --- | --- |
| Public contact | `.ppxcontact` or `PPX2:CONTACT:` text |
| Text message | PPXT armor or `#/m/` link carrying PPXT/PPXM |
| File | `.ppxfile` |
| Vault | `.ppxvault`, local storage, `PPX2:PRIVATE:` text/private vault QR |
| Recovery | `.ppxrecovery`, text/code, 24 words, PDF, recovery QR |

V2 message link fragment is `#/m/<BASE64URL>` where body is unpadded canonical
base64url of raw PPXT/PPXM and is capped before decode. New links use only the
canonical HTTPS GitHub Pages base; credentials and query are prohibited. An
incoming fragment is captured locally without navigating to its embedded host,
immediately replaced with same-origin `#/decrypt`, and retained only as one
bounded in-memory intent. It must never enter network requests/referrers,
history state, local/session storage, IndexedDB, Cache API keys/content,
service-worker messages/caches, diagnostics, logs, telemetry, or crash reports.

Legacy accepted links include `#/decrypt/qr/<BASE37>` and `#/m/<BASE64URL>`
carrying V1 PPXT or PPXQ. They follow the same no-navigation, early-scrub,
bounded-memory, and no-leak rules. V1 PPXQ also requires the exact V1 sender
contact under [legacy compatibility](legacy-v1-compatibility.md).

CAT-5 creates no contact or message QR. Recovery QR and encrypted private-vault
QR remain. No old app is required for supported V1 input.
