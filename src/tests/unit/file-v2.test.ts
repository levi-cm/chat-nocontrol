import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createDecapsulationCapabilityV2,
  createSenderSigningCapabilityV2,
  deriveIdentityV2FromEntropy,
} from "../../crypto/identity-v2";
import {
  createFileRecordAadV2,
  createFileRecordNonceV2,
  decryptFileV2,
  encryptFileToBlobV2,
  encryptFileV2,
  FileOperationCancelledV2,
} from "../../crypto/file-v2";
import { deriveMlKemKeyV2 } from "../../crypto/kem-v2";
import { mlKem1024Encapsulate } from "../../crypto/pq-provider-v2";
import { decryptAesGcm, encryptAesGcm } from "../../crypto/webcrypto";
import { zeroize } from "../../crypto/zeroize";
import { hashFileHeaderV2 } from "../../protocol/ppxf-header-v2";
import { calculateEncryptedFileChecksumV2 } from "../../protocol/ppxf-v2";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import type {
  DerivedIdentityV2,
  PublicContactV2,
} from "../../protocol/types-v2";
import { ObjectFamilyV2 } from "../../protocol/types-v2";

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

  afterEach(() => vi.unstubAllGlobals());

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

  it("authenticates the complete header as AES-GCM AAD", async () => {
    const object = await encrypt(Uint8Array.of(1, 2, 3));
    object.header.recipientId[0] = (object.header.recipientId[0] as number) ^ 1;
    object.checksum = calculateEncryptedFileChecksumV2(object);
    await expect(
      decryptFileV2({
        object,
        activeIdentity: createDecapsulationCapabilityV2(recipientIdentity),
      }),
    ).rejects.toThrow("wrong-identity-or-corruption");
  });

  it("rejects ciphertext derived under a non-File object family", async () => {
    const kemRandomness = fill(32, 0xd1);
    const kemSalt = fill(32, 0xd2);
    let sharedSecret: Uint8Array | undefined;
    const object = await encryptFileV2(
      {
        sender,
        senderSigningCapability:
          createSenderSigningCapabilityV2(senderIdentity),
        recipient,
        file: new Blob(),
        filename: "empty.bin",
        mimeHint: "application/octet-stream",
        caption: "",
        fileLength: 0n,
      },
      undefined,
      {
        kem: {
          encapsulate: (publicKey) => {
            const result = mlKem1024Encapsulate(publicKey, kemRandomness);
            sharedSecret = Uint8Array.from(result.sharedSecret);
            return result;
          },
          randomBytes: () => Uint8Array.from(kemSalt),
        },
        randomBytes: (length) => fill(length, length === 8 ? 0xd3 : 0xd4),
      },
    );
    if (!sharedSecret) throw new Error("test KEM did not expose shared secret");
    const capturedSharedSecret = sharedSecret;
    const common = {
      recipientFingerprint: recipient.fingerprint,
      salt: object.header.salt,
      mlKemCiphertext: object.header.mlKemCiphertext,
      mlKemSharedSecret: capturedSharedSecret,
    };
    const fileKey = deriveMlKemKeyV2({
      ...common,
      objectFamily: ObjectFamilyV2.File,
    });
    const textKey = deriveMlKemKeyV2({
      ...common,
      objectFamily: ObjectFamilyV2.Text,
    });
    const headerHash = hashFileHeaderV2(object.header);
    const nonce = createFileRecordNonceV2(
      object.header.noncePrefix,
      0xffff_ffff,
    );
    const aad = createFileRecordAadV2(
      headerHash,
      0xffff_ffff,
      object.manifest.plaintextLength,
      object.header.declaredChunkCount,
      object.header.totalFileLength,
    );
    const plaintext = await decryptAesGcm(
      fileKey,
      nonce,
      object.manifest.ciphertext,
      aad,
    );
    object.manifest.ciphertext = await encryptAesGcm(
      textKey,
      nonce,
      plaintext,
      aad,
    );
    object.checksum = calculateEncryptedFileChecksumV2(object);
    zeroize(
      capturedSharedSecret,
      fileKey,
      textKey,
      headerHash,
      nonce,
      aad,
      plaintext,
    );

    await expect(
      decryptFileV2({
        object,
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

  it("cancels decryption without constructing immutable plaintext", async () => {
    const object = await encrypt(new Uint8Array(1_048_577).fill(7));
    const OriginalBlob = Blob;
    let constructedBlobs = 0;
    class ObservedBlob extends OriginalBlob {
      constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        constructedBlobs += 1;
      }
    }
    vi.stubGlobal("Blob", ObservedBlob);
    let cancelled = false;
    const retained: number[] = [];
    const capability = createDecapsulationCapabilityV2(recipientIdentity);
    await expect(
      decryptFileV2(
        { object, activeIdentity: capability },
        {
          isCancelled: () => cancelled,
          onProgress: ({ stage }) => {
            if (stage === "decrypt") cancelled = true;
          },
          onPlaintextRetained: (bytes) => retained.push(bytes),
        },
      ),
    ).rejects.toBeInstanceOf(FileOperationCancelledV2);
    expect(constructedBlobs).toBe(0);
    expect(retained.at(-1)).toBe(0);
    expect(capability.kemSecretKey).toEqual(new Uint8Array(3168));
  });

  it("stops object release after the first immutable Blob part when cancellation races its construction", async () => {
    const object = await encrypt(new Uint8Array(1_048_577).fill(8));
    const OriginalBlob = Blob;
    let immutableParts = 0;
    let cancelled = false;
    class CancellingBlob extends OriginalBlob {
      constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        immutableParts += 1;
        cancelled = true;
      }
    }
    vi.stubGlobal("Blob", CancellingBlob);
    const retained: number[] = [];
    const capability = createDecapsulationCapabilityV2(recipientIdentity);

    await expect(
      decryptFileV2(
        { object, activeIdentity: capability },
        {
          isCancelled: () => cancelled,
          onPlaintextRetained: (bytes) => retained.push(bytes),
        },
      ),
    ).rejects.toBeInstanceOf(FileOperationCancelledV2);

    expect(immutableParts).toBe(1);
    expect(retained.at(-1)).toBe(0);
    expect(capability.kemSecretKey).toEqual(new Uint8Array(3168));
  });

  it("stops encoded-Blob release after the first immutable plaintext part", async () => {
    const capability = createSenderSigningCapabilityV2(senderIdentity);
    const encrypted = await encryptFileToBlobV2({
      sender,
      senderSigningCapability: capability,
      recipient,
      file: new Blob([new Uint8Array(1_048_577).fill(9)]),
      filename: "encoded.bin",
      mimeHint: "application/octet-stream",
      caption: "",
      fileLength: 1_048_577n,
    });
    const OriginalBlob = Blob;
    let immutableParts = 0;
    let cancelled = false;
    class CancellingBlob extends OriginalBlob {
      constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        immutableParts += 1;
        cancelled = true;
      }
    }
    vi.stubGlobal("Blob", CancellingBlob);
    Object.setPrototypeOf(encrypted.blob, CancellingBlob.prototype);
    const retained: number[] = [];
    const decryptCapability =
      createDecapsulationCapabilityV2(recipientIdentity);

    await expect(
      decryptFileV2(
        { object: encrypted.blob, activeIdentity: decryptCapability },
        {
          isCancelled: () => cancelled,
          onPlaintextRetained: (bytes) => retained.push(bytes),
        },
      ),
    ).rejects.toBeInstanceOf(FileOperationCancelledV2);

    expect(immutableParts).toBe(1);
    expect(retained.at(-1)).toBe(0);
    expect(decryptCapability.kemSecretKey).toEqual(new Uint8Array(3168));
  });

  it("uses a private ciphertext snapshot across verify and release passes", async () => {
    const plaintext = Uint8Array.of(4, 5, 6);
    const object = await encrypt(plaintext);
    let firstPassComplete = false;
    let mutated = false;
    const outputPromise = decryptFileV2(
      {
        object,
        activeIdentity: createDecapsulationCapabilityV2(recipientIdentity),
      },
      {
        onProgress: ({ stage }) => {
          if (stage === "decrypt") firstPassComplete = true;
        },
        isCancelled: () => {
          if (firstPassComplete && !mutated) {
            object.chunks[0]!.ciphertext[0] =
              (object.chunks[0]!.ciphertext[0] as number) ^ 1;
            mutated = true;
          }
          return false;
        },
      },
    );
    await expect(outputPromise).resolves.toBeDefined();
    const output = await outputPromise;
    expect(new Uint8Array(await output.blob.arrayBuffer())).toEqual(plaintext);
  });
});
