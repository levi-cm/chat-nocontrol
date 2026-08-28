# CAT-5 V2 and legacy V1 compatibility

> **Authority:** Normative runtime compatibility and retirement policy.
> **Policy:** Read old, write new.

CAT-5/V2 is the only format used to create identities, public contacts, new
encrypted text, new encrypted files, and message links. The application never
negotiates or downgrades to V1 and never creates new V1 artifacts.

## Compatibility matrix

| Artifact or operation | V1 input | New output |
| --- | --- | --- |
| PPXT text, format 1 or legacy compressed format 2, suite 1 | Decrypt | CAT-5/V2 only |
| PPXF file, version 1, suite 1 | Decrypt and download only | CAT-5/V2 only |
| Recovery words derived from the original master entropy | Restore as V2 | V2 identity and recovery |
| PPXR recovery file or private recovery QR | Import and migrate to V2 | V2 identity and recovery |
| PPXV encrypted vault file or private vault QR | Unlock and migrate to V2 | V2 identity and vault |
| Stored V1 browser vault | Atomically migrate after V2 round-trip verification | V2 vault |
| V1 PPXC supplied with a PPXQ message | Temporary decrypt-only, in memory | Never persisted; V2 contact only |
| V1 PPXQ compact text or `PPX1:MESSAGE:` | Decrypt with supplied exact V1 sender contact | V2 PPXT/PPXM only |
| V1 `#/m/<BASE64URL>` carrying PPXT or PPXQ | Decrypt | V2 `#/m/` link only |
| Old `#/decrypt/qr/...` PPXQ link | Decode/decrypt compatibility only | Never created |
| V1 contact creation, encryption, or sending | Unavailable | V2 only |

V1 contacts are neither migrated nor stored. An exact PPXQ sender contact is a
decrypt-only, memory-only capability that may remain for the current unlocked
identity session so additional legacy messages from that sender can be
decrypted. It is cleared on lock, identity replacement/import/deletion,
erase-all, session teardown, reload, or tab close. A migrated identity keeps
the same private master entropy, allowing the isolated legacy reader to derive
temporary V1 decryption keys. Its V2 public contact is different and must be
shared again.

## Isolation and secret handling

The CAT-5 `CryptoProvider` accepts V2 objects only. V1 decryption and private
recovery migration run through a dedicated legacy worker with only these
requests: `decrypt-compact-v1`, `decrypt-text-v1`, `decrypt-file-v1`,
`migrate-recovery-v1`, `migrate-vault-v1`, and `cancel`. No legacy encryption
or sending request exists. Request-owned entropy, recovery bytes, worker copies
of temporary sender-contact bytes, and temporary V1 keys are erased after
success, failure, cancellation, or worker error. This request cleanup does not
erase the separately bounded unlocked-session sender-contact copy.

Artifact routing checks exact magic, version, and suite fields before selecting
a reader. Malformed, mixed-version, unknown-suite, wrong-identity, and damaged
inputs fail closed without revealing sensitive details. Legacy files never get
an inline media preview, and legacy sender contacts cannot be saved.

## Support lifetime

There is no planned removal date for V1 read and private-recovery support. Any
future removal requires advance public notice and a separately usable legacy
reader before support is removed from the main application.

This policy does not authorize deployment. GitHub Pages remains unchanged until
CAT-5 promotion and deployment are explicitly approved.
