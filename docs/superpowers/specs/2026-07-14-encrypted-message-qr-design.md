# Encrypted Message QR Design

<!-- markdownlint-disable MD013 -->

**Date:** 2026-07-14

**Status:** Implementation-ready; plan created

## Goal

Let a user encrypt a text message, then download it as a high-reliability QR PNG when the encrypted payload fits. Let the recipient decrypt it through the in-app camera, a screenshot/image upload, or an optional normal-camera HTTPS link. Keep the existing hybrid and signature security properties, run locally, and persist QR workflow preferences in the existing browser-local settings store.

## User decisions

- QR messages are always encrypted.
- Compression is attempted before QR encoding and retained only when smaller.
- QR download actions appear beside Copy, Save, and Share after encryption.
- There is no QR preview; the action downloads a PNG and uses a QR icon.
- Oversize output hides the affected download action and explains that the encrypted QR payload is too large.
- QR output and normal output represent the same logical message ID, timestamps, sender, recipient, and plaintext.
- Valid scanned messages decrypt immediately by default.
- Decrypt shows separate camera-scan and screenshot/image controls by default.
- Error correction is always QR level H, approximately 30% recovery. The encoder chooses the smallest QR version that fits and never exceeds version 40.
- Low-quality and portrait screenshots receive bounded retry processing.
- QR behavior is customizable and saved locally on the device.

## Physical capacity constraint

The current PPXT object cannot fit in one version-40/H QR, even for an empty message. Its minimum is about 1,973 bytes because it embeds a 961–1,008 byte public contact and a 768 byte ML-KEM ciphertext. Version-40/H holds at most 1,273 bytes in byte mode, or roughly 1,200 payload bytes after a safe textual transport.

Compression cannot solve this fixed random-key overhead. Four normal A4 pages also cannot be promised in one high-error-correction QR. Highly repetitive text may compress dramatically, but ordinary prose will reach the QR limit much earlier. The UI therefore uses the actual encoded result as the fit decision and makes no page-count promise.

## Approaches considered

### 1. Put existing PPXT armor in a QR

Rejected. No message can fit at level H because minimum PPXT bytes already exceed capacity. Compressing ciphertext is ineffective.

### 2. Lower error correction or remove hybrid post-quantum encryption

Rejected. Lower error correction conflicts with the reliability requirement. Dropping ML-KEM or X25519 would silently weaken the app's security model.

### 3. Compact, contact-referenced PPXQ envelope

Selected. PPXQ keeps ML-KEM-768, ephemeral X25519, AES-256-GCM, and Ed25519. It omits the embedded sender contact and carries only the sender fingerprint inside the encrypted signed body. The recipient must already have the sender's public contact to verify the signature. If that contact is missing, decryption fails closed before plaintext is released and tells the recipient to import the sender contact.

This gives a useful but intentionally small single-QR message capacity. It also preserves the standard PPXT workflow for longer messages and unknown senders.

### 4. Multi-QR sequences

Deferred. They could carry larger PPXT objects but are slower, harder to recover from screenshots, and poorly supported by normal phone camera apps. The requested first version remains one QR or no QR.

## Protocol design

PPXQ is a separate canonical binary envelope. It does not change PPXT v1/v2 bytes.

### Outer envelope

| Field | Bytes | Rule |
| --- | ---: | --- |
| Magic | 4 | ASCII `PPXQ` |
| Format version | 1 | `0x01` |
| Suite | 1 | `0x01` |
| Flags | 1 | bit 0 = gzip payload; all other bits zero |
| ML-KEM ciphertext | 768 | existing ML-KEM-768 primitive |
| Ephemeral X25519 public key | 32 | existing hybrid primitive |
| HKDF salt | 32 | random |
| AES-GCM nonce | 12 | random |
| Ciphertext length | 2 | unsigned big-endian |
| Ciphertext | variable | signed inner plus 16-byte GCM tag |
| Checksum | 16 | existing checksum over header and ciphertext |

Header size is 853 bytes. Header bytes are AES-GCM additional authenticated data.

### Signed inner

| Field | Bytes | Rule |
| --- | ---: | --- |
| Sender fingerprint | 32 | looks up the already-saved sender contact |
| Recipient identity ID | 20 | must equal active identity |
| Message ID | 16 | shared with normal PPXT output |
| Sent time | 8 | shared with normal PPXT output |
| Created time | 8 | shared with normal PPXT output |
| Original UTF-8 length | 4 | bounded to 262,144 bytes before allocation |
| Payload length | 2 | exact stored payload length |
| Payload | variable | raw UTF-8 or one canonical gzip member |
| Signature | 64 | Ed25519 over domain plus every preceding inner byte |

Signature domain is `PPX/QR-TEXT/V1/SIGNATURE`. Compression is attempted on plaintext UTF-8 before the inner is signed and encrypted. Compressed bytes are used only when strictly smaller. The compression flag is authenticated in outer AAD and the exact stored payload is signed.

