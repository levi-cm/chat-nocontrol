import { describe, expect, it } from "vitest";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { decryptFile, encryptFile } from "../../crypto/file";
import { calculateEncryptedFileChecksum } from "../../protocol/ppxf";
import { createPublicContact } from "../../protocol/ppxc";

async function identities() {
  const alice = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(41),
    "Alice",
  );
  const bob = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(42),
    "Bob",
  );
  return {
    alice,
    bob,
    sender: createPublicContact(alice, "Alice", 1n),
    recipient: createPublicContact(bob, "Bob", 2n),
  };
}

describe("PPXF file cryptography", () => {
  it.each([0, 1, 1_048_576, 1_048_577])(
    "round-trips %i plaintext bytes without early output",
    async (length) => {
      const { alice, bob, sender, recipient } = await identities();
      const plaintext = new Uint8Array(length);
      for (let index = 0; index < plaintext.length; index += 1) {
        plaintext[index] = index % 251;
      }
      const object = await encryptFile({
        sender,
        senderSigningCapability: createSenderSigningCapability(alice),
        recipient,
        file: new Blob([plaintext], { type: "application/octet-stream" }),
        filename: "archive.bin",
        mimeHint: "application/octet-stream",
        caption: "Local archive",
        fileLength: BigInt(length),
      });

      expect(object.header.mlKemCiphertext).toHaveLength(768);
      expect(object.manifest.chunkIndex).toBe(0xffff_ffff);
      expect("senderContact" in object.manifest).toBe(false);

      const output = await decryptFile({ object, activeIdentity: bob });
      expect(new Uint8Array(await output.blob.arrayBuffer())).toEqual(
        plaintext,
      );
      expect(output).toMatchObject({
        filename: "archive.bin",
        mimeHint: "application/octet-stream",
        caption: "Local archive",
        fileLength: BigInt(length),
        digestValid: true,
        signatureValid: true,
      });
    },
    30_000,
  );

  it("collapses a valid-checksum manifest AEAD mutation to generic failure", async () => {
    const { alice, bob, sender, recipient } = await identities();
    const object = await encryptFile({
      sender,
      senderSigningCapability: createSenderSigningCapability(alice),
      recipient,
      file: new Blob([Uint8Array.of(1, 2, 3)]),
      filename: "three.bin",
      mimeHint: "application/octet-stream",
      caption: "",
      fileLength: 3n,
    });
    object.manifest.ciphertext[0] =
      (object.manifest.ciphertext[0] as number) ^ 1;
    object.checksum = calculateEncryptedFileChecksum(object);

    await expect(decryptFile({ object, activeIdentity: bob })).rejects.toThrow(
      "wrong-identity-or-corruption",
    );
  });

  it("rejects sender capability substitution and wipes the request seed", async () => {
    const { alice, sender, recipient } = await identities();
    const mallory = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(43),
      "Mallory",
    );
    const capability = createSenderSigningCapability(mallory);
    await expect(
      encryptFile({
        sender,
        senderSigningCapability: capability,
        recipient,
        file: new Blob(),
        filename: "empty.bin",
        mimeHint: "application/octet-stream",
        caption: "",
        fileLength: 0n,
      }),
    ).rejects.toThrow("invalid-signature");
    expect(capability.signingSecretKey).toEqual(new Uint8Array(32));
    expect(alice.signingSecretKey).not.toEqual(new Uint8Array(32));
  });
});
