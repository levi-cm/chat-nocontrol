import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decryptFileV2, encryptFileV2 } from "../../crypto/file-v2";
import {
  createDecapsulationCapabilityV2,
  createSenderSigningCapabilityV2,
  deriveIdentityV2FromEntropy,
} from "../../crypto/identity-v2";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";

describe("PPXF Cat-5 crypto properties", () => {
  it("round-trips generated local files", async () => {
    const alice = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(0xb1),
    );
    const bob = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(0xb2),
    );
    const sender = createPublicContactV2(
      alice,
      "Alice",
      1n,
      new Uint8Array(32).fill(0xb3),
    );
    const recipient = createPublicContactV2(
      bob,
      "Bob",
      2n,
      new Uint8Array(32).fill(0xb4),
    );
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 0, maxLength: 4096 }),
        async (plaintext) => {
          const object = await encryptFileV2({
            sender,
            senderSigningCapability: createSenderSigningCapabilityV2(alice),
            recipient,
            file: new Blob([Uint8Array.from(plaintext).buffer]),
            filename: "property.bin",
            mimeHint: "application/octet-stream",
            caption: "",
            fileLength: BigInt(plaintext.byteLength),
          });
          const output = await decryptFileV2({
            object,
            activeIdentity: createDecapsulationCapabilityV2(bob),
          });
          expect(new Uint8Array(await output.blob.arrayBuffer())).toEqual(
            plaintext,
          );
        },
      ),
      { numRuns: 4 },
    );
  }, 60_000);
});
