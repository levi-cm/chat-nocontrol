> **Authority:** Normative compact encrypted-message QR and encrypted-link transport contract.

# Compact encrypted message QR and link transport v1

`PPXQ` is a contact-referenced encrypted text envelope sized for one
high-recovery QR. It retains the established hybrid ML-KEM + X25519 key
agreement, AES-256-GCM, and Ed25519 authentication. The recipient must already
have the sender's canonical public contact. Normal PPXT remains the compatible
choice for unknown senders and longer messages.

## Outer bytes

The header is exactly 853 bytes and is AES-GCM AAD.

| Offset | Length | Field |
| ---: | ---: | --- |
| 0 | 4 | ASCII `PPXQ` |
| 4 | 1 | Version `0x01` |
| 5 | 1 | Suite `0x01` |
| 6 | 1 | Flags: `0x00` raw or `0x01` gzip |
| 7 | 768 | ML-KEM ciphertext |
| 775 | 32 | Ephemeral X25519 public key |
| 807 | 32 | HKDF salt |
| 839 | 12 | AES-GCM nonce |
| 851 | 2 | Ciphertext length, uint16 big-endian |

Ciphertext follows, then `SHA-512(header || ciphertext)[0..16]`. Other
versions, suites, flag bits, lengths, checksum changes, and trailing bytes are
rejected before allocation or plaintext release.

## Signed inner

Before its 64-byte Ed25519 signature, the inner is:

| Length | Field |
| ---: | --- |
| 32 | Sender fingerprint |
| 20 | Recipient identity ID |
| 16 | Message ID |
| 8 | Sent time, uint64 big-endian |
| 8 | Created time, uint64 big-endian |
| 4 | Original UTF-8 length |
| 2 | Stored payload length |
| N | Raw UTF-8 or one gzip member |

The signature domain is `PPX/QR-TEXT/V1/SIGNATURE`. Gzip is selected only when
strictly smaller than raw UTF-8. Decompression occurs only after AEAD,
known-sender lookup, signature verification, and recipient validation, and is
stream-bounded to 262,144 bytes. Exact decoded length and fatal canonical UTF-8
are required.

## QR transports

Bytes use canonical URL-safe base37 alphabet
`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-`, preserving leading zero bytes.

- In-app text: `PPX1:MESSAGE:<BASE37>` as one alphanumeric segment.
- Camera link: an HTTPS byte-mode prefix ending `#/decrypt/qr/`, followed by
  one base37 alphanumeric segment.

Both always use error correction H, a four-module quiet zone, black modules on
white, and the smallest version 1–40 that fits. Output is one 2048-square PNG.
Overflow produces no download action and an encoded-byte overage. A received
link payload exists only in the fragment, is copied to bounded memory, and is
immediately scrubbed to `#/decrypt`.

Current PPXT cannot fit version-40/H. PPXQ fit depends on ciphertext and
compression; four A4 pages are not guaranteed.

## Encrypted message links

The backend-free message-link transport is:

```text
https://canonical-app.example/#/m/<BASE64URL>
```

`BASE64URL` is unpadded canonical base64url of the raw canonical `PPXT` or
`PPXQ` bytes. It is never PPXT armor, base37, or a server-side identifier. The
decoder determines the object family from the decoded `PPXT` or `PPXQ` magic
and then applies the existing strict object parser. The link therefore changes
transport only; it does not change PPXT or PPXQ cryptography or wire bytes.

- Contact inclusion on encodes PPXT. Its encrypted inner contains the sender's
  public contact, so an unknown sender can be authenticated after decryption.
- Contact inclusion off encodes compact PPXQ. The recipient must already have
  the exact sender fingerprint in contacts; unknown senders fail closed.
- Generation uses only the build-defined canonical HTTPS app base. Credentials,
  query parameters, non-HTTPS destinations, user-configured destinations, and
  silent development-origin substitution are rejected.
- The base64url input is bounded to 400,000 characters before decoding.
  Padding, noncanonical alphabet, empty or truncated input, impossible lengths,
  trailing data, unknown magic, and query-bearing reserved links are rejected.

Both valid and malformed reserved `#/m/` links are scrubbed before normal app
and storage initialization. The clean location is the current app pathname plus
`#/decrypt`, with its query removed. Only a typed parsed intent and capture time
remain in memory; the full incoming URL is not retained. A valid intent expires
after 15 minutes and is also cleared by cancel, erase, replacement, destructive
navigation, or tab close. The established `#/decrypt/qr/<BASE37>` PPXQ link
remains accepted and receives the same early-scrub treatment.

The fragment is processed by the client and is not part of the HTTP request
under [RFC 3986 section 3.5](https://www.rfc-editor.org/rfc/rfc3986#section-3.5).
The document also uses a `no-referrer` policy. These properties do not remove
the residual exposure before JavaScript starts or in browser-managed history,
sync, and crash recovery.

Replay is permitted by design. The app allows only one active decrypt operation
at a time, but it does not persist message IDs and does not claim cross-session
replay protection.
