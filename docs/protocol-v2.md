> **Authority:** Normative PPXT v2 wire-format and compatibility contract.

# PPXT v2 adaptive text compression

PPXT v2 changes only the encrypted text transport. Contacts, vaults, recovery,
files, and the canonical signed text inner remain version 1.

## Canonical envelope

The outer header is the same 855-byte header defined for PPXT v1. A compressed
envelope uses exactly `formatVersion = 0x02`, `suite = 0x01`, and
`flags = 0x01`. Bit 0 means the AES-GCM plaintext is exactly one complete gzip
member. Every other version/flag pair is rejected. The complete header,
including version and flags, is AES-GCM AAD.

Armor uses `Version: 2`; the armor version must equal the binary version.

## Writer selection

The writer first creates and signs the unchanged canonical
`PPX/TEXT/V1/SIGNATURE` inner bytes. It tries gzip only at 1,024 bytes or more.
It emits v2 only when gzip saves at least both 64 bytes and 10 percent:

```text
minimumSavings = max(64, ceil(innerLength * 0.10))
compressedLength <= innerLength - minimumSavings
```

Unsupported compression, compression failure, or insufficient savings emits
canonical v1. Compression is automatic and applies only to text.

## Reader validation

The reader parses the canonical outer object, authenticates AES-GCM, and only
then decompresses v2. Decompressed output is streamed into a strict 264,000-byte
bound before signed-inner parsing. Malformed, truncated, trailing-member,
oversize, or unsupported gzip fails closed and releases no plaintext. There is
no fallback from v2 bytes to v1 parsing.

Updated applications read v1 and v2. Older applications read v1 only.
