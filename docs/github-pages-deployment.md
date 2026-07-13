> **Authority:** Chat NoControl documentation authority; this file normatively defines the GitHub Pages deployment contract for the public beta.
> **Version:** 1.0-draft
> **Status:** Public beta candidate / unaudited / not deployed
> **Depends on:** [product-spec.md](product-spec.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [protocol-v1.md](protocol-v1.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# GitHub Pages Deployment Contract

Last verified: 2026-07-13.

## 1. Deployment model

The public beta is deployed only as a static GitHub Pages site built from a GitHub Actions artifact.

The deployment must stay backend-free:

- no application server;
- no database;
- no user account service;
- no remote script dependency;
- no telemetry endpoint;
- no remote font or image dependency.

Custom domains may be added later, but the current contract remains GitHub Pages first.

## 2. Hosting limits

GitHub Pages constraints relevant to this design are:

- published sites may be no larger than 1 GB;
- source repositories have a recommended limit of 1 GB;
- deployments time out after 10 minutes;
- bandwidth has a soft limit of 100 GB per month;
- build rate limits still matter for direct Pages builds, even though custom GitHub Actions workflows follow a different path.

Primary references:

- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## 3. Path, routing, and assets

The app must work from a repository subpath.

Rules:

- derive the base path from the deployment location;
- do not hardcode `/` as the app root;
- use hash routing for client-side navigation;
- keep asset URLs relative or base-aware;
- make offline shell assets versioned and cacheable.

Hash routing is required because GitHub Pages does not provide an app server that can rewrite arbitrary deep links to `index.html`.

## 4. Security headers and CSP

GitHub Pages does not give this design arbitrary project-controlled response headers.

That means:

- the app must not depend on custom headers for correctness;
- `frame-ancestors` cannot be enforced through a `<meta>` CSP tag and is therefore not available as a reliable policy control here;
- any CSP in this deployment is partial mitigation only.

Use this exact meta CSP baseline in the deployed HTML where practical:

```text
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data: blob:;
media-src 'self' blob:;
connect-src 'self';
font-src 'self';
object-src 'none';
base-uri 'none';
form-action 'none';
worker-src 'self' blob:;
manifest-src 'self'
```

Rules:

- remote resources are prohibited;
- inline remote scripts are prohibited;
- third-party analytics are prohibited;
- third-party fonts are prohibited;
- third-party embeds are prohibited unless a separate review explicitly changes this contract.

## 5. Service worker policy

The service worker may cache only:

- the application shell;
- versioned static assets;
- hashed JavaScript, CSS, icons, and manifest files.

The service worker must never cache:

- user data;
- decrypted content;
- imported files;
- private vault material;
- recovery material;
- generated diagnostics that are still being reviewed by the user.

The offline goal is availability of the app shell and previously fetched versioned assets, not silent data persistence.

## 6. Update and rollback behavior

The app must show a clear update prompt when a deployed version changes.

The prompt must not ask the user to reload in the middle of encryption, decryption, or an open decrypted view.

Release records must include:

- the release tag;
- the commit SHA;
- the artifact hash;
- the build log;
- the SBOM;
- the rollback pointer for the previous deployed artifact.

The public beta release requires the exact package-version tag to be annotated
and signed. Its target, local signature verification result, and remote object
ID must be recorded.

## 7. Provenance checklist

Before publishing a Pages beta:

1. Confirm the commit SHA used to build the artifact.
2. Record the artifact hash.
3. Record the generated SBOM.
4. Confirm the base path works under the Pages URL.
5. Confirm hash routing works on refresh and direct navigation.
6. Confirm the CSP meta tag is present and consistent.
7. Confirm no remote resources are loaded.
8. Confirm the service worker caches only versioned assets.
9. Confirm rollback can restore the previous known-good deployment.

## 8. Operational limits

This deployment contract does not promise:

- arbitrary response headers;
- custom server logic;
- secret server-side checks;
- user-specific server storage;
- server-side access control beyond what GitHub Pages itself provides.

If later deployment needs a feature that GitHub Pages cannot supply, that feature belongs in a different hosting contract, not in this one.
