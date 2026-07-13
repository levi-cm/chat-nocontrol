> **Authority:** Chat NoControl documentation authority; this file normatively defines the repository overview for the public beta docs package.
> **Version:** 1.0-draft
> **Status:** Public beta candidate / unaudited / not deployed
> **Depends on:** [docs/product-spec.md](docs/product-spec.md), [docs/protocol-v1.md](docs/protocol-v1.md), [docs/security-architecture.md](docs/security-architecture.md), [docs/threat-model.md](docs/threat-model.md), [docs/design-spec.md](docs/design-spec.md), [docs/ux-content-spec.md](docs/ux-content-spec.md), [docs/accessibility-i18n.md](docs/accessibility-i18n.md), [docs/user-guide.en.md](docs/user-guide.en.md), [docs/user-guide.de.md](docs/user-guide.de.md), [docs/testing-and-release.md](docs/testing-and-release.md), [docs/references.md](docs/references.md), [WebLibre_full_plan.md](WebLibre_full_plan.md)
> **Supersedes:** The original WebLibre plan is historical only; it remains archive context, not an active specification.

# Chat NoControl

Chat NoControl is the calm product behind a satirical brand name. This
repository contains a static Preact implementation plus the normative PPX
documentation. Identity recovery, contacts, local storage, offline shell,
encrypted text, and worker-backed encrypted files are implemented. It remains
an unaudited public beta candidate, not a stable-security or deployed-product
claim; current release evidence is required before publication.

The current protocol family is PPX Protocol v1. It is an unaudited public beta candidate. There is no supported stable release version yet.

- Source: <https://github.com/levi-cm/chat-nocontrol>
- Planned public beta site: <https://levi-cm.github.io/chat-nocontrol/>

## What v1 Is

- Static, accountless, browser-first product concept with no backend, relay, key server, telemetry, analytics, or remote dependency.
- One active identity at a time.
- One recipient per encrypted output.
- Local encrypt and decrypt flows for text and files.
- Public contacts exchanged as QR or file payloads.
- Private identity material stored only as an encrypted vault when the user explicitly chooses persistence.
- English and German launch content.
- Calm, Apple-like mobile/desktop UI governed by the approved visual spec.

## Exact v1 Limits

- Text support: up to `256 KiB`.
- File support: up to `100 MiB`.
- Optional file caption: up to `16 KiB`.
- Session-only mode when storage is unavailable or the user declines persistence.
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

## License

This repository is licensed under `AGPL-3.0-or-later`. See [LICENSE](LICENSE).
