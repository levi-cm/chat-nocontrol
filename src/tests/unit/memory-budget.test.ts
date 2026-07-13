import { describe, expect, it } from "vitest";
import { decryptFile, encryptFile, encryptFileToBlob } from "../../crypto/file";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { createPublicContact } from "../../protocol/ppxc";
import {
  encodeEncryptedFileObject,
  parseEncryptedFileObject,
  PPXF_ENCODED_MAX_BYTES,
} from "../../protocol/ppxf";
import type { DerivedIdentity } from "../../protocol/types";

describe("PPXF memory budget", () => {
  it("rejects a maximum-size malformed Blob after reading only its header", async () => {
    const reads: Array<[number, number]> = [];
    class SparseMalformedBlob extends Blob {
      override get size(): number {
        return PPXF_ENCODED_MAX_BYTES;
      }

      override slice(start = 0, end = this.size): Blob {
        reads.push([start, end]);
        return new Blob([new Uint8Array(Math.max(0, end - start))]);
      }
    }
    await expect(
      decryptFile({
        object: new SparseMalformedBlob(),
        activeIdentity: {} as DerivedIdentity,
      }),
    ).rejects.toThrow("wrong-identity-or-corruption");
    expect(reads).toEqual([[0, 884]]);
  });

  it("retains no more than one plaintext chunk", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(71),
      "Alice",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(72),
      "Bob",
    );
    let peak = 0;
    await encryptFile(
      {
        sender: createPublicContact(alice, "Alice", 1n),
        senderSigningCapability: createSenderSigningCapability(alice),
        recipient: createPublicContact(bob, "Bob", 2n),
        file: new Blob([new Uint8Array(3 * 1_048_576)]),
        filename: "memory.bin",
        mimeHint: "application/octet-stream",
        caption: "",
        fileLength: 3_145_728n,
      },
      {
        onPlaintextRetained: (bytes) => {
          peak = Math.max(peak, bytes);
        },
      },
    );
    expect(peak).toBeLessThanOrEqual(1_048_576);
  });

  it("builds the worker download as a Blob while retaining one chunk", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(75),
      "Alice",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(76),
      "Bob",
    );
    let peakPlaintext = 0;
    let peakCiphertext = 0;
    const output = await encryptFileToBlob(
      {
        sender: createPublicContact(alice, "Alice", 1n),
        senderSigningCapability: createSenderSigningCapability(alice),
        recipient: createPublicContact(bob, "Bob", 2n),
        file: new Blob([new Uint8Array(3 * 1_048_576)]),
        filename: "stream.bin",
        mimeHint: "application/octet-stream",
        caption: "",
        fileLength: 3_145_728n,
      },
      {
        onPlaintextRetained: (bytes) => {
          peakPlaintext = Math.max(peakPlaintext, bytes);
        },
        onCiphertextRetained: (bytes) => {
          peakCiphertext = Math.max(peakCiphertext, bytes);
        },
      },
    );

    expect(output.blob).toBeInstanceOf(Blob);
    expect(output.encodedLength).toBe(BigInt(output.blob.size));
    expect(peakPlaintext).toBeLessThanOrEqual(1_048_576);
    expect(peakCiphertext).toBeLessThanOrEqual(1_048_576 + 16);
    const parsed = parseEncryptedFileObject(
      new Uint8Array(await output.blob.arrayBuffer()),
    );
    const decrypted = await decryptFile({
      object: parsed,
      activeIdentity: bob,
    });
    expect(decrypted.blob.size).toBe(3 * 1_048_576);
  });

  it("parses and decrypts an encoded Blob without retaining the whole ciphertext", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(73),
      "Alice",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(74),
      "Bob",
    );
    const object = await encryptFile({
      sender: createPublicContact(alice, "Alice", 1n),
      senderSigningCapability: createSenderSigningCapability(alice),
      recipient: createPublicContact(bob, "Bob", 2n),
      file: new Blob([new Uint8Array(3 * 1_048_576)]),
      filename: "memory.bin",
      mimeHint: "application/octet-stream",
      caption: "",
      fileLength: 3_145_728n,
    });
    let peakCiphertext = 0;
    const stages = new Set<string>();
    const output = await decryptFile(
      {
        object: new Blob([
          Uint8Array.from(encodeEncryptedFileObject(object)).buffer,
        ]),
        activeIdentity: bob,
      },
      {
        onCiphertextRetained: (bytes) => {
          peakCiphertext = Math.max(peakCiphertext, bytes);
        },
        onProgress: ({ stage }) => stages.add(stage),
      },
    );

    expect(output.blob.size).toBe(3 * 1_048_576);
    expect(peakCiphertext).toBeLessThanOrEqual(1_048_576 + 16);
    expect(stages).toContain("parse");
    expect(stages).toContain("decrypt");
  });
});
