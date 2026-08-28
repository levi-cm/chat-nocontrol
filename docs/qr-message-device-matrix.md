> **Authority:** Normative physical-device release-evidence matrix.
> **Target:** `0.2.0-beta.1`
> **Current status:** Every physical row is **NOT RUN**.

# Physical Android/iPhone browser and PWA matrix

Desktop emulation, responsive mode, mocked camera APIs, and automated Chromium,
Firefox, or WebKit runs do not count as physical evidence. CAT-5/V2 creates no
contact QR and no message QR; those rows must prove absence, not generation.
Recovery QR and encrypted PPXV vault QR remain private recovery transports.

## Required device profiles

| Profile | Minimum qualifying execution | Status |
| --- | --- | --- |
| Android Chrome | Physical Android phone, current supported Chrome, normal browser tab | NOT RUN |
| Android installed PWA | Same class of physical phone, installed production PWA, standalone display | NOT RUN |
| iPhone Safari | Physical iPhone, current supported iOS/Safari, normal browser tab | NOT RUN |
| iPhone home-screen PWA | Same class of physical iPhone, Add to Home Screen, standalone display | NOT RUN |

## Required flow matrix

Every cell below requires its own qualifying execution or an evidence record
that unambiguously covers the exact profile/flow combination.

| Required flow | Android Chrome | Android PWA | iPhone Safari | iPhone PWA |
| --- | --- | --- | --- | --- |
| Create identity; recovery confirmation; lock/unlock | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Restore V2 PPXR/code/24 words; new V2 identity active | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Export/import V2 PPXC file and `PPX2:CONTACT:` text | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Prove V2 contact QR creation/scanning UI is absent | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Encrypt/decrypt V2 PPXT armor | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Open canonical V2 PPXT `#/m/<BASE64URL>` link | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Open canonical V2 PPXM `#/m/<BASE64URL>` with saved sender | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Prove V2 message QR creation UI is absent | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Encrypt/decrypt V2 PPXF; cancel; 100 MiB boundary | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Recovery QR: camera scan while unlocked and locked-to-unlocked | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Recovery QR: screenshot/image import and low-quality fixture | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Encrypted PPXV vault QR: camera/image import, correct and wrong password | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| V1 PPXT format 1 and compressed format 2 decrypt | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| V1 PPXF decrypt is download-only; no inline preview | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| V1 `#/m/<BASE64URL>` carrying PPXT decrypt | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| V1 `#/m/<BASE64URL>` carrying PPXQ plus exact sender PPXC | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Old `#/decrypt/qr/...` PPXQ plus exact sender PPXC | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| V1 sender PPXC reused within unlocked session, cleared on lock/reload | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Session-only mode leaves no identity/contact/message persistence | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Offline shell plus decrypt after prior successful load | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Real two-build update; one forced old-client cutover, no banner/loop/leak, old caches removed | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Current build controls manual reload and offline close/reopen | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| EN/DE, keyboard/switch access, zoom/reflow, reduced motion | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

## Evidence required per execution

Record exact release tag, full commit SHA, production artifact SHA-256, build
provenance, physical device model, OS version, browser/PWA version, install
mode, locale, route, input path (file/text/link/camera/image), UTC timestamp,
expected result, actual result, status, screenshots or screen recording, useful
console/device logs, hashes for imported/exported artifacts, and tester name and
signoff. Redact private recovery, contacts, ciphertext fragments, and plaintext
without removing evidence that the flow ran.

Generate the exact public build bindings only after `npm run release:prepare`
with `npm run release:physical-evidence-bindings`. Complete the closed JSON
schema, transfer the evidence out of tree, and import it only through
`npm run release:import-physical-evidence` with `--input <absolute-file>` and
`--sha256 <digest>`. The SHA-256 must arrive out of band. The release workflow
accepts the same fixed-name asset only from the matching draft prerelease and
revalidates it against freshly prepared bytes. Evidence JSON, notes,
screenshots, and logs must contain no plaintext, ciphertext, keys, contacts, or
recovery material.

A failed, incomplete, emulator-only, or unbound record remains FAIL or NOT RUN;
it cannot be summarized as device PASS. The entire matrix remains **NOT RUN**
until all required cells have qualifying physical evidence.
