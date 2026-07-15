> **Authority:** Chat NoControl documentation authority; this file normatively defines the repository overview for the public beta docs package.
> **Version:** 1.0-draft
> **Status:** Public beta channel / stable release unavailable / operational status is external
> **Depends on:** [docs/product-spec.md](docs/product-spec.md), [docs/protocol-v1.md](docs/protocol-v1.md), [docs/security-architecture.md](docs/security-architecture.md), [docs/threat-model.md](docs/threat-model.md), [docs/design-spec.md](docs/design-spec.md), [docs/ux-content-spec.md](docs/ux-content-spec.md), [docs/accessibility-i18n.md](docs/accessibility-i18n.md), [docs/user-guide.en.md](docs/user-guide.en.md), [docs/user-guide.de.md](docs/user-guide.de.md), [docs/testing-and-release.md](docs/testing-and-release.md), [docs/references.md](docs/references.md), [WebLibre_full_plan.md](WebLibre_full_plan.md)
> **Supersedes:** The original WebLibre plan is historical only; it remains archive context, not an active specification.

# Chat NoControl

Chat NoControl is the calm product behind a satirical brand name. This
repository contains a static Preact implementation plus the normative PPX
documentation. Identity recovery, contacts, local storage, offline shell,
encrypted text, and worker-backed encrypted files are implemented. This source
snapshot does not claim a current deployment or stable-security status;
publication state is established by GitHub's release and deployment evidence.

The current protocol family is PPX Protocol v1. There is no supported stable release version yet.

- Source: <https://github.com/levi-cm/chat-nocontrol>
- Releases and review-bound artifacts: <https://github.com/levi-cm/chat-nocontrol/releases>
- Public beta site and current availability: <https://levi-cm.github.io/chat-nocontrol/>

## What v1 Is

- Static, accountless, browser-first product concept with no backend, relay, key server, telemetry, analytics, or remote dependency.
- One active identity at a time.
- One recipient per encrypted output.
- Local encrypt and decrypt flows for text and files.
- Ordinary PPXT is the primary text output. Message-QR creation is an optional
  Settings-enabled output after encryption and defaults off; receiving remains
  available. See
  [`docs/protocol-qr-message-v1.md`](docs/protocol-qr-message-v1.md).
- Public contacts exchanged as QR or file payloads.
- Identity creation uses a seven-screen backup-and-restore wizard; the UI calls the public protocol pseudonym a `Username`.
- Every new identity uses a matching browser-vault password. Its plaintext appears only on the private A4 recovery print/PDF and is never persisted or included in QR/PPXR artifacts.
- Encrypted IndexedDB vault storage is recommended and preselected, but written only after explicit confirmation; session-only remains available.
- English and German launch content.
- Calm, Apple-like mobile/desktop UI governed by the approved visual spec.

## Exact v1 Limits

- Text support: up to `256 KiB`.
- File support: up to `100 MiB`.
- Optional file caption: up to `16 KiB`.
- Session-only mode when storage is unavailable or the user declines persistence.
- The repository stays private through implementation and review and becomes public only with an explicitly approved public beta after every release gate passes.
- No message history.
- No forward secrecy.
- No group messaging.
- No account model.
- No cloud sync.
- No analytics or telemetry.
- No remote fonts, scripts, images, or crash reporting.
- No promise of stable production security without independent review.

## Security Summary

PPX v1 uses hybrid confidentiality with ML-KEM-512 and classical X25519, classical sender authentication with Ed25519, and AES-256-GCM for content protection. That is the narrow claim. It is not quantum-proof, not Signal-equivalent, and not a finished stable product.

## Docs Map

### Existing drafts

