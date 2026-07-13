import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { lockVault } from "../../crypto/vault";
import { classifyQrPayload } from "../../flows/decrypt/classify";
import { encodeBase45Upper } from "../../protocol/base45";
import { createPublicContact, encodePublicContact } from "../../protocol/ppxc";
import { encodeRecoveryObject } from "../../protocol/ppxr";
import { encodeLockedVault } from "../../protocol/ppxv";

describe("QR family classification", () => {
  it("routes exact contact, private vault, and recovery prefixes", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const contact = encodePublicContact(
      createPublicContact(identity, "Alice", 1n),
    );
    const vault = encodeLockedVault(
      await lockVault({
        identity,
        passphrase: "five random words make safer vaults",
      }),
    );
    const recovery = encodeRecoveryObject({
      magic: "PPXR",
      formatVersion: 1,
      suite: 1,
      flags: 0,
      masterEntropy: identity.masterEntropy,
      creationTime: 1n,
      pseudonym: "Alice",
      checksum: new Uint8Array(16),
    });

    expect(
      classifyQrPayload("PPX1:CONTACT:" + encodeBase45Upper(contact)).kind,
    ).toBe("public-contact");
    expect(
      classifyQrPayload("PPX1:PRIVATE:" + encodeBase45Upper(vault)).kind,
    ).toBe("private-vault");
    expect(
      classifyQrPayload("PPX1:RECOVERY:" + encodeBase45Upper(recovery)).kind,
    ).toBe("recovery");
  });

  it("rejects unknown prefixes and prefix/object mismatches", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const contact = encodePublicContact(
      createPublicContact(identity, "Alice", 1n),
    );
    const body = encodeBase45Upper(contact);
    expect(() => classifyQrPayload("ppx1:contact:" + body)).toThrow(
      "noncanonical-text",
    );
    expect(() => classifyQrPayload("PPX1:PRIVATE:" + body)).toThrow();
  });
});
