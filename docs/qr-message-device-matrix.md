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
