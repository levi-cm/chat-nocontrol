import { describe, expect, it } from "vitest";
import { encodeBase45Upper } from "../../protocol/base45";
import { encodeRecoveryObject } from "../../protocol/ppxr";
import { classifyPrivateQr } from "../../flows/identity/import";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { lockVault } from "../../crypto/vault";
import { encodeLockedVault } from "../../protocol/ppxv";

describe("legacy V1 private QR compatibility", () => {
  it("classifies a canonical V1 recovery QR without accepting V1 contacts", () => {
    const bytes = encodeRecoveryObject({
      magic: "PPXR",
      formatVersion: 1,
      suite: 1,
      flags: 0,
      masterEntropy: new Uint8Array(32).fill(21),
      creationTime: 21n,
      pseudonym: "QR Alice",
      checksum: new Uint8Array(16),
    });

    const classified = classifyPrivateQr(
      `PPX1:RECOVERY:${encodeBase45Upper(bytes)}`,
    );

    expect(classified).toMatchObject({ kind: "recovery", suite: 1 });
    expect(() => classifyPrivateQr("PPX1:CONTACT:ABC")).toThrow();
  });

  it("rejects unknown suites before private import", () => {
    const bytes = encodeRecoveryObject({
      magic: "PPXR",
      formatVersion: 1,
      suite: 1,
      flags: 0,
      masterEntropy: new Uint8Array(32).fill(22),
      creationTime: 22n,
      pseudonym: "QR Bob",
      checksum: new Uint8Array(16),
    });
    bytes[5] = 0x7f;

    expect(() =>
      classifyPrivateQr(`PPX1:RECOVERY:${encodeBase45Upper(bytes)}`),
    ).toThrow();
  });

  it("classifies a canonical V1 private-vault QR for migration", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(23),
      "QR Vault",
      23n,
    );
    const vault = await lockVault({
      identity,
      passphrase: "five random words make safer vaults",
    });
    const payload = encodeLockedVault(vault);

    const classified = classifyPrivateQr(
      `PPX1:PRIVATE:${encodeBase45Upper(payload)}`,
    );

    expect(classified).toMatchObject({
      kind: "private-vault",
      suite: 1,
      payload,
    });
  });
});
