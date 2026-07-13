> **Authority:** Chat NoControl documentation authority; this file is the reference registry for normative and informative source material used by the public beta docs package.
> **Version:** 1.0-draft
> **Status:** Public beta candidate / unaudited / not deployed
> **Depends on:** [product-spec.md](product-spec.md), [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [accessibility-i18n.md](accessibility-i18n.md), [github-pages-deployment.md](github-pages-deployment.md), [testing-and-release.md](testing-and-release.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# References

Last verified: 2026-07-12.

## 1. How this file works

This registry collects source material used by the docs package.

Rules:

- authoritative standards and official policy pages come first;
- reference links support the docs, they do not replace them;
- dependency versions are pinned in `package-lock.json` at implementation time, not frozen here;
- this file does not claim that every listed source is used by the current implementation, only that it is the intended source pool.

## 2. Cryptography references

| Source | Link | Purpose | Notes |
|---|---|---|---|
| FIPS 203 | [NIST FIPS 203](https://csrc.nist.gov/pubs/fips/203/final) | ML-KEM standard | Official NIST standard |
| FIPS 197 | [NIST FIPS 197](https://csrc.nist.gov/pubs/fips/197/final) | AES standard | Official NIST standard |
| SP 800-38D | [NIST SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final) | GCM mode guidance | Official NIST recommendation |
| RFC 5869 | [RFC Editor](https://www.rfc-editor.org/info/rfc5869/) | HKDF | Primary IETF reference |
| RFC 7914 | [RFC Editor](https://www.rfc-editor.org/info/rfc7914/) | scrypt | Primary IETF reference |
| RFC 8032 | [RFC Editor](https://www.rfc-editor.org/info/rfc8032/) | Ed25519 / EdDSA | Primary IETF reference |
| RFC 9285 | [RFC Editor](https://www.rfc-editor.org/info/rfc9285/) | Base45 | Primary IETF reference |
| BIP39 English word list | [bitcoin/bips english.txt](https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt) | 24-word recovery encoding | Source list only; PBKDF2 seed derivation is not used for PPX |
| Web Crypto API | [W3C Web Cryptography Level 2](https://www.w3.org/TR/webcrypto-2/) | Browser crypto interface reference | API behavior and constraints |
| Noble post-quantum | [paulmillr/noble-post-quantum](https://github.com/paulmillr/noble-post-quantum) | Planned PQ implementation source | Upstream source reference, not a locked dependency |
| Noble curves | [paulmillr/noble-curves](https://github.com/paulmillr/noble-curves) | Planned curve implementation source | Upstream source reference, not a locked dependency |
| Noble hashes | [paulmillr/noble-hashes](https://github.com/paulmillr/noble-hashes) | Planned hash/KDF implementation source | Upstream source reference, not a locked dependency |
| Noble ciphers | [paulmillr/noble-ciphers](https://github.com/paulmillr/noble-ciphers) | Planned symmetric crypto source | Upstream source reference, not a locked dependency |

## 3. Web platform references

| Source | Link | Purpose | Notes |
|---|---|---|---|
| IndexedDB API | [MDN IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) | Local storage reference | Client-side persistence model |
| Service Workers | [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) | Offline shell and caching reference | Cache only versioned assets |
| File API | [MDN File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API) | File input and access reference | User-selected files only |
| Blob | [MDN Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) | In-memory file-like data reference | Used for exports and downloads |
| Web Share API | [MDN Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API) | Sharing text/files from the app | Secure-context sharing behavior |
| Web app manifest share_target | [MDN share_target](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target) | Receiving shared content | Optional PWA integration reference |
| URL blob: scheme | [MDN blob: URLs](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob) | Blob URL behavior | Object URL lifetime and cleanup |

## 4. Accessibility and localization references

| Source | Link | Purpose | Notes |
|---|---|---|---|
| WCAG 2.2 | [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Accessibility target | AA goal for the product |
| WCAG overview | [WAI WCAG overview](https://www.w3.org/WAI/standards-guidelines/wcag/) | Accessibility guidance | Supporting non-normative overview |
| WCAG quick reference | [WAI quick reference](https://www.w3.org/WAI/WCAG22/quickref/) | Test planning aid | Helpful for implementation checks |

## 5. Deployment references

| Source | Link | Purpose | Notes |
|---|---|---|---|
| GitHub Pages limits | [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) | Deployment size and build constraints | 1 GB site limit, 10 min timeout, 100 GB soft bandwidth limit |
| What is GitHub Pages | [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) | Static hosting model | Repository-backed static site description |
| Custom domain setup | [Configuring a custom domain](https://docs.github.com/articles/setting-up-a-custom-domain-with-pages) | Later domain planning | Not required for the current beta |

## 6. EU policy references

| Source | Link | Purpose | Notes |
|---|---|---|---|
| EP legislative train | [European Parliament legislative train](https://www.europarl.europa.eu/legislative-train/carriage/combating-child-sexual-abuse-online/report?sid=10401) | Long-term 2022/0155(COD) status | Status noted as of 20 June 2026 |
| EP press release | [European Parliament press release, 26 March 2026](https://www.europarl.europa.eu/news/en/press-room/20260325IPR39207/) | Interim derogation extension rejected | Confirms expiry after 3 April 2026 |
| Council press release | [Council press release, 2 July 2026](https://www.consilium.europa.eu/en/press/press-releases/2026/07/02/council-moves-to-reinstate-interim-measure-to-combat-child-sexual-abuse-online/) | Council common position | Voluntary detection reinstatement attempt to 3 April 2028 |

## 7. Reference usage notes

- Use the official links when updating the explainer docs.
- Use the product, protocol, security, accessibility, deployment, and release docs as the active normative layer.
- Treat policy status as volatile and verify it again before publishing any user-facing explainer.
- Keep the distinction between official legislative wording and the colloquial "chat control" label.
