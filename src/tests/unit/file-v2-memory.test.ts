import { beforeAll, describe, expect, it } from "vitest";
import {
  createDecapsulationCapabilityV2,
  createSenderSigningCapabilityV2,
  deriveIdentityV2FromEntropy,
} from "../../crypto/identity-v2";
import { decryptFileV2, encryptFileToBlobV2 } from "../../crypto/file-v2";
import { PPXF_V2_ENCODED_MAX_BYTES } from "../../protocol/ppxf-v2";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import type {
  DerivedIdentityV2,
  PublicContactV2,
} from "../../protocol/types-v2";

const fill = (length: number, value: number) =>
  new Uint8Array(length).fill(value);

describe("PPXF Cat-5 V2 bounded-memory Blob path", () => {
  let senderIdentity: DerivedIdentityV2;
  let recipientIdentity: DerivedIdentityV2;
  let sender: PublicContactV2;
  let recipient: PublicContactV2;

  beforeAll(async () => {
    senderIdentity = await deriveIdentityV2FromEntropy(fill(32, 0xc1));
    recipientIdentity = await deriveIdentityV2FromEntropy(fill(32, 0xc2));
    sender = createPublicContactV2(senderIdentity, "A", 1n, fill(32, 0xc3));
    recipient = createPublicContactV2(
      recipientIdentity,
      "B",
      2n,
      fill(32, 0xc4),
    );
  });

  it("encrypts and decrypts encoded Blobs while retaining one mutable chunk", async () => {
    const plaintext = Uint8Array.from(
      { length: 3 * 1_048_576 },
      (_, index) => index % 251,
    );
    let encryptPlaintextPeak = 0;
    let encryptCiphertextPeak = 0;
    const encrypted = await encryptFileToBlobV2(
      {
        sender,
        senderSigningCapability:
          createSenderSigningCapabilityV2(senderIdentity),
        recipient,
        file: new Blob([plaintext.buffer]),
        filename: "memory.bin",
        mimeHint: "application/octet-stream",
        caption: "",
        fileLength: BigInt(plaintext.byteLength),
      },
      {
        onPlaintextRetained: (bytes) => {
          encryptPlaintextPeak = Math.max(encryptPlaintextPeak, bytes);
        },
        onCiphertextRetained: (bytes) => {
          encryptCiphertextPeak = Math.max(encryptCiphertextPeak, bytes);
        },
      },
    );
    expect(encrypted.blob).toBeInstanceOf(Blob);
    expect(encrypted.encodedLength).toBe(BigInt(encrypted.blob.size));
    expect(encryptPlaintextPeak).toBeLessThanOrEqual(1_048_576);
    expect(encryptCiphertextPeak).toBeLessThanOrEqual(1_048_576 + 16);

    let decryptPlaintextPeak = 0;
    let decryptCiphertextPeak = 0;
    const output = await decryptFileV2(
      {
        object: encrypted.blob,
        activeIdentity: createDecapsulationCapabilityV2(recipientIdentity),
      },
      {
        onPlaintextRetained: (bytes) => {
          decryptPlaintextPeak = Math.max(decryptPlaintextPeak, bytes);
        },
        onCiphertextRetained: (bytes) => {
          decryptCiphertextPeak = Math.max(decryptCiphertextPeak, bytes);
        },
      },
    );
    expect(new Uint8Array(await output.blob.arrayBuffer())).toEqual(plaintext);
    expect(decryptPlaintextPeak).toBeLessThanOrEqual(1_048_576);
    expect(decryptCiphertextPeak).toBeLessThanOrEqual(1_048_576 + 16);
  }, 60_000);

  it("rejects a maximum-size malformed Blob after reading only its header", async () => {
    const reads: Array<[number, number]> = [];
    class SparseMalformedBlob extends Blob {
      override get size(): number {
        return PPXF_V2_ENCODED_MAX_BYTES;
      }

      override slice(start = 0, end = this.size): Blob {
        reads.push([start, end]);
        return new Blob([new Uint8Array(Math.max(0, end - start))]);
      }
    }
    await expect(
      decryptFileV2({
        object: new SparseMalformedBlob(),
        activeIdentity: createDecapsulationCapabilityV2(recipientIdentity),
      }),
    ).rejects.toThrow("wrong-identity-or-corruption");
    expect(reads).toEqual([[0, 1_651]]);
  });

  it("wipes a plaintext slice when a retention hook fails", async () => {
    const plaintextSlice = Uint8Array.of(9, 8, 7);
    class ProbeBlob extends Blob {
      override get size(): number {
        return plaintextSlice.byteLength;
      }

      override slice(): Blob {
        return {
          arrayBuffer: () => Promise.resolve(plaintextSlice.buffer),
        } as Blob;
      }
    }
    const capability = createSenderSigningCapabilityV2(senderIdentity);
    await expect(
      encryptFileToBlobV2(
        {
          sender,
          senderSigningCapability: capability,
          recipient,
          file: new ProbeBlob(),
          filename: "probe.bin",
          mimeHint: "application/octet-stream",
          caption: "",
          fileLength: 3n,
        },
        {
          onPlaintextRetained: (bytes) => {
            if (bytes > 0) throw new Error("hook-failure");
          },
        },
      ),
    ).rejects.toThrow("hook-failure");
    expect(plaintextSlice).toEqual(new Uint8Array(3));
    expect(capability.signingSecretKey).toEqual(new Uint8Array(4896));
  });
});
