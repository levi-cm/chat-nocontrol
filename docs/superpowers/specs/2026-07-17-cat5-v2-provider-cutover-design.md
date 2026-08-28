# Cat-5 V2 provider cutover

## Scope

Make the canonical crypto provider, central worker contracts, and crypto text/vault worker path Cat-5 V2-only. Do not change UI, storage, identity flows, file worker integration, or `file-v2.ts`.

## Architecture

- `CryptoProvider` exposes only V2 identity derivation, V2 public-contact creation/parsing, V2 text encryption/decryption, and V2 vault lock/unlock.
- `DefaultCryptoProvider` delegates directly to `identity-v2`, `ppxc-v2`, `text-v2`, and `vault-v2`.
- Central crypto-worker contracts contain only V2 text, V2 vault, and cancellation jobs. File work remains owned by the separate file worker and is absent from this contract during cutover.
- PPXQ QR-text jobs and hybrid X25519 encapsulation are removed from reachable provider and crypto-worker APIs.
- Legacy V1 vault unlock remains reachable only from `storage/vault-migration-v2.ts` as an isolated direct migration dependency.

## Capability boundary

V2 decapsulation capabilities require suite `0x02`, 32-byte fingerprint, 20-byte identity ID, and 3,168-byte ML-KEM-1024 secret key. Signing capabilities require suite `0x02`, 32-byte fingerprint, 2,592-byte ML-DSA-87 public key, and 4,896-byte secret key. Worker/client paths clone the minimum capability, validate at worker entry, and erase request-owned secret arrays after transfer, rejection, completion, cancellation, or startup failure.

## Errors

Unsupported suites fail as `unknown-suite`. Malformed capability lengths fail closed as `wrong-identity-or-corruption`. Worker exceptions expose only existing safe PPX error codes.

## Tests

Use TDD for provider surface and capability behavior. Update provider-contract checks to require V2 modules and forbid V1 identity/contact/text/vault, hybrid X25519, PPXQ methods, and legacy unlock imports outside migration. Update crypto client/runner tests for V2-only jobs, validation, text round-trip, and all secret-zeroization paths. Typecheck, targeted unit tests, provider-contract script, and build must pass.
