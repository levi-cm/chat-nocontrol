# Human-first README redesign

- **Date:** 2026-07-16
- **Status:** Approved
- **Audience:** App users first, privacy and cryptography enthusiasts second

## Goal

Replace the repository-oriented specification index with a welcoming,
human-readable introduction to Chat NoControl. Keep technical depth available
without making readers understand repository governance before they understand
the product.

## Information order

1. Centered product logo, name, short description, and live-app link.
2. Compact status notice identifying version `0.1.0-beta.1` as a beta preview,
   not a stable or independently reviewed release.
3. Three-step explanation: create or restore an identity, exchange public
   contacts, then encrypt or decrypt locally.
4. Plain-language feature overview covering text, files, contacts, recovery,
   offline use, English/German support, and optional message QR codes.
5. Recovery warning explaining that private QR, `.ppxrecovery`, recovery code,
   24 words, and recovery sheet provide equivalent identity-recovery power.
6. Honest security and privacy summary with supported claims and important
   limitations.
7. Enthusiast-oriented PPX overview linking to protocol, architecture, and
   threat-model documents.
8. Local development and verification commands.
9. Small documentation, contributing, security-reporting, and license footer.

## Presentation

- Use the existing local logo rather than a remote image.
- Use a centered HTML hero because GitHub Markdown has no native centering.
- Use a few factual badges only when they add scannable information.
- Prefer short paragraphs, bullets, and one compact limitations table.
- Remove authority metadata, agent-oriented review instructions, the exhaustive
  documentation-status table, and stale repository-privacy wording.
- Keep English as the README language while linking both user guides.

## Accuracy boundaries

- Version comes from `package.json`: `0.1.0-beta.1`.
- The public Pages URL may be presented as a live preview because it currently
  responds successfully, but it must not be described as a stable release.
- GitHub currently has no published release, and local release evidence records
  no completed deployment transaction.
- State that the exact candidate lacks completed independent security-review
  evidence and that release gates remain open.
- Describe implemented behavior only; do not imply messaging accounts, message
  history, groups, cloud sync, forward secrecy, or a backend.
- Preserve the existing narrow cryptographic claim: ML-KEM-512 plus X25519 for
  hybrid confidentiality, Ed25519 authentication, and AES-256-GCM content
  protection.

## Verification

- Check every relative README link against the current tree.
- Run the documentation terminology check.
- Run Markdown formatting and lint checks scoped to the README and this spec.
- Review the final diff for accidental changes and stale claims.
