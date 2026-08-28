> **Authority:** Active implementation and verification plan for `0.2.0-beta.1`.
> **Depends on:** [../Chat_NoControl_full_plan.md](../Chat_NoControl_full_plan.md), [protocol-cat5-v2.md](protocol-cat5-v2.md), [legacy-v1-compatibility.md](legacy-v1-compatibility.md), [testing-and-release.md](testing-and-release.md)

# CAT-5/V2 implementation plan

## Completed architecture target

Maintain distinct V2 identity, contact, text, file, vault, recovery, provider,
capability, worker, storage, and transport modules. V2 `0x02/0x02` is only
writer/encrypt path. Keep V1 code behind isolated reader/migration worker and
never expose V1 write requests.

## Integration checklist

1. Lock exact CAT-5 public sizes, domain labels, object families, goldens, and
   FIPS vectors.
2. Enforce bounded parse/allocation and downgrade/mixed-suite/family rejection
   for PPXC, PPXT, PPXM, PPXF, PPXR, and PPXV.
3. Route V2 contacts by file/text; messages by PPXT armor or PPXT/PPXM link.
   Remove V2 contact/message QR creation. Preserve recovery QR.
4. Complete read-old/write-new paths: V1 PPXT formats 1/2, PPXF, full links,
   PPXQ with temporary V1 sender contact, PPXR, PPXV, words, stored vault.
5. Prove V1 contact is decrypt-only/in-memory, never persisted; prove no V1
   write/encrypt/send. Its session copy survives individual decrypts but is
   cleared on lock, identity change, erase-all, reload, tab close, or session
   teardown; request copies are erased after each operation. Accept legacy
   `#/m/<BASE64URL>` carrying PPXT or PPXQ. Old `#/decrypt/qr` remains
   decode-only.
6. Align EN/DE, help, accessibility, diagnostics, and errors with same matrix.
7. Prove silent PWA activation with the pinned real deployed legacy build and
   current production build: no banner/choice, exactly one bounded forced
   legacy cutover, no same-version interruption or loop, obsolete cache entries
   removed, current precache retained, fragment absent from every leak/history
   surface, and new build active before reload plus after offline reopen.
8. Run exact-Node quality/build suite and record honest result.
9. Freeze one candidate, obtain a distinct external-reviewer report/signature,
   add exactly the three evidence files in its single immediate child, prove
   `HEAD^` is the candidate, then create and verify the exact signed annotated
   release tag. Keep review BLOCKED until that chain exists.
10. Keep the complete Android Chrome/installed-PWA and iPhone
    Safari/home-screen-PWA matrix NOT RUN until qualifying physical evidence
    exists.
11. Deploy only after explicit approval and full release gate; canonical URL
    remains GitHub Pages with no custom domain.

## Acceptance

- All newly serialized artifacts are V2 `PPX-PQ-5`.
- Supported V1 artifacts work in current app; old app is unnecessary.
- Parser/crypto failures release no unauthenticated plaintext.
- No V2 contact/message QR UI or generator remains.
- Docs, tests, implementation, version text, and release ledger agree.
- External/device/deployment claims remain evidence-backed.

Historical detailed plans under `docs/superpowers/` remain immutable audit
history and are not implementation authority.

## Legacy V1 PPXF checker appendix

This literal contract exists only to keep decode-only V1 PPXF parsing and its
conformance checker exact. It authorizes no V1 writer, encryption, preview, or
new artifact. CAT-5/V2 PPXF remains controlled by
[protocol-cat5-v2.md](protocol-cat5-v2.md).

```ts
export interface FileHeader {
  magic: "PPXF";
  formatVersion: 0x01;
  suite: 0x01;
  flags: 0;
  recipientId: Uint8Array;
  mlKemCiphertext: Uint8Array;
  ephemeralX25519PublicKey: Uint8Array;
  noncePrefix: Uint8Array;
  salt: Uint8Array;
  declaredChunkCount: number;
  chunkSize: 1048576;
  totalFileLength: bigint;
}

export interface EncryptedManifestRecord {
  chunkIndex: 0xffffffff;
  plaintextLength: number;
  ciphertext: Uint8Array;
}

export interface EncryptedFileObject {
  header: FileHeader;
  chunks: ChunkRecord[];
  manifest: EncryptedManifestRecord;
  checksum: Uint8Array;
}
```
