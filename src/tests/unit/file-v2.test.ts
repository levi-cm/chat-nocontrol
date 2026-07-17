import { beforeAll, describe, expect, it } from "vitest";
import {
  createDecapsulationCapabilityV2,
  createSenderSigningCapabilityV2,
  deriveIdentityV2FromEntropy,
} from "../../crypto/identity-v2";
import {
  decryptFileV2,
  encryptFileV2,
  FileOperationCancelledV2,
} from "../../crypto/file-v2";
import { calculateEncryptedFileChecksumV2 } from "../../protocol/ppxf-v2";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import type {
  DerivedIdentityV2,
  PublicContactV2,
} from "../../protocol/types-v2";

const fill = (length: number, value: number) =>
  new Uint8Array(length).fill(value);

describe("PPXF Cat-5 V2 file cryptography", () => {
  let senderIdentity: DerivedIdentityV2;
  let recipientIdentity: DerivedIdentityV2;
  let sender: PublicContactV2;
  let recipient: PublicContactV2;

  beforeAll(async () => {
    senderIdentity = await deriveIdentityV2FromEntropy(fill(32, 0x91));
    recipientIdentity = await deriveIdentityV2FromEntropy(fill(32, 0x92));
    sender = createPublicContactV2(senderIdentity, "A", 1n, fill(32, 0x93));
    recipient = createPublicContactV2(
      recipientIdentity,
      "B",
      2n,
      fill(32, 0x94),
    );
  });

  const encrypt = (plaintext: Uint8Array, isCancelled?: () => boolean) =>
    encryptFileV2(
      {
        sender,
        senderSigningCapability:
          createSenderSigningCapabilityV2(senderIdentity),
        recipient,
        file: new Blob([Uint8Array.from(plaintext).buffer], {
          type: "application/octet-stream",
        }),
        filename: "archive.bin",
        mimeHint: "application/octet-stream",
        caption: "Local archive",
        fileLength: BigInt(plaintext.length),
      },
      { isCancelled },
    );

  it.each([0, 1, 1_048_576, 1_048_577])(
    "round-trips %i bytes only after digest, binding, and signature verify",
    async (length) => {
      const plaintext = new Uint8Array(length);
      for (let index = 0; index < length; index += 1) {
        plaintext[index] = index % 251;
      }
      const object = await encrypt(plaintext);
      expect(object.header.mlKemCiphertext).toHaveLength(1568);
      expect(object.header.formatVersion).toBe(2);
      expect(object.header.suite).toBe(2);
      expect(object.manifest.chunkIndex).toBe(0xffff_ffff);

      const retained: number[] = [];
      const output = await decryptFileV2(
        {
          object,
          activeIdentity: createDecapsulationCapabilityV2(recipientIdentity),
        },
        { onPlaintextRetained: (bytes) => retained.push(bytes) },
      );
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
      expect(Math.max(...retained)).toBeLessThanOrEqual(1_048_576);
      expect(retained.at(-1)).toBe(0);
    },
    60_000,
  );

  it("collapses valid-checksum chunk and manifest mutations", async () => {
    const object = await encrypt(Uint8Array.of(1, 2, 3));
    object.chunks[0]!.ciphertext[0] =
      (object.chunks[0]!.ciphertext[0] as number) ^ 1;
    object.checksum = calculateEncryptedFileChecksumV2(object);
    await expect(
      decryptFileV2({
        object,
        activeIdentity: createDecapsulationCapabilityV2(recipientIdentity),
      }),
    ).rejects.toThrow("wrong-identity-or-corruption");

    const second = await encrypt(Uint8Array.of(1, 2, 3));
    second.manifest.ciphertext[0] =
      (second.manifest.ciphertext[0] as number) ^ 1;
    second.checksum = calculateEncryptedFileChecksumV2(second);
    await expect(
      decryptFileV2({
        object: second,
        activeIdentity: createDecapsulationCapabilityV2(recipientIdentity),
      }),
    ).rejects.toThrow("wrong-identity-or-corruption");
  });

  it("rejects wrong recipient without releasing a file", async () => {
    const object = await encrypt(Uint8Array.of(1, 2, 3));
    const wrong = await deriveIdentityV2FromEntropy(fill(32, 0x96));
    await expect(
      decryptFileV2({
        object,
        activeIdentity: createDecapsulationCapabilityV2(wrong),
      }),
    ).rejects.toThrow("wrong-identity-or-corruption");
  });

  it("rejects substituted signer capability and consumes its secret", async () => {
    const other = await deriveIdentityV2FromEntropy(fill(32, 0x95));
    const capability = createSenderSigningCapabilityV2(other);
    await expect(
      encryptFileV2({
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
    expect(capability.signingSecretKey).toEqual(new Uint8Array(4896));
  });

  it("cancels before encapsulation and consumes the signing secret", async () => {
    const capability = createSenderSigningCapabilityV2(senderIdentity);
    await expect(
      encryptFileV2(
        {
          sender,
          senderSigningCapability: capability,
          recipient,
          file: new Blob(),
          filename: "empty.bin",
          mimeHint: "application/octet-stream",
          caption: "",
          fileLength: 0n,
        },
        { isCancelled: () => true },
      ),
    ).rejects.toBeInstanceOf(FileOperationCancelledV2);
    expect(capability.signingSecretKey).toEqual(new Uint8Array(4896));
  });

  it("cancels after terminal encryption without returning ciphertext", async () => {
    let checks = 0;
    const capability = createSenderSigningCapabilityV2(senderIdentity);
    await expect(
      encryptFileV2(
        {
          sender,
          senderSigningCapability: capability,
          recipient,
          file: new Blob(),
          filename: "empty.bin",
          mimeHint: "application/octet-stream",
          caption: "",
          fileLength: 0n,
        },
        { isCancelled: () => (checks += 1) >= 3 },
      ),
    ).rejects.toBeInstanceOf(FileOperationCancelledV2);
    expect(capability.signingSecretKey).toEqual(new Uint8Array(4896));
  });
});
