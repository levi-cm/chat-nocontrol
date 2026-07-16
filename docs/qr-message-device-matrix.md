> **Authority:** Release evidence record; automation is not physical-device proof.

# Encrypted message QR device evidence

Automated profiles are useful evidence but are not physical-device proof.

| Device/profile | App QR | Image import | Camera | Camera link | Locked link | Low quality | Settings reload | Offline cache |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Android 11 phone, supported Chrome | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |
| iPhone X, latest available iOS/Safari | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |
| Current Xiaomi flagship, recent Chrome | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |
| Desktop Chromium automation | pass | pass | mocked | pass | pass | deterministic suite | pass | pass |
| Desktop Firefox automation | pass | pass | mocked | pass | pass | deterministic suite | pass | pass |
| WebKit Playwright profile | pass | pass | mocked | pass | pass | deterministic suite | pass | pass |

Physical rows remain release blockers until run over HTTPS on named hardware.

## Encrypted message link transport evidence

No physical messenger or installed-PWA transport was run in this implementation
environment. Rows must stay pending until tested on the named physical path;
desktop automation, emulation, and unit tests are not substitutes.

| Physical path | Browser/PWA open | PPXT with contact | Compact PPXQ | Linkify, truncate, preview | Share sheet |
| --- | --- | --- | --- | --- | --- |
| Android Chrome browser -> WhatsApp | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |
| Android installed PWA -> WhatsApp | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |
| iPhone Safari browser -> WhatsApp | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |
| iPhone installed PWA -> WhatsApp | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |
| Android/iPhone -> Signal | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |
| Android/iPhone -> Telegram | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |
| Android/iPhone -> Discord | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |
| Android/iPhone -> SMS | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |
| Android/iPhone -> email | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |

Each completed row must record exact OS/browser/app versions, complete link
character count, whether links over 2,000 characters stayed intact, whether the
browser or installed PWA opened, whether those surfaces shared local vault and
contact storage, and the actual share-target result. Web Share availability does
not prove that a selected target accepted the URL.

## Shared mobile shell and public-contact QR follow-up

This follow-up covers the shared browser UI and `PPXC` public-contact QR. It
does not change the H-only encrypted-message QR contract above.

| Device/profile | Safe-area outside controls | Header alignment | Canvas system bar | Maximum PPXC M/2048 decode | Preferred camera constraints | Physical 5/5 scan |
| --- | --- | --- | --- | --- | --- | --- |
| Mobile Chromium automation | pass | pass | pass | pass | pass with fallback | automation only |
| Mobile WebKit automation | pass | pass | pass | pass | pass with fallback | automation only |
| iPhone, current available Safari/PWA | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |
| Android phone, current available Chrome/PWA | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable | not run - hardware unavailable |

The automated maximum `PPXC` assertion uses error correction M, QR version 26,
a four-module quiet zone, pure black/white output, and a 2048-pixel source.
Physical two-phone scanning remains explicitly pending and must not be inferred
from Playwright mobile profiles.
