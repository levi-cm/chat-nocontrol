> **Authority:** Chat NoControl documentation authority; this file normatively defines the security and vulnerability reporting rules for the public beta docs package.
> **Version:** 1.0-draft
> **Status:** Public beta candidate / unaudited / not deployed
> **Depends on:** [docs/protocol-v1.md](docs/protocol-v1.md), [docs/security-architecture.md](docs/security-architecture.md), [docs/threat-model.md](docs/threat-model.md), [docs/product-spec.md](docs/product-spec.md), [docs/ux-content-spec.md](docs/ux-content-spec.md), [docs/design-spec.md](docs/design-spec.md), [docs/accessibility-i18n.md](docs/accessibility-i18n.md), [README.md](README.md), [WebLibre_full_plan.md](WebLibre_full_plan.md)
> **Supersedes:** The original WebLibre plan is historical only; it remains archive context, not an active specification.

# Security

Chat NoControl and PPX Protocol v1 are documented here as a public beta candidate. No stable supported version exists yet. These notes are intentionally narrow and literal.

## Security Claims

Version 1 claims:

- Hybrid confidentiality from ML-KEM-512 and classical X25519.
- Classical sender authentication from Ed25519.
- AES-256-GCM content confidentiality and integrity.
- Strict local parsing with explicit length and version checks.

Version 1 does not claim:

- Post-quantum signatures.
- Forward secrecy.
- A ratchet.
- Quantum-proof security.
- Signal-equivalent security.
- Stable production status.

## Review Gate

This public beta remains unaudited until the protocol implementation and its full object formats receive independent security review.

That review is a blocker for publishing or claiming public-beta readiness.

## Vulnerability Reporting

Use GitHub private vulnerability reporting only:

- Go to the repository's `Security` tab.
- Choose `Advisories`.
- Select `Report a vulnerability`.

Use that path once the repository is published and security advisories are enabled. Do not invent or publish an email address here. Do not open public issues for security vulnerabilities.

If private vulnerability reporting is not available yet, keep the report private until the channel exists.

This reporting channel is required before the repository can be treated as public beta.

## What To Include

- Affected file, feature, object, or user flow.
- Affected version, commit, or document revision if known.
- Clear impact description.
- Minimal reproduction steps.
- Safe proof of concept if needed to show the bug.
- Whether the issue affects confidentiality, integrity, authenticity, availability, or claim accuracy.
- Whether the problem is in docs, protocol text, or implementation.

## What To Omit

- Private keys, recovery words, passphrases, tokens, or live identities.
- Full exploit chains when a shorter reproduction is enough.
- Unnecessary screenshots with sensitive content.
- Public disclosure before coordinated review.
- Guesswork about severity without evidence.

## Disclosure Targets

- Acknowledge receipt within 7 days as a target.
- Keep the report private while triage and fix work happen.
- Coordinate disclosure with the maintainer before any public writeup.
- Use a public GitHub issue draft only for sanitized non-security diagnostics that do not expose an exploit path.

## Supported Reality

There is no stable supported version number to rely on yet. The documented state is `1.0-draft`, `public beta candidate`, `unaudited`, and `not deployed`. Any stronger claim would require a new reviewed release process and updated security documentation.
