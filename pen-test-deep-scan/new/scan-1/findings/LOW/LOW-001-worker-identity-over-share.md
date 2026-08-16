# LOW-001: Full DerivedIdentity (including masterEntropy recovery authority) shipped to crypto/file workers for every decrypt operation

- **Severity:** LOW
- **Category:** crypto
- **Subsystem:** src/workers/crypto-client.ts, src/workers/file-client.ts (caller); src/crypto/text.ts, src/crypto/qr-text.ts, src/crypto/file.ts, src/crypto/hybrid.ts (consumer)
- **Locations:** `src/workers/crypto-client.ts:82`, `src/workers/file-client.ts:104`, `src/protocol/types.ts:33`, `src/crypto/hybrid.ts:151`, `src/crypto/text.ts:143`, `src/crypto/file.ts:501`
- **Exploitability:** Theoretical — recovering the over-shared material requires reading the dedicated worker's heap (same-origin, separate thread). A same-origin attacker who can read the worker heap can typically already read the main-thread heap where the identity also lives for the whole session. The threat model (§5) explicitly disclaims protection against compromised extensions/OS/browser. The incremental risk is therefore limited to narrow scenarios where worker memory is observable but main-thread memory is not (e.g., a worker-specific side channel or exfiltration bug). No remote or unauthenticated path was found.
- **Impact:** If the over-shared `masterEntropy` (32 bytes) is recovered from the worker heap, an attacker can reconstruct the entire identity (all KEM/X25519/Ed25519 keys + fingerprint) and decrypt every past and future message for that identity — it is the recovery authority. The `signingSecretKey` (32-byte Ed25519 seed) would additionally allow forging sender signatures. This is a confidentiality + integrity + key-recovery impact, but gated behind the very low exploitability above.

## Summary

Every text, QR-text, and file decrypt job posts the complete `DerivedIdentity` object — including the 32-byte `masterEntropy` (the recovery authority) and the 32-byte `signingSecretKey` (Ed25519 signing seed) — into a dedicated worker via `postMessage`/structured clone. The decrypt code paths only ever read `kemSecretKey`, `x25519SecretKey`, `fingerprint`, and `identityId` from that identity. The two highest-value secrets are therefore copied into a secondary heap on every decrypt operation with no operational need, expanding the secret surface beyond what least privilege requires.

## Vulnerability detail

`DecryptTextInput`, `DecryptQrTextInput`, and `DecryptFileInput` all carry `activeIdentity: DerivedIdentity`:

```ts
// src/protocol/types.ts:33
export interface DerivedIdentity {
  suite: 0x01;
  creationTime: bigint;
  masterEntropy: Uint8Array;      // 32 bytes — RECOVERY AUTHORITY
  kemPublicKey: Uint8Array;
  kemSecretKey: Uint8Array;
  x25519PublicKey: Uint8Array;
  x25519SecretKey: Uint8Array;
  signingPublicKey: Uint8Array;
  signingSecretKey: Uint8Array;   // 32-byte Ed25519 seed
  fingerprint: Uint8Array;
  identityId: Uint8Array;
  pseudonym: string;
}
```

The client posts the entire request (identity included) to the worker with no field filtering:

```ts
// src/workers/crypto-client.ts:82
worker.postMessage(request);

// src/workers/file-client.ts:104
worker.postMessage(request);
```

Structured clone copies every field of `activeIdentity` into the worker's heap. The worker then passes `request.input` straight to the provider, which passes `activeIdentity` to `decapsulateHybrid`:

```ts
// src/crypto/hybrid.ts:151-158
mlKemSharedSecret = mlKem512Decapsulate(
  input.mlKemCiphertext,
  input.activeIdentity.kemSecretKey,        // used
);
xShared = x25519SharedSecret(
  input.activeIdentity.x25519SecretKey,     // used
  input.ephemeralX25519PublicKey,
);
return deriveHybridKey({
  recipientFingerprint: input.activeIdentity.fingerprint,  // used
  ...
});
```

The only other field read is `identityId` for recipient binding (`src/crypto/text.ts:165`, `src/crypto/qr-text.ts:167`, `src/crypto/file.ts:563`). `masterEntropy` and `signingSecretKey` are never read on any decrypt path. They are copied into the worker heap, sit there for the operation duration, and are freed only when the worker is terminated (on completion, error, or cancel).