On decrypt, the app authenticates AES-GCM, parses bounded lengths, finds the sender contact by fingerprint, verifies Ed25519, checks the recipient ID, and only then decompresses and UTF-8 decodes. Unknown sender, tampering, wrong recipient, decompression overflow, noncanonical encoding, and malformed lengths fail closed with no plaintext output.

## QR transports

### In-app transport

`PPX1:MESSAGE:` followed by canonical URL-safe base37. Its alphabet is `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-`, which remains QR alphanumeric mode and survives file, clipboard, and scanner transport.

### Normal-camera link

An HTTPS link ending in `#/decrypt/qr/<BASE37>`. QR generation uses two explicit segments: the HTTPS prefix in byte mode and base37 payload in alphanumeric mode. A normal Android/iOS camera can offer to open the link; the in-app scanner also accepts it.

The payload stays after `#`, so it is not sent to the web server. The app copies it to transient memory and immediately replaces the address with `#/decrypt`. Arbitrary link destinations are never configurable. If the app is not already installed/cached, opening a normal-camera link still requires loading the app; the compact in-app QR remains the offline option.

Both modes use level H, four-module quiet zones, black-on-white colors, a 2,048 pixel PNG, and the smallest fitting version. Fit is verified through the real `qrcode` encoder, not a character estimate.

## UX and settings

Settings use the existing IndexedDB `settings/preferences` record and session-memory fallback. This is browser-local device storage; no QR preference or message is synchronized.

New settings:

- `qrExportMode`: `app`, `link`, or `both`; default `both`.
- `qrImportControls`: `camera`, `image`, or `both`; default `both`.
- `qrAutoDecrypt`: boolean; default `true`.

After normal text encryption, the worker also returns the compact PPXQ candidate for the same logical message. The output panel shows only download actions enabled by settings and actual capacity. If a selected transport is too large, it shows the number of encoded bytes over that transport's limit. It never claims an exact plaintext-character reduction because compression is nonlinear.

The decrypt page shows camera and image controls according to settings. A valid scan starts local decrypt immediately when `qrAutoDecrypt` is on. When it is off, the encrypted payload is loaded and a normal Decrypt action remains explicit. A normal-camera link captured while the identity is locked remains only in memory until unlock, then follows the same setting.

## Screenshot recovery

File scanning first tries the source image unchanged. On failure, a bounded retry pipeline decodes one image, then tries centered crops, proportional upscale, grayscale, autocontrast, and threshold variants. Existing 10 MiB, 4,096 dimension, and 16,777,216 pixel limits remain. Temporary canvases, object URLs, and buffers are released.

Acceptance fixtures cover 9:16 screenshots at 1,080 by 1,920, JPEG degradation, downscaling, and centered QRs at density-appropriate sizes. No implementation may claim recovery when QR modules have been destroyed below image resolution.

## Compatibility

- Avoid a mandatory `CompressionStream` dependency for basic function. If the existing adaptive-compression prerequisite is unavailable on a device, short uncompressed PPXQ messages still work.
- Camera scanning requires a secure context and `getUserMedia`; image upload remains available when permission, hardware, or secure context is missing.
- Automated coverage runs Chromium and WebKit mobile profiles plus desktop browsers. Manual release evidence covers Android 11 Chrome, iPhone X Safari, and a current Xiaomi/Android Chrome device when hardware is available.
- Physical-device evidence is a release gate. Emulation must not be reported as physical-device proof.

## Security notes

- No plaintext, private key, or unencrypted message enters a URL, PNG, browser history, server request, or persisted setting.
- A QR contains ciphertext and public encapsulation material, but remains sensitive metadata; the app scrubs link fragments promptly.
- PPXQ's known-sender requirement is explicit. The app never substitutes an unverified key and never displays unverified plaintext.
- Compression leaks coarse message length and compressibility through ciphertext length, as ordinary PPXT already leaks ciphertext length. The app has no remote compression oracle; future network automation must reassess this.
- Parser limits apply before large allocation or decompression. All temporary plaintext/compressed buffers are zeroized where practical.

## Out of scope

- Multi-QR/animated sequences.
- Server-side message storage, short links, or relay IDs.
- Plaintext QR mode.
- Files in QR codes.
- Lower error-correction settings.
- Guaranteed recovery below available image detail.

## Acceptance

- Short encrypted messages download as one valid H-level PNG in each enabled transport that fits.
- Oversize modes have no download action and provide honest per-transport feedback.
- In-app camera and screenshot/image flows can immediately decrypt valid PPXQ locally.
- Normal-camera HTTPS links open the decrypt route, keep ciphertext out of server requests, scrub the fragment, and decrypt after unlock when possible.
- Adaptive compression is used only when smaller and is bounded on decode.
- Wrong identity, unknown sender, tampering, malformed input, and decompression bombs reveal no plaintext.
- QR settings survive reload through existing browser-local persistence and reset with Erase Local Data.
- English/German, keyboard, screen-reader, mobile layout, offline, and device-matrix checks pass.
