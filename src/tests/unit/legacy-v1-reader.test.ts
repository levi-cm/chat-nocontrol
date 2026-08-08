import { describe, expect, it } from "vitest";
import { encryptFile } from "../../crypto/file";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import {
  decryptLegacyCompactTextV1,
  decryptLegacyFileV1,
  decryptLegacyTextV1,
  migrateLegacyRecoveryV1,
  migrateLegacyVaultV1,
} from "../../crypto/legacy-v1-reader";
import { encryptQrText } from "../../crypto/qr-text";
import { encryptText } from "../../crypto/text";
import { lockVault } from "../../crypto/vault";
import { createPublicContact, encodePublicContact } from "../../protocol/ppxc";
import { encodeEncryptedQrText } from "../../protocol/ppxq-outer";
import { encodeLockedVault } from "../../protocol/ppxv";
import { encodeRecoveryObject } from "../../protocol/ppxr";

const fill = (value: number) => new Uint8Array(32).fill(value);
const PASSPHRASE = "five random words make safer vaults";

async function legacyPair() {
  const alice = await deriveIdentityFromEntropy(fill(41), "Alice", 41n);
  const bob = await deriveIdentityFromEntropy(fill(42), "Bob", 42n);
  return {
    alice,
    bob,
    aliceContact: createPublicContact(alice, "Alice", 41n),
    bobContact: createPublicContact(bob, "Bob", 42n),
  };
}

describe("isolated V1 compatibility reader", () => {
  it("decrypts canonical compact V1 bytes with exactly the supplied sender contact", async () => {
    const fixture = await legacyPair();
    const object = await encryptQrText({
      sender: fixture.aliceContact,
      senderSigningCapability: createSenderSigningCapability(fixture.alice),
      recipient: fixture.bobContact,
      plaintext: "old compact text remains readable",
      messageId: new Uint8Array(16).fill(40),
      sentAt: 40n,
      createdAt: 40n,
    });
    const ppxqBytes = encodeEncryptedQrText(object);
    const senderContactBytes = encodePublicContact(fixture.aliceContact);
    const masterEntropy = fill(42);

    const output = await decryptLegacyCompactTextV1({
      ppxqBytes,
      senderContactBytes,
      masterEntropy,
    });

    expect(output.plaintext).toBe("old compact text remains readable");
    expect(output.senderContact.fingerprint).toEqual(
      fixture.aliceContact.fingerprint,
    );
    expect(ppxqBytes.every((byte) => byte === 0)).toBe(true);
    expect(senderContactBytes.every((byte) => byte === 0)).toBe(true);
    expect(masterEntropy).toEqual(new Uint8Array(32));
  });

  it("fails closed for a different validated sender and still releases all request bytes", async () => {
    const fixture = await legacyPair();
    const mallory = await deriveIdentityFromEntropy(fill(43), "Mallory", 43n);
    const object = await encryptQrText({
      sender: fixture.aliceContact,
      senderSigningCapability: createSenderSigningCapability(fixture.alice),
      recipient: fixture.bobContact,
      plaintext: "sender must match",
      messageId: new Uint8Array(16).fill(45),
      sentAt: 45n,
      createdAt: 45n,
    });
    const ppxqBytes = encodeEncryptedQrText(object);
    const senderContactBytes = encodePublicContact(
      createPublicContact(mallory, "Mallory", 43n),
    );
    const masterEntropy = fill(42);

    await expect(
      decryptLegacyCompactTextV1({
        ppxqBytes,
        senderContactBytes,
        masterEntropy,
      }),
    ).rejects.toThrow("unknown-sender-contact");

    expect(ppxqBytes.every((byte) => byte === 0)).toBe(true);
    expect(senderContactBytes.every((byte) => byte === 0)).toBe(true);
    expect(masterEntropy).toEqual(new Uint8Array(32));
  });

  it("decrypts a full Suite-1 text after the recipient migrated to V2", async () => {
    const fixture = await legacyPair();
    const object = await encryptText({
      sender: fixture.aliceContact,
      senderSigningCapability: createSenderSigningCapability(fixture.alice),
      recipient: fixture.bobContact,
      plaintext: "old text remains readable",
      messageId: new Uint8Array(16).fill(43),
      sentAt: 44n,
      createdAt: 44n,
    });
    const requestEntropy = fill(42);

    const output = await decryptLegacyTextV1({
      object,
      masterEntropy: requestEntropy,
    });

    expect(output.plaintext).toBe("old text remains readable");
    expect(output.senderContact.pseudonym).toBe("Alice");
    expect(requestEntropy).toEqual(new Uint8Array(32));
  });

  it("decrypts a Suite-1 file as download-only output", async () => {
    const fixture = await legacyPair();
    const plaintext = new Blob(["legacy file"]);
    const object = await encryptFile({
      sender: fixture.aliceContact,
      senderSigningCapability: createSenderSigningCapability(fixture.alice),
      recipient: fixture.bobContact,
      file: plaintext,
      filename: "legacy.txt",
      mimeHint: "text/plain",
      caption: "old",
      fileLength: BigInt(plaintext.size),
    });
    const requestEntropy = fill(42);

    const output = await decryptLegacyFileV1({
      object,
      masterEntropy: requestEntropy,
    });

    expect(output.filename).toBe("legacy.txt");
    expect(await output.blob.text()).toBe("legacy file");
    expect(requestEntropy).toEqual(new Uint8Array(32));
  });

  it("migrates a V1 recovery object to the deterministic V2 identity", async () => {
    const entropy = fill(51);
    const recoveryBytes = encodeRecoveryObject({
      magic: "PPXR",
      formatVersion: 1,
      suite: 1,
      flags: 0,
      masterEntropy: entropy,
      creationTime: 51n,
      pseudonym: "Recovery Alice",
      checksum: new Uint8Array(16),
    });

    const identity = await migrateLegacyRecoveryV1(recoveryBytes);

    expect(identity).toMatchObject({
      suite: 2,
      pseudonym: "Recovery Alice",
      creationTime: 51n,
    });
    expect(identity.masterEntropy).toEqual(fill(51));
    expect(recoveryBytes.every((byte) => byte === 0)).toBe(true);
  });

  it("unlocks a V1 vault then returns the deterministic V2 identity", async () => {
    const legacy = await deriveIdentityFromEntropy(
      fill(61),
      "Vault Alice",
      61n,
    );
    const vault = await lockVault({ identity: legacy, passphrase: PASSPHRASE });
    const vaultBytes = encodeLockedVault(vault);

    const identity = await migrateLegacyVaultV1({
      bytes: vaultBytes,
      passphrase: PASSPHRASE,
    });

    expect(identity).toMatchObject({
      suite: 2,
      pseudonym: "Vault Alice",
      creationTime: 61n,
    });
    expect(identity.masterEntropy).toEqual(fill(61));
    expect(vaultBytes.every((byte) => byte === 0)).toBe(true);
  });
});
