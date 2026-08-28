> **Authority:** Active master specification for target `0.2.0-beta.1`.
> **Status:** CAT-5/V2 implementation target; release gates remain evidence-based.
> **Depends on:** [docs/protocol-cat5-v2.md](docs/protocol-cat5-v2.md), [docs/legacy-v1-compatibility.md](docs/legacy-v1-compatibility.md), [docs/product-spec.md](docs/product-spec.md), [docs/security-architecture.md](docs/security-architecture.md), [docs/threat-model.md](docs/threat-model.md), [docs/testing-and-release.md](docs/testing-and-release.md), [docs/github-pages-deployment.md](docs/github-pages-deployment.md)

# Chat NoControl master specification

## Product

Chat NoControl is a static, backend-free PWA for one-recipient encrypted text
and files. It has one active local identity, public contact exchange, private
recovery card creation, encrypted text, encrypted files, and optional
password-encrypted local vault storage. It has no account, delivery relay, key
server, telemetry, message history, or cloud recovery.

The term **private recovery card** covers recovery artifacts that grant identity
authority; each is secret even when displayed as text or QR.

Target user-visible version is `0.2.0-beta.1`. Canonical public URL is
`https://levi-cm.github.io/chat-nocontrol/`; no custom domain is authorized.

## Normative protocol decision

CAT-5/V2 is sole creation, write, encryption, and send path. Every newly made
identity, PPXC contact, PPXT/PPXM message, PPXF file, PPXR recovery object, and
PPXV vault uses `formatVersion 0x02`, suite `0x02` (`PPX-PQ-5`). V2 uses
ML-KEM-1024, ML-DSA-87, HKDF-SHA-512, SHA-512, and AES-256-GCM. It has no
X25519/Ed25519 fallback, negotiation, downgrade, mixed-suite mode, or V1 writer.

Exact domain labels, public sizes, wire bounds, and object rules are controlled
by [CAT-5/V2 protocol](docs/protocol-cat5-v2.md). Parsers bound before
allocation, require exact magic/version/suite/flags/length/end, authenticate
before release, and reject downgrade, family swap, unknown, and mixed objects.

## Read old, write new

Current app—not an old app—must support:

- V1 PPXT format 1 and legacy format 2/suite 1 text decrypt;
- V1 PPXF decrypt/download;
- V1 full PPXT message links;
- V1 PPXQ text/link decrypt with exact V1 sender PPXC supplied temporarily;
- V1 PPXR, PPXV, stored vault, and recovery-word migration to V2.

V1 sender contacts remain bounded, decrypt-only, and memory-only for the
current unlocked identity session. They are never stored and are cleared on
lock, identity replacement/import/deletion, erase-all, reload, tab close, or
session teardown; worker request copies are erased after each operation. No V1
contact, encryption, message, link, recovery, or vault creation is exposed. V1
`#/m/<BASE64URL>` may carry PPXT or PPXQ; old `#/decrypt/qr/...` remains
decode-only. Exact policy: [legacy compatibility](docs/legacy-v1-compatibility.md).

## Transport model

- V2 contacts: `.ppxcontact` file or `PPX2:CONTACT:` text.
- V2 text: PPXT armor or PPXT/PPXM `#/m/` link.
- V2 files: `.ppxfile`.
- V2 vault: `.ppxvault`, local encrypted storage, private encrypted vault QR/text.
- Recovery: `.ppxrecovery`, text/code, 24 words, PDF, and recovery QR.

No V2 contact QR or message QR is created. Recovery QR remains private
recovery. Camera/image input may decode supported recovery and legacy inputs;
that does not authorize new contact/message QR output.

Writers emit only the canonical GitHub Pages HTTPS origin. Incoming fragments
are bounded, captured locally, and scrubbed to the same-origin `#/decrypt`
route before parsing; they never cause navigation to an encoded host. Fragment
or message bytes never enter requests/referrers, browser history state,
storage, caches, service-worker caches, logs, diagnostics, telemetry, or crash
reports.

## Product limits

- Text: 262,144 UTF-8 bytes.
- File: 104,857,600 bytes; one recipient; bounded 1 MiB processing chunks.
- Pseudonym: normalized UTF-8, 1..48 bytes.
- No groups, ratchet, forward secrecy, delivery, history, or secure deletion.
- Decrypted legacy files are download-only; no inline legacy media preview.

## Storage and secret handling

Only encrypted V2 vaults, validated V2 public contacts, and nonsensitive
settings may persist. Plaintext identities/messages/files, recovery material,
V1 contacts, link payloads, and temporary intents must not persist. Session-only
mode persists neither identity nor contacts. Worker request copies and owned
secret buffers are best-effort zeroized on success, failure, cancellation, and
late completion.

## PWA updates

Versioned shell assets may be cached; user/recovery/decrypted content may not.
New service workers activate silently. No update banner, prompt, or choice is
shown. Exact same-version clients remain open. Legacy or different-version
clients may receive one same-origin/scope, version-marked navigation into CAT5.
Supported fragments remain local, are captured in memory, and are immediately
scrubbed from the URL and history.

## Security and release truth

Security depends on uncompromised browser/device, authentic contacts, safe
recovery storage, correct dependencies, and review of exact release bytes.
CAT-5 primitive choices do not prove “quantum-proof” or century-long security.

Independent external review remains **BLOCKED** until genuine signed evidence
for exact source/artifact exists. Physical Android/iOS/device QR and PWA gates
remain **NOT RUN** until real hardware evidence exists. Emulation does not close
them. No document may convert local tests into external-review/device proof.

## Deployment

Local edit/build/commit does not authorize deployment. GitHub Pages deployment
requires explicit user request, exact tag/commit/artifact provenance, release
gate success, rollback record, and live verification. Canonical URL stays the
repository Pages URL. See [deployment contract](docs/github-pages-deployment.md).

## Authority order

1. [CAT-5/V2 protocol](docs/protocol-cat5-v2.md)
2. [V1 compatibility](docs/legacy-v1-compatibility.md)
3. [Security architecture](docs/security-architecture.md)
4. [Threat model](docs/threat-model.md)
5. [Product specification](docs/product-spec.md)
6. [Testing and release](docs/testing-and-release.md)
7. This master for cross-cutting product decisions

Historical files under `docs/superpowers/` and legacy protocol references
remain audit history, not current write-path authority.

## Legacy V1 PPXF conformance anchors

These strings preserve exact decode-only V1 golden/checker authority; they do
not authorize V1 output. Legacy header is **884 bytes**. Terminal index is
`0xffffffff`; each record validates its declared **ciphertext length**. Legacy
manifest plaintext is capped at **18000 bytes**. Transfer checksum is exactly:

`SHA-512(canonicalHeader || allCanonicalDataRecords || canonicalTerminalRecord)[0..16)`
