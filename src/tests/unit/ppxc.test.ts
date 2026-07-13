import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import {
  createPublicContact,
  encodePublicContact,
  parsePublicContact,
} from "../../protocol/ppxc";
import { checksum16 } from "../../protocol/checksum";

describe("PPXC", () => {
  it("round-trips the complete canonical PublicContact shape", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const contact = createPublicContact(identity, "Alice", 1_700_000_000n);
    const decoded = parsePublicContact(encodePublicContact(contact));

    expect(Object.keys(decoded).sort()).toEqual(
      [
        "magic",
        "formatVersion",
        "suite",
        "creationTime",
        "pseudonym",
        "kemPublicKey",
        "x25519PublicKey",
        "signingPublicKey",
        "selfSignature",
        "checksum",
        "fingerprint",
        "identityId",
      ].sort(),
    );
    expect(decoded.magic).toBe("PPXC");
    expect(decoded.formatVersion).toBe(1);
    expect(decoded.suite).toBe(1);
    expect(decoded.creationTime).toBe(1_700_000_000n);
    expect(decoded.pseudonym).toBe("Alice");
    expect(decoded.kemPublicKey).toBeInstanceOf(Uint8Array);
    expect(decoded.kemPublicKey).toHaveLength(800);
    expect(decoded.x25519PublicKey).toHaveLength(32);
    expect(decoded.signingPublicKey).toHaveLength(32);
    expect(decoded.selfSignature).toHaveLength(64);
    expect(decoded.checksum).toHaveLength(16);
    expect(decoded.fingerprint).toEqual(identity.fingerprint);
    expect(decoded.identityId).toEqual(identity.identityId);
  });

  it("rejects altered versions, signatures, and checksums", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const bytes = encodePublicContact(
      createPublicContact(identity, "Alice", 1n),
    );

    const version = bytes.slice();
    version[4] = 2;
    expect(() => parsePublicContact(version)).toThrow("unknown-format-version");

    const signature = bytes.slice();
    signature[900] = (signature[900] as number) ^ 1;
    expect(() => parsePublicContact(signature)).toThrow("checksum-mismatch");

    const checksum = bytes.slice();
    checksum[checksum.length - 1] =
      (checksum[checksum.length - 1] as number) ^ 1;
    expect(() => parsePublicContact(checksum)).toThrow("checksum-mismatch");
  });

  it("rejects a forged self-signature even with a recomputed checksum", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const bytes = encodePublicContact(
      createPublicContact(identity, "Alice", 1n),
    );
    const signatureOffset = 880 + new TextEncoder().encode("Alice").byteLength;
    bytes[signatureOffset] = (bytes[signatureOffset] as number) ^ 1;
    bytes.set(checksum16(bytes.subarray(0, -16)), bytes.byteLength - 16);
    expect(() => parsePublicContact(bytes)).toThrow("invalid-signature");
  });
});
