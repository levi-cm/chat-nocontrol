> **Authority:** Chat NoControl documentation authority; this file normatively defines contribution rules for the public beta docs package.
> **Version:** 1.0-draft
> **Status:** Public beta candidate / unaudited / not deployed
> **Depends on:** [README.md](README.md), [SECURITY.md](SECURITY.md), [docs/product-spec.md](docs/product-spec.md), [docs/protocol-v1.md](docs/protocol-v1.md), [docs/security-architecture.md](docs/security-architecture.md), [docs/threat-model.md](docs/threat-model.md), [docs/design-spec.md](docs/design-spec.md), [docs/ux-content-spec.md](docs/ux-content-spec.md), [docs/accessibility-i18n.md](docs/accessibility-i18n.md), [docs/user-guide.en.md](docs/user-guide.en.md), [docs/user-guide.de.md](docs/user-guide.de.md), [WebLibre_full_plan.md](WebLibre_full_plan.md)
> **Supersedes:** The original WebLibre plan is historical only; it remains archive context, not an active specification.

# Contributing

This repository is in a docs-first phase. Keep changes aligned to the existing documentation set unless a later task explicitly asks for implementation work.

## Core Rules

- Use `Chat NoControl` for the product brand.
- Use `PPX` for the protocol family.
- Use `WebLibre` only when referring to the historical archive plan.
- Do not add stronger security claims than the docs already support.
- Do not use `quantum-proof`, `unbreakable`, `Signal-equivalent`, or similar marketing language unless the security docs are updated first.
- Do not introduce analytics, telemetry, backend services, relays, account systems, remote fonts, remote scripts, or remote images.
- Preserve the calm product tone even though the brand name is satirical.

## Protocol And Versioning

Any change to protocol bytes, object layouts, key derivation, fingerprints, checksums, or security claims requires:

- A versioned protocol update.
- A revised vector or object example where applicable.
- Updated threat and security documentation.
- Review against the current public beta limits.

Do not silently change a byte layout or a claim in one file only.

## Language And Parity

- Keep English and German user-visible content semantically aligned.
- Update both languages together when a user-facing term changes.
- Prefer exact terminology from the product, protocol, and security docs.
- Do not translate a security claim into something stronger or looser than the source language.

## Testing And Verification

Use test-driven development if implementation work is added later.

For docs changes, verify locally before handoff:

- Run `rg` to check terminology consistency.
- Run `rg --files` or equivalent to confirm links point to real files.
- Manually inspect relative links in the changed documents.
- If code or build artifacts are added later, add focused tests before claiming the work is done.

## Accessibility

Any future UI or content work must stay accessible:

- Prefer clear labels over decorative language.
- Keep warnings and destructive actions explicit.
- Preserve keyboard and screen-reader friendliness.
- Do not trade accessibility for visual flair.

## Issue And PR Workflow

If this repository is later published with issue and pull request workflows, use small, scoped changes with clear evidence and impact notes.

In this checkout, work directly in the local tree and keep the change set narrow.

## Licensing

Contributions here are expected under `AGPL-3.0-or-later`, matching the repository license. Do not invent a CLA or DCO requirement unless one is added later in writing.
