import { beforeAll, describe, expect, it } from "vitest";
import {
  createSenderSigningCapabilityV2,
  deriveIdentityV2FromEntropy,
} from "../../crypto/identity-v2";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import {
  createFileManifestV2,
  encodeFileManifestV2,
  parseFileManifestV2,
  PPXF_V2_MANIFEST_MIN_BYTES,
  PPXF_V2_MANIFEST_SIGNATURE_CONTEXT,
} from "../../protocol/ppxf-manifest-v2";
import type {
  DerivedIdentityV2,
  PublicContactV2,
} from "../../protocol/types-v2";

const fill = (length: number, value: number) =>
  new Uint8Array(length).fill(value);

describe("PPXF Cat-5 signed terminal manifest", () => {
  let identity: DerivedIdentityV2;
  let contact: PublicContactV2;

  beforeAll(async () => {
    identity = await deriveIdentityV2FromEntropy(fill(32, 0xa1));
    contact = createPublicContactV2(identity, "A", 1n, fill(32, 0xa2));
  });

  const create = (entropy: number) => {
    const capability = createSenderSigningCapabilityV2(identity);
    return createFileManifestV2({
      senderContact: contact,
      signingSecretKey: capability.signingSecretKey,
      signatureEntropy: fill(32, entropy),
      recipientId: fill(20, 0xa3),
      filename: "x",
      mimeHint: "",
      caption: "",
      fileLength: 0n,
      chunkCount: 0,
      fullPlaintextDigest: fill(64, 0xa4),
    });
  };

  it("uses distinct FIPS context and exact minimum size", () => {
    const manifest = create(0xa5);
    const encoded = encodeFileManifestV2(manifest);
    expect(PPXF_V2_MANIFEST_SIGNATURE_CONTEXT).toBe("PPX/FILE/MANIFEST/V2");
    expect(encoded).toHaveLength(PPXF_V2_MANIFEST_MIN_BYTES);
    expect(parseFileManifestV2(encoded)).toEqual(manifest);
  });

  it("randomizes ML-DSA-87 signatures for identical content", () => {
    const left = create(0xa6);
    const right = create(0xa7);
    expect(left.signature).not.toEqual(right.signature);
  });

  it("rejects signature, version, suite, recipient, and digest mutation", () => {
    const encoded = encodeFileManifestV2(create(0xa8));
    for (const offset of [
      4,
      5,
      20,
      encoded.length - 4628,
      encoded.length - 1,
    ]) {
      const mutated = Uint8Array.from(encoded);
      mutated[offset] = (mutated[offset] as number) ^ 1;
      expect(() => parseFileManifestV2(mutated)).toThrow();
    }
  });
});