## Exploit scenario

1. A user decrypts a message/file. The main thread calls `startDecryptTextJob` / `startDecryptFileJob`.
2. `postMessage` structured-clones the full `DerivedIdentity` — including `masterEntropy` — into the dedicated worker.
3. An attacker who can observe the worker's heap during the operation (e.g., via a worker-memory side channel, a debugger attached to the worker, or a future bug that causes the worker to leak data) recovers `masterEntropy`.
4. The attacker reconstructs the full identity via `deriveIdentityFromEntropy(masterEntropy)` and decrypts all past and future traffic for that identity.

Assumptions: the attacker can read worker memory but not main-thread memory (otherwise the main-thread identity copy is already game-over, and this finding adds nothing). This is a narrow condition that the threat model partially disclaims — hence LOW severity, not higher.

## Proof of concept

No standalone PoC built. Inline minimal observation (local, non-harmful):

```ts
// The decrypt functions read only these identity fields:
//   kemSecretKey, x25519SecretKey, fingerprint, identityId
// But postMessage ships all 12 fields, including masterEntropy + signingSecretKey.
//
// Minimal repro: instrument a Worker to log structured-clone key names.
const worker = new Worker(new URL("./crypto-worker.ts", import.meta.url), {
  type: "module",
});
worker.addEventListener("message", console.log);
// Before posting, the request.input.activeIdentity contains masterEntropy.
// After postMessage, the worker's copy also contains masterEntropy.
// grep the decrypt path: no reference to .masterEntropy or .signingSecretKey.
```

A static confirmation: `grep -rn "activeIdentity\.masterEntropy\|activeIdentity\.signingSecretKey" src/crypto/` returns zero matches on decrypt paths.

## Remediation

Introduce a narrow decapsulation-capability type carrying only the fields decrypt needs, and have the main thread construct it (copying only the required keys) before posting to the worker. This keeps the recovery authority out of the worker heap.

```ts
// New type (in protocol/types.ts — outside this child's edit scope, recommend to parent):
export interface DecapsulationCapability {
  fingerprint: Uint8Array;   // 32 bytes
  identityId: Uint8Array;    // 20 bytes
  kemSecretKey: Uint8Array;  // ML-KEM-512 secret key
  x25519SecretKey: Uint8Array; // 32 bytes
}

export interface DecryptTextInput {
  object: EncryptedTextObject;
  activeIdentity: DecapsulationCapability; // was DerivedIdentity
}
// Similarly for DecryptQrTextInput and DecryptFileInput.
```

The main-thread client would build the capability from the full identity:

```ts
function decapsulationCapability(identity: DerivedIdentity): DecapsulationCapability {
  return {
    fingerprint: Uint8Array.from(identity.fingerprint),
    identityId: Uint8Array.from(identity.identityId),
    kemSecretKey: Uint8Array.from(identity.kemSecretKey),
    x25519SecretKey: Uint8Array.from(identity.x25519SecretKey),
  };
}
```

`decapsulateHybrid` already reads only these four fields, so no crypto-file change is needed beyond the type narrowing. `lockVault` (which genuinely needs the full identity) would keep `LockVaultInput.identity: DerivedIdentity`.

## Verification of fix

After the type change, confirm the worker never receives `masterEntropy`:

```sh
# Decrypt paths must not reference masterEntropy/signingSecretKey:
rg "activeIdentity\.(masterEntropy|signingSecretKey)" src/crypto/ src/workers/
# Should return zero matches.

# Type check:
npm run typecheck
```

A runtime check: instrument the worker's `message` handler to assert that `event.data.input.activeIdentity.masterEntropy` is `undefined`.

## References

- OWASP Cryptographic Storage Cheat Sheet (minimize secret exposure).
- CWE-200: Exposure of Sensitive Information to an Unauthorized Actor.
- PPX threat-model.md §5 (not protected against compromised endpoints/extensions) and §3 (assumed attacker capabilities) — frames this as defense-in-depth within disclaimed scenarios.
- PPX security-architecture.md §4 ("The active identity is never wiped by an encryption operation") — this finding does not conflict; it concerns the copy shipped to the worker, not the in-memory identity.
