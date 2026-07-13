import { describe, expect, it } from "vitest";
import { sha512 } from "@noble/hashes/sha2.js";
import fixture from "../../../fixtures/protocol/ppxf-v1.json";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { createPublicContact } from "../../protocol/ppxc";
import {
  createFileManifest,
  encodeFileManifest,
  parseFileManifest,
} from "../../protocol/ppxf-manifest";

describe("PPXF terminal manifest", () => {
  it("round-trips the exact signed commitment", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(8),
      "Alice",
    );
    const manifest = createFileManifest({
      senderContact: createPublicContact(alice, "Alice", 1n),
      signingSecretKey: alice.signingSecretKey,
      recipientId: new Uint8Array(20).fill(9),
      filename: "archive.txt",
      mimeHint: "text/plain",
      caption: "Local file",
      fileLength: 3n,
      chunkCount: 1,
      fullPlaintextDigest: new Uint8Array(64).fill(10),
    });

    expect(parseFileManifest(encodeFileManifest(manifest))).toEqual(manifest);
  });

  it("rejects a changed signature before metadata release", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(18),
      "Alice",
    );
    const bytes = encodeFileManifest(
      createFileManifest({
        senderContact: createPublicContact(alice, "Alice", 1n),
        signingSecretKey: alice.signingSecretKey,
        recipientId: new Uint8Array(20),
        filename: "file.bin",
        mimeHint: "application/octet-stream",
        caption: "",
        fileLength: 0n,
        chunkCount: 0,
        fullPlaintextDigest: new Uint8Array(64),
      }),
    );
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] as number) ^ 1;
    expect(() => parseFileManifest(bytes)).toThrow("invalid-signature");
  });

  it("matches the digest-locked canonical manifest commitment fixture", async () => {
    const alice = await deriveIdentityFromEntropy(new Uint8Array(32), "Alice");
    const encoded = encodeFileManifest(
      createFileManifest({
        senderContact: createPublicContact(alice, "Alice", 1n),
        signingSecretKey: alice.signingSecretKey,
        recipientId: new Uint8Array(20).fill(9),
        filename: "hello.txt",
        mimeHint: "text/plain",
        caption: "fixture",
        fileLength: 3n,
        chunkCount: 1,
        fullPlaintextDigest: new Uint8Array(64).fill(8),
      }),
    );
    expect(encoded).toHaveLength(fixture.manifestEncodedLength);
    expect(
      [...sha512(encoded)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
    ).toBe(fixture.manifestSha512);
  });

  it("rejects impossible manifest lengths before an unknown version", async () => {
    const alice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(42),
      "Alice",
    );
    const bytes = encodeFileManifest(
      createFileManifest({
        senderContact: createPublicContact(alice, "Alice", 1n),
        signingSecretKey: alice.signingSecretKey,
        recipientId: new Uint8Array(20),
        filename: "ordering.bin",
        mimeHint: "application/octet-stream",
        caption: "",
        fileLength: 0n,
        chunkCount: 0,
        fullPlaintextDigest: new Uint8Array(64),
      }),
    );
    bytes[4] = 2;
    bytes[10] = 0;
    bytes[11] = 0;

    expect(() => parseFileManifest(bytes)).toThrow("impossible-length");
  });
});
