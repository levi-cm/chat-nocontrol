# LOW-004: No test that vault parsing rejects a crafted KDF downgrade (scrypt N < 65536)

- **Severity:** LOW
- **Category:** test-gap
- **Subsystem:** src/tests/unit/ppxv.test.ts, src/tests/unit/vault-failure.test.ts, src/tests/property/vault-roundtrip.property.test.ts
- **Locations:** `src/protocol/ppxv.ts:96`, `src/protocol/ppxv.ts:78`, `src/tests/unit/vault-failure.test.ts:55`
- **Exploitability:** Theoretical — `parseLockedVault` enforces the fixed scrypt parameters before checksum verification, so a downgrade is currently rejected. The gap is that no regression test guards this check; a refactor that removed the parameter binding would pass the suite.
- **Impact:** A crafted PPXV that lowers the scrypt cost (N/R/P) would, if accepted, enable an offline attacker to brute-force the vault password far more cheaply (weak-KDF downgrade). §14-adjacent security-critical negative path with no test.

## Summary

`docs/security-architecture.md` §16.1 pins the vault KDF to `scryptN: 65536, scryptR: 8, scryptP: 2, kdfId: 1`. `parseLockedVault` validates these constants (`ppxv.ts:96`) before it ever checks the checksum, so an attacker who rewrites the scryptN field and recomputes the checksum is still rejected. No test, however, feeds a crafted PPXV with weakened scrypt parameters and asserts rejection. The existing vault tests cover the wrong-passphrase/corruption oracle collapse and the happy round-trip, but not the KDF-parameter downgrade path.

## Vulnerability detail

Implementation enforces the downgrade rejection in `src/protocol/ppxv.ts`:

```ts
// src/protocol/ppxv.ts:78  — scryptN read from wire
const scryptN = reader.readUint64BE();
const scryptR = reader.readUint32BE();
const scryptP = reader.readUint32BE();
...
// src/protocol/ppxv.ts:96  — checked BEFORE checksum verification (line 102)
if (kdfId !== 1 || scryptN !== 65_536n || scryptR !== 8 || scryptP !== 2) {
  throw new PPXError("noncanonical-text");
}
```

Because the parameter check (line 96) precedes the checksum check (line 102), an attacker cannot bypass it by recomputing the checksum after lowering N — the parser throws `noncanonical-text` first. The encode side mirrors this (`ppxv.ts:20–27`).

Existing vault test coverage:
- `src/tests/unit/vault-failure.test.ts:55` ("uses one error for wrong passphrase and corruption") — verifies the wrong-pass vs. corruption oracle collapse (a §14 concern). It does NOT test a parameter-downgrade object.
- `src/tests/property/vault-roundtrip.property.test.ts:7` — round-trips valid passphrases only (happy path).
- `src/tests/unit/ppxv.test.ts` — does not exist as a dedicated negative suite for the vault header; the `test:ppx-golden` run includes `ppxv.test.ts` but it covers golden-vector matching, not crafted-parameter rejection.

What is NOT asserted:
1. A syntactically valid, checksum-recomputed PPXV with `scryptN = 1024` (or `scryptR`/`scryptP`/`kdfId` altered) is rejected by `parseLockedVault`.
2. `unlockVault` never reaches `deriveVaultKey` with downgraded parameters (i.e. the parser rejects before the KDF runs).

## Exploit scenario

Assumptions: a future refactor relaxes `ppxv.ts:96` to accept "any scryptN >= 1024" for forward compatibility, or moves the parameter check after the checksum check, or deletes it. The current suite has no assertion that would fail.

1. An attacker with write access to the victim's IndexedDB (e.g. via another stored XSS, or physical access) replaces the stored PPXV with a crafted one: identical ciphertext/salt/nonce, but `scryptN = 1024` (or 1), and a recomputed checksum.
2. The victim unlocks with their normal password. The KDF now runs at a tiny cost.
3. The attacker, having exfiltrated the crafted PPXV, brute-forces the password offline at ~64×–65536× lower cost, recovering the identity keys.

No test in the suite feeds a downgraded-parameter PPXV to `parseLockedVault`/`unlockVault`, so the regression ships undetected.

## Proof of concept

The missing assertion (non-harmful, test-only):

```ts
// In src/tests/unit/vault-failure.test.ts (or a new ppxv-negative suite)
import { encodeLockedVaultHeader, parseLockedVault } from "../../protocol/ppxv";
import { checksum16 } from "../../protocol/checksum";
import { StrictByteWriter } from "../../protocol/bytes";

it("rejects a crafted PPXV with a downgraded scrypt cost before running the KDF", () => {
  // Build a header identical to a real vault but with scryptN = 1024.
  const writer = new StrictByteWriter(56 + 58 + 16); // header + min ciphertext + checksum
  const header = new StrictByteWriter(56);
  header.writeBytes(new TextEncoder().encode("PPXV"));
  header.writeUint8(1); // version
  header.writeUint8(1); // suite
  header.writeUint8(1); // flags
  header.writeUint8(1); // kdfId
  header.writeUint64BE(1024n);          // downgraded scryptN (should be 65536)
  header.writeUint32BE(8);
  header.writeUint32BE(2);
  header.writeBytes(new Uint8Array(16)); // salt
  header.writeBytes(new Uint8Array(12)); // nonce
  header.writeUint32BE(58);              // ciphertextLength
  const headerBytes = header.toBytes();
  writer.writeBytes(headerBytes);
  writer.writeBytes(new Uint8Array(58)); // ciphertext
  const payload = writer.toBytes().subarray(0, 56 + 58);
  writer.writeBytes(checksum16(payload)); // attacker recomputes checksum
  expect(() => parseLockedVault(writer.toBytes())).toThrow("noncanonical-text");
});
```

## Remediation

Add the test above to `src/tests/unit/vault-failure.test.ts` (or a dedicated `ppxv` negative test). It directly exercises `ppxv.ts:96` and confirms the parser rejects a checksum-valid, parameter-downgraded vault before the KDF is invoked.

## Verification of fix

```sh
npx vitest run src/tests/unit/vault-failure.test.ts
```

## References

- `docs/security-architecture.md` §16.1 (LockedVaultObject pins `scryptN: 65536, scryptR: 8, scryptP: 2, kdfId: 1`)
- `src/protocol/ppxv.ts:96` (parameter binding, pre-checksum), `:78` (wire read)
- `src/tests/unit/vault-failure.test.ts:55` (existing oracle-collapse test — adjacent, not overlapping)
- CWE-326: Inadequate Encryption Strength (KDF downgrade to weak parameters)
- CWE-345: Insufficient Verification of Data Authenticity
