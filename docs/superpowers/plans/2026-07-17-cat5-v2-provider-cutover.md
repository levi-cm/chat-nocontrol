# Cat-5 V2 Provider Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace canonical provider and crypto-worker APIs with Cat-5 V2-only identity, contact, text, and vault contracts.

**Architecture:** `CryptoProvider` delegates only to V2 modules. A focused V2 capability module owns validation, cloning, and erasure at worker boundaries. Central crypto-worker contracts carry only V2 text/vault/cancel jobs; V1 vault unlock remains isolated in storage migration.

**Tech Stack:** TypeScript, Vitest, Web Workers, Noble post-quantum primitives, WebCrypto.

---

### Task 1: V2 capability boundary

**Files:**
- Create: `src/crypto/capability-v2.ts`
- Modify: `src/tests/unit/provider-capability.test.ts`

- [ ] **Step 1: Write failing V2 capability tests**

Replace V1/hybrid assertions with tests importing `createDecapsulationCapabilityV2`, `createSenderSigningCapabilityV2`, `validateDecapsulationCapabilityV2`, `validateSenderSigningCapabilityV2`, `zeroizeDecapsulationCapabilityV2`, and `zeroizeSenderSigningCapabilityV2`. Assert exact suite and byte lengths, rejection of suite 1 and malformed lengths, clone independence, and all secret bytes erased.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/tests/unit/provider-capability.test.ts`
Expected: FAIL because `capability-v2.ts` does not exist.

- [ ] **Step 3: Implement minimal V2 capability module**

Export validators that throw `PPXError("unknown-suite")` for suite mismatch and `PPXError("wrong-identity-or-corruption")` for length mismatch. Export clone creators using `Uint8Array.from` and erasers using `zeroize` for signing and KEM secret keys.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/tests/unit/provider-capability.test.ts`
Expected: PASS.

### Task 2: V2-only canonical provider

**Files:**
- Modify: `src/crypto/provider.ts`
- Modify: `src/crypto/default-provider.ts`
- Modify: `src/tests/unit/crypto-provider.test.ts`
- Modify: `scripts/check-crypto-provider-contract.ts`

- [ ] **Step 1: Write failing provider surface tests**

Require `deriveIdentity` to return suite 2 ML-KEM-1024/ML-DSA-87 identity, contact creation/parsing to return V2, text and vault methods to accept V2 types, and runtime provider keys to exclude `createHybridEncapsulation`, QR-text, and file methods. Update source-contract checks to require imports from `identity-v2`, `ppxc-v2`, `text-v2`, and `vault-v2`, while forbidding V1/hybrid/PPXQ imports and methods.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/tests/unit/crypto-provider.test.ts && npm run test:provider-contract`
Expected: FAIL on V1 suite/provider surface.

- [ ] **Step 3: Implement minimal V2 provider**

Define `CryptoProvider` with V2 `deriveIdentity(masterEntropy, pseudonym?, creationTime?)`, `createPublicContact(identity, pseudonym, creationTime, extraEntropy?)`, `parsePublicContact`, `encryptText`, `decryptText`, `lockVault`, and `unlockVault`. Delegate in `DefaultCryptoProvider` only to V2 functions. Preserve existing factory exports.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/tests/unit/crypto-provider.test.ts && npm run test:provider-contract`
Expected: PASS.

### Task 3: V2-only worker contracts and client

**Files:**
- Modify: `src/crypto/contracts.ts`
- Modify: `src/workers/crypto-client.ts`
- Modify: `src/tests/unit/crypto-client.test.ts`
- Modify: `src/tests/unit/worker-contracts.test.ts`

- [ ] **Step 1: Write failing contract/client tests**

Assert request union contains only `encrypt-text`, `decrypt-text`, `lock-vault`, `unlock-vault`, and `cancel`; V2 text decrypt posts only suite/fingerprint/identityId/ML-KEM secret; no X25519 or QR job exports exist; request-owned signing and decapsulation secrets are erased after post, construction failure, post failure, completion, and cancel.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/tests/unit/crypto-client.test.ts src/tests/unit/worker-contracts.test.ts`
Expected: FAIL on QR/X25519/V1 contracts.

- [ ] **Step 3: Implement minimal client/contracts cutover**

Use only V2 protocol and vault types. Clone/validate capabilities through `capability-v2.ts`. Remove QR and file request/event variants from central contracts and remove QR job functions from client. Ensure every startup and post path erases owned authority.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/tests/unit/crypto-client.test.ts src/tests/unit/worker-contracts.test.ts`
Expected: PASS.

### Task 4: V2-only crypto runner and verification

**Files:**
- Modify: `src/workers/crypto-runner.ts`
- Modify: `src/tests/unit/crypto-runner.test.ts`

- [ ] **Step 1: Write failing runner tests**

Use V2 identities and contacts for full and compact text round trips. Assert suite-1 and malformed capabilities are rejected before provider call, worker-owned KEM secrets are erased on success/error/duplicate request, and vault jobs route through V2 provider. Remove V1 adaptive-text and QR assertions.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/tests/unit/crypto-runner.test.ts`
Expected: FAIL because runner validates and routes V1 contracts.

- [ ] **Step 3: Implement minimal runner cutover**

Handle only V2 text/vault/cancel variants. Validate V2 capabilities before decrypt, route to canonical provider, collapse unexpected errors, and erase signing/KEM authority in `finally` and early-rejection paths.

- [ ] **Step 4: Verify targeted GREEN**

Run: `npx vitest run src/tests/unit/provider-capability.test.ts src/tests/unit/crypto-provider.test.ts src/tests/unit/crypto-client.test.ts src/tests/unit/crypto-runner.test.ts src/tests/unit/worker-contracts.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify project gates**

Run: `npm run typecheck && npm run test:provider-contract && npm run build`
Expected: all PASS. Adapt compile-only tests within task scope if obsolete V1 worker/provider types remain; do not edit UI/storage/identity flows or `file-v2.ts`.

- [ ] **Step 6: Commit exact implementation files**

Stage only provider/capability/contracts/crypto-worker files, their tests, and provider-contract script. Exclude shared file-agent changes. Commit: `refactor(crypto): cut provider over to Cat-5 V2`.
