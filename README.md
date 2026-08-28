<!-- markdownlint-disable MD033 MD041 -->

<p align="center"><img src="logo.png" alt="Chat NoControl logo" width="144"></p>
<h1 align="center">Chat NoControl</h1>
<p align="center">Local browser encryption for text and files. No account, relay, tracking, or cloud history.</p>
<p align="center"><a href="https://levi-cm.github.io/chat-nocontrol/"><strong>Open canonical GitHub Pages beta</strong></a> · <a href="docs/user-guide.en.md">English</a> · <a href="docs/user-guide.de.md">Deutsch</a></p>

<!-- markdownlint-enable MD033 MD041 -->

> [!WARNING]
> Target version `0.2.0-beta.1` is beta software. Independent security review
> and physical-device gates are **BLOCKED / NOT RUN** until real evidence
> exists. Do not treat this branch, README, or preview as a reviewed release.

## Use

1. Create or restore one local identity; save private recovery material.
2. Exchange a V2 public contact as `.ppxcontact` file or `PPX2:CONTACT:` text.
3. Encrypt locally. Send PPXT text, a PPXT/PPXM message link, or `.ppxfile`.
4. Recipient opens it in Chat NoControl and decrypts locally.

New CAT-5/V2 contact and message QR codes do not exist. Recovery QR remains
because it is private identity recovery. Old `#/decrypt/qr/...` links are
decode-only V1 compatibility.

## CAT-5/V2

CAT-5/V2 is sole create/write/encrypt path: `formatVersion 0x02`, suite `0x02`
`PPX-PQ-5`, ML-KEM-1024, ML-DSA-87, HKDF-SHA-512, and AES-256-GCM. Strict
parsers bound input before allocation and reject unknown flags, downgrade,
cross-family, and mixed-suite objects.

| Object | V2 purpose | Creation transport |
| --- | --- | --- |
| `PPXC` | Public contact | File or text |
| `PPXT` | Full-contact encrypted text | Armor or `#/m/` link |
| `PPXM` | Saved-contact encrypted text | `#/m/` link |
| `PPXF` | Encrypted file/caption | File |
| `PPXR` | Unencrypted private recovery | File, text, words, PDF, recovery QR |
| `PPXV` | Password-encrypted vault | File/local storage/private vault QR |

Read-old/write-new support lets this app itself decrypt V1 PPXT text, PPXF
files, full links, and compact PPXQ when its exact V1 sender contact is supplied.
It migrates V1 PPXR/PPXV/recovery words to V2. Temporary V1 sender contacts are
decrypt-only, memory-only for the unlocked identity session, cleared on
lock/session end, and never saved. Legacy `#/m/<BASE64URL>` may carry PPXT or
PPXQ. No old app is required; no V1 contact, message, link, vault, or recovery
artifact is newly written.

Details: [CAT-5/V2 protocol](docs/protocol-cat5-v2.md) and
[V1 compatibility matrix](docs/legacy-v1-compatibility.md).

## Security boundary

- Browser/device compromise can expose plaintext or keys.
- Contact authenticity still needs an out-of-band check.
- No forward secrecy, ratchet, group encryption, delivery service, or secure
  deletion guarantee.
- Recovery material grants identity authority; store it offline and never share.
- Implementation claims are not proof of long-term or “quantum-proof” security.

See [security architecture](docs/security-architecture.md),
[threat model](docs/threat-model.md), and
[release gates](docs/testing-and-release.md).

## PWA and hosting

Canonical URL remains <https://levi-cm.github.io/chat-nocontrol/>. No custom
domain is authorized. PWA updates activate silently: no banner or user choice,
and no same-version interruption. During a version transition, the worker may
perform one controlled same-origin navigation into CAT5. A supported incoming
fragment stays local, is captured in memory, and is immediately scrubbed from
the URL and history; no ciphertext is requested or persisted.
Deployment requires explicit user approval and passed release gates.

## Development

Use exact version in `.node-version`.

```bash
npm ci
npm run dev
npm run docs:check
npm run verify:quality
```

`npm run verify` includes independent-review/release evidence and correctly
remains blocked until genuine artifacts exist.

## Documentation

- [English user guide](docs/user-guide.en.md)
- [German user guide](docs/user-guide.de.md)
- [Product specification](docs/product-spec.md)
- [Implementation status](docs/implementation-status.md)
- [GitHub Pages contract](docs/github-pages-deployment.md)
- [Security reporting](SECURITY.md)

AGPL-3.0-or-later. See [LICENSE](LICENSE).