| File | Status | Purpose |
|---|---|---|
| [WebLibre_full_plan.md](WebLibre_full_plan.md) | Historical | Original archive plan. Read it for context only. |
| [Chat_NoControl_full_plan.md](Chat_NoControl_full_plan.md) | Authoritative Draft | Complete v1 product, protocol, security, UX, deployment, and release specification. |
| [docs/product-spec.md](docs/product-spec.md) | Existing Draft | Product identity, scope, release posture, and required UX. |
| [docs/protocol-v1.md](docs/protocol-v1.md) | Existing Draft | PPX v1 object formats, identity model, and byte-level rules. |
| [docs/security-architecture.md](docs/security-architecture.md) | Existing Draft | Cryptographic boundaries, primitives, and provider contract. |
| [docs/threat-model.md](docs/threat-model.md) | Existing Draft | Attacker model, protected assets, and residual risks. |
| [docs/design-spec.md](docs/design-spec.md) | Existing Draft | Functional design, state, storage, and responsive boundaries. |
| [docs/apple-visual-spec.md](docs/apple-visual-spec.md) | Approved Visual Spec | Apple-inspired palette, system typography, layout, material, motion, and accessibility boundaries. |
| [docs/ux-content-spec.md](docs/ux-content-spec.md) | Existing Draft | Screen copy, content structure, and user-visible wording. |
| [docs/accessibility-i18n.md](docs/accessibility-i18n.md) | Existing Draft | Accessibility rules and English/German parity. |
| [docs/user-guide.en.md](docs/user-guide.en.md) | Existing Draft | English user guide. |
| [docs/user-guide.de.md](docs/user-guide.de.md) | Existing Draft | German user guide. |
| [docs/testing-and-release.md](docs/testing-and-release.md) | Existing Draft | Testing, review, and release contract. |
| [docs/references.md](docs/references.md) | Existing Draft | Source notes, citations, and supporting references. |
| [docs/implementation-plan.md](docs/implementation-plan.md) | Execution Record | Decision-complete Tasks 0-17 implementation and verification sequence. |

## How To Review

1. Start with [docs/product-spec.md](docs/product-spec.md) to understand the product shape and user-visible limits.
2. Read [docs/protocol-v1.md](docs/protocol-v1.md) and [docs/security-architecture.md](docs/security-architecture.md) together for the protocol and cryptographic claims.
3. Check [docs/threat-model.md](docs/threat-model.md) for what the system does and does not protect.
4. Read [docs/design-spec.md](docs/design-spec.md) and [docs/ux-content-spec.md](docs/ux-content-spec.md) for the calm UI direction and the exact wording rules.
5. Verify English and German parity in [docs/user-guide.en.md](docs/user-guide.en.md) and [docs/user-guide.de.md](docs/user-guide.de.md).
6. Treat [WebLibre_full_plan.md](WebLibre_full_plan.md) as historical only.
7. Before commenting on link integrity, run a quick local check for broken relative paths and terminology drift.

## Local development

Install the pinned dependencies with `npm ci`, then run `npm run dev` (or the
equivalent `npm run dev:tailscale`). The runner reads this node's live Tailscale
DNS name, binds Vite to `127.0.0.1:5173`, and exposes it through foreground
Tailscale Serve. Open the printed `https://<node>.<tailnet>.ts.net/` URL. On the
first run, Tailscale may print an administrator link for approving HTTPS
certificates; approve it for this tailnet, then run the command again. The
strict port prevents Vite from silently moving when another process owns
`5173`. Stopping the command terminates both Vite and the foreground Serve.

Phone camera and automatic Clipboard permissions require a browser secure
context. Plain IP HTTP does not qualify even when the network path is encrypted
by Tailscale. Use `npm run dev:http:tailscale` only for explicit compatibility
checks; camera scanning will direct users to HTTPS and copy actions may fall
back to selecting the complete text for manual copying.

`npm run dev:lan` remains available for explicit raw-LAN inspection and binds
to `0.0.0.0`. This is broader exposure than the default Tailscale-only command;
keep the firewall enabled and stop the server when testing is finished.

## License

This repository is licensed under `AGPL-3.0-or-later`. See [LICENSE](LICENSE).
