> **Authority:** Normative additive PPX-PQ-5 internal foundation contract.
> **Status:** Additive internal protocol foundation. Current user interface and
> V1 runtime remain authoritative until a later explicit migration.

# PPX-PQ-5 foundation

Suite `0x02` is named `PPX-PQ-5`. Version `0x02` identities contain one
32-byte master entropy value, ML-KEM-1024 keys, ML-DSA-87 keys, fingerprint,
identity ID, pseudonym, and creation time. They contain no X25519 or Ed25519
keys. This foundation exposes no downgrade or dual/weak mode.

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
