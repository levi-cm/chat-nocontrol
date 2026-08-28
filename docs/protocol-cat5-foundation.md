> **Authority:** Normative CAT-5/V2 foundation summary.
> **Status:** Active CAT-5/V2 write format. V1 is confined to the read and
> private-recovery boundary defined by
> [legacy V1 compatibility](legacy-v1-compatibility.md).

# PPX-PQ-5 foundation summary

Complete wire, domain-separation, size, parser, and transport authority now
lives in [protocol-cat5-v2.md](protocol-cat5-v2.md). If this summary differs,
that document wins.

Suite `0x02` is named `PPX-PQ-5`. Version `0x02` identities contain one
32-byte master entropy value, ML-KEM-1024 keys, ML-DSA-87 keys, fingerprint,
identity ID, pseudonym, and creation time. They contain no X25519 or Ed25519
keys. This foundation exposes no downgrade or dual/weak mode.

CAT-5/V2 is the sole identity, public-contact, encryption, and sending format.
The isolated V1 reader is not part of this provider and cannot emit artifacts.

## Identity derivation

HKDF-SHA-512 uses `SHA-512("PPX/IDENTITY/V2/SALT")` as salt. It derives:

- 64 bytes with `PPX/IDENTITY/V2/ML-KEM-1024/KEYGEN-SEED`
- 32 bytes with `PPX/IDENTITY/V2/ML-DSA-87/SIGNING-SEED`

Fingerprint is the first 32 bytes of SHA-512 over
`PPX/IDENTITY/V2/FINGERPRINT || 0x02 || kemPublicKey || signingPublicKey`.
Identity ID is its first 20 bytes.

## Encapsulation

ML-KEM-1024 is the only key agreement. HKDF-SHA-512 derives the 32-byte
AES-256 key from the ML-KEM shared secret and a fresh 32-byte salt. Info is
`PPX/ENCRYPT/V2/ML-KEM-1024 || objectFamily || 0x02 || 0x02 ||
recipientFingerprint || SHA-512(mlKemCiphertext)`. Object families have unique
one-byte discriminators: contact `0x01`, text `0x02`, compact text/PPXM `0x03`,
file `0x04`, vault `0x05`, and recovery `0x06`. `0x03` does not imply message
QR transport. Owned shared-secret and transcript buffers are erased after
derivation.

## Public contact

PPXC V2 stores magic, version `0x02`, suite `0x02`, zero flags, one-byte
pseudonym length, creation time, 1,568-byte ML-KEM public key, 2,592-byte
ML-DSA public key, UTF-8 pseudonym, 4,627-byte randomized self-signature, and
16-byte checksum. ML-DSA uses FIPS 204 context `PPX/CONTACT/V2` and an explicit
32-byte `extraEntropy` value.

Binary length is exactly `8819 + pseudonymBytes`, at most 8,867 bytes. Optional
text transport is `PPX2:CONTACT:` plus canonical uppercase Base45, at most
13,301 Base45 characters. No QR generation or camera path is part of this
foundation. Parser accepts only V2 suite/version and canonical bounded fields.

## Encrypted text objects

PPXT is the full-contact form; PPXM is the compact saved-contact form. Both use
version `0x02`, suite `0x02`, flags `0x00` for raw UTF-8 bytes or `0x01` for
gzip, a 1,568-byte ML-KEM ciphertext, 32-byte salt, 12-byte AES-GCM nonce,
four-byte ciphertext length, ciphertext, and 16-byte transfer checksum. No
X25519 field exists. Their canonical outer header is 1,623 bytes and is the
AES-GCM AAD. The transfer checksum is not an authentication substitute.

The full signed inner uses `uint32 senderLength || sender PPXC V2 ||
recipientId20 || uint8 16 || messageId16 || sentAt8 || createdAt8 ||
originalUtf8Length4 || storedPayload || signature4627`. With a one-byte sender
pseudonym, its empty size is 13,508 bytes and its encrypted PPXT object is
exactly 15,163 bytes. ML-DSA context is `PPX/TEXT/FULL/V2`.

The compact signed inner uses `senderFingerprint32 || recipientId20 ||
messageId16 || sentAt8 || createdAt8 || originalUtf8Length4 || storedPayload ||
signature4627`. Its empty size is 4,715 bytes and its encrypted PPXM object is
exactly 6,370 bytes. ML-DSA context is `PPX/TEXT/COMPACT/V2`. PPXM resolves the
fingerprint only against already-saved validated V2 contacts; unknown senders
fail closed.

Signatures receive explicit fresh 32-byte entropy and cover canonical metadata
plus stored payload. ML-KEM KDF object-family binding distinguishes PPXT from
PPXM. Writers gzip plaintext bytes only when savings meet
`max(64, ceil(originalLength * 0.10))`. Readers authenticate AES-GCM, validate
recipient and sender binding, and verify ML-DSA before bounded decompression and
strict UTF-8 release. Decompressed plaintext is capped at 262,144 bytes and
must exactly match `originalUtf8Length`.

Full PPXT copy armor declares `Version: 2`, `Suite: PPX-PQ-5`, byte length, and
SHA-512 digest. Additive `#/m/<BASE64URL>` links accept only PPXT/PPXM V2 and
are scrubbed from the address bar before parsing. PPXM has no armor. Neither
format adds PPXQ, Base37, QR generation, or a QR parser.
