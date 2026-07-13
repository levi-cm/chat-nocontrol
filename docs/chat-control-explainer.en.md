> **Authority:** Chat NoControl documentation authority; this file is a public explainer for the policy context around chat control language and child-safety claims.
> **Version:** 1.0-draft
> **Status:** Public beta candidate / unaudited / not deployed
> **Depends on:** [product-spec.md](product-spec.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [user-guide.en.md](user-guide.en.md), [user-guide.de.md](user-guide.de.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# Chat Control Explainer

Last verified: 2026-07-12.

## 1. Purpose

This document explains the policy context that people often call "chat control". It is not legal advice and it is not a product requirement document.

The project position is narrow:

- Child protection and private communications are compatible.
- The project opposes generalized scanning of private communications.
- The project does not oppose child protection.

## 2. Official and colloquial terms

Official EU wording usually refers to rules to prevent and combat child sexual abuse online.

The colloquial label "chat control" is shorthand used in public debate. In German, the colloquial label is usually "Chatkontrolle".

Use the colloquial label only as shorthand. Do not treat it as the formal title of the legislative file.

## 3. Current status

As of 2026-07-12, the status is volatile and should be rechecked before publication.

- The long-term file 2022/0155(COD) remains under negotiation.
- The European Parliament legislative train page labels the file as tabled and notes that trilogues are ongoing, with an update as of 20 June 2026.
- The temporary ePrivacy derogation expired on 3 April 2026 after the European Parliament rejected an extension in March 2026.
- The Council press release of 2 July 2026 says the Council adopted a common position to reinstate an interim voluntary-detection measure until 3 April 2028 and move the file to Parliament second reading.

## 4. What this means

The policy dispute is not whether child protection matters. It is about which detection duties, if any, should apply to private communication services and what safeguards are required.

The project position is that:

- safety measures must be targeted and proportionate;
- private communications do not become public just because a service exists;
- content protection and child protection are not mutually exclusive;
- generalized scanning is a separate policy choice from child protection.

## 5. Scope of the project

The application is a local browser tool. It can help users protect content on their device and in transit according to the design, but it does not:

- hide that a communication exists;
- hide metadata;
- provide legal evasion;
- bypass lawful access controls;
- promise immunity from investigation or reporting duties.

The app is designed for local encryption and decryption only. It is not a network relay, a messaging backend, or a detection evasion system.

## 6. Security and privacy language

Use plain, non-hyped language:

- Say "encrypts on this device".
- Say "does not create an online account".
- Say "does not hide metadata".
- Say "does not claim legal evasion".

Avoid claims such as:

- "undetectable";
- "anonymous by default";
- "metadata-free";
- "law-proof";
- "scan-proof".

## 7. Source links

Primary sources for this explainer are listed in [references.md](references.md). The most important official links are:

- [European Parliament legislative train: 2022/0155(COD)](https://www.europarl.europa.eu/legislative-train/carriage/combating-child-sexual-abuse-online/report?sid=10401)
- [European Parliament press release, 26 March 2026](https://www.europarl.europa.eu/news/en/press-room/20260325IPR39207/)
- [Council press release, 2 July 2026](https://www.consilium.europa.eu/en/press/press-releases/2026/07/02/council-moves-to-reinstate-interim-measure-to-combat-child-sexual-abuse-online/)
