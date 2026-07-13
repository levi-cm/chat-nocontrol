import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { decryptFile, encryptFile } from "../../crypto/file";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { createPublicContact } from "../../protocol/ppxc";

describe("PPXF crypto properties", () => {
  it("round-trips generated local files", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(51),
      "Alice",
    );
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(52),
      "Bob",
    );
    const sender = createPublicContact(alice, "Alice", 1n);
    const recipient = createPublicContact(bob, "Bob", 2n);

    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 0, maxLength: 4096 }),
        async (plaintext) => {
          const object = await encryptFile({
            sender,
            senderSigningCapability: createSenderSigningCapability(alice),
            recipient,
            file: new Blob([plaintext]),
            filename: "property.bin",
            mimeHint: "application/octet-stream",
            caption: "",
            fileLength: BigInt(plaintext.byteLength),
          });
          const output = await decryptFile({ object, activeIdentity: bob });
          expect(new Uint8Array(await output.blob.arrayBuffer())).toEqual(
            plaintext,
          );
        },
      ),
      { numRuns: 6 },
    );
  });
});
