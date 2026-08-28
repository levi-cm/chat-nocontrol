> **Authority:** Normative product specification for `0.2.0-beta.1`.
> **Depends on:** [protocol-cat5-v2.md](protocol-cat5-v2.md), [legacy-v1-compatibility.md](legacy-v1-compatibility.md), [security-architecture.md](security-architecture.md), [user-guide.en.md](user-guide.en.md), [user-guide.de.md](user-guide.de.md)

# Product specification

## Scope

Static EN/DE browser PWA; one active identity; local contacts; one-recipient
text/file encryption; local decrypt; recovery; optional encrypted browser vault;
offline shell. No account, backend, relay, delivery, sync, analytics, history,
group messaging, or server recovery.

## Active output

All new output is CAT-5/V2 `0x02/0x02` (`PPX-PQ-5`).

- Contact: V2 PPXC file/text. No contact QR creation.
- Text: V2 PPXT armor or PPXT/PPXM `#/m/` link. No message QR creation.
- File: V2 PPXF.
- Vault: V2 PPXV file/local storage/private encrypted vault QR/text.
- Recovery: V2 PPXR, code/text, 24 words, PDF, recovery QR.

Old `#/decrypt/qr/...` and V1 PPXQ remain decode-only. V1 sender contact is
requested only when required, retained only in memory for the current unlocked
identity session, and never saved. It is cleared on lock, identity change,
erase-all, session teardown, reload, or tab close.
V1 PPXT/PPXF/full links and PPXR/PPXV/words remain readable/migratable without
installing the old app. New result is always V2.

## Flows

### Identity

Create or restore; normalize pseudonym; generate/display V2 contact; require
recovery download/storage confirmations; optionally lock V2 vault. Import V1
private material shows migration notice before V2 activation. Recovery material
is explicitly private and equivalent to secret key authority.

### Contacts

Import bounded V2 contact file/text; validate signature and canonical bytes;
deduplicate fingerprint; warn on pseudonym collision; allow nickname/delete.
Reject V1 contact persistence with guidance to request a fresh V2 contact.

### Encrypt

Choose saved V2 recipient, text/file, then output. Text chooses PPXT or PPXM by
contact-inclusion policy. File enforces 100 MiB and caption/metadata bounds.
Progress/cancel emits no partial usable output.

### Decrypt

Smart input accepts V2 armor/link/file plus supported V1 inputs. Route by exact
magic/version/suite. PPXQ asks for the matching V1 sender contact and keeps it
only for the unlocked identity session; worker request copies are erased after
each operation. Legacy files are download-only. Safe error shown before
technical detail.

## Limits and persistence

Text is 256 KiB UTF-8; file is 100 MiB; one recipient. Persist only V2 encrypted
vault, validated V2 contacts, and nonsensitive settings. Session-only mode
persists none. No plaintext/recovery/link/V1-contact persistence.

## PWA behavior

Offline after first successful shell load. Update activation is silent: no
banner, modal, prompt, or choice. Same-version clients remain open. A different
or legacy client is navigated once into the exact CAT5 version on the same
origin/scope. Supported incoming fragments are captured in memory and scrubbed
from URL/history without network or persistent storage exposure.

## Status language

UI/docs call target `0.2.0-beta.1`. They must not say reviewed, stable,
quantum-proof, device-verified, or deployed without corresponding evidence.
