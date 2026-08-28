import { describe, expect, it } from "vitest";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { lockVaultV2 } from "../../crypto/vault-v2";
import { classifyQrPayload } from "../../flows/decrypt/classify";
import { encodeBase45Upper } from "../../protocol/base45";
import { encodeRecoveryObjectV2 } from "../../protocol/ppxr-v2";
import { encodeLockedVaultV2 } from "../../protocol/ppxv-v2";

describe("QR family classification", () => {
  it("routes only exact private vault and recovery prefixes", async () => {
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const vault = encodeLockedVaultV2(
      await lockVaultV2({
        identity,
        passphrase: "five random words make safer vaults",
      }),
    );
    const recovery = encodeRecoveryObjectV2({
      magic: "PPXR",
      formatVersion: 2,
      suite: 2,
      flags: 0,
      masterEntropy: identity.masterEntropy,
      creationTime: 1n,
      pseudonym: "Alice",
      checksum: new Uint8Array(16),
    });

    expect(
      classifyQrPayload("PPX2:PRIVATE:" + encodeBase45Upper(vault)).kind,
    ).toBe("private-vault");
    expect(
      classifyQrPayload("PPX2:RECOVERY:" + encodeBase45Upper(recovery)).kind,
    ).toBe("recovery");
  });

  it("rejects unknown prefixes and prefix/object mismatches", () => {
    const recovery = encodeRecoveryObjectV2({
      magic: "PPXR",
      formatVersion: 2,
      suite: 2,
      flags: 0,
      masterEntropy: new Uint8Array(32),
      creationTime: 1n,
      pseudonym: "Alice",
      checksum: new Uint8Array(16),
    });
    const body = encodeBase45Upper(recovery);
    expect(() => classifyQrPayload("ppx2:recovery:" + body)).toThrow(
      "noncanonical-text",
    );
    expect(() => classifyQrPayload("PPX2:PRIVATE:" + body)).toThrow();
    expect(() => classifyQrPayload("PPX2:CONTACT:" + body)).toThrow();
  });
});
