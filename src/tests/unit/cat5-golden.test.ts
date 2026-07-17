import { sha512 } from "@noble/hashes/sha2.js";
import { describe, expect, it } from "vitest";
import fixture from "../../../fixtures/protocol/golden-cat5-foundation.json";
import { deriveHkdfSha512, sha512Digest } from "../../crypto/noble-provider";
import { mlKem1024Keygen } from "../../crypto/pq-provider-v2";
import { checksum16 } from "../../protocol/checksum";
import { parsePublicContactV2 } from "../../protocol/ppxc-v2";
import { ObjectFamilyV2 } from "../../protocol/types-v2";
import {
  canonicalCat5Foundation,
  canonicalCat5ContactBytes,
  cat5GoldenInputs,
} from "../helpers/canonical-cat5";

const encoder = new TextEncoder();
const hex = (value: Uint8Array) =>
  [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");

describe("Cat-5 foundation golden", () => {
  it("locks identity, KEM HKDF and PPXC outputs", async () => {
    await expect(canonicalCat5Foundation()).resolves.toEqual(fixture);
  });

  it("locks PPXT/PPXM V2 empty sizes, families and digests", () => {
    expect(fixture.text.signatureContexts).toEqual({
      full: "PPX/TEXT/FULL/V2",
      compact: "PPX/TEXT/COMPACT/V2",
    });
    expect(fixture.text.full).toMatchObject({
      magic: "PPXT",
      flags: 0,
      encodedLength: 15_163,
    });
    expect(fixture.text.compact).toMatchObject({
      magic: "PPXM",
      flags: 0,
      encodedLength: 6_370,
    });
    expect(fixture.text.full.encodedSha512).toMatch(/^[0-9a-f]{128}$/u);
    expect(fixture.text.compact.encodedSha512).toMatch(/^[0-9a-f]{128}$/u);
    expect(fixture.text.full.encodedSha512).not.toBe(
      fixture.text.compact.encodedSha512,
    );
  });

  it("locks PPXF V2 empty size, manifest context, and digest", () => {
    expect(fixture.file).toMatchObject({
      magic: "PPXF",
      headerBytes: 1_651,
      chunkBytes: 1_048_576,
      signatureContext: "PPX/FILE/MANIFEST/V2",
      encodedLength: 15_258,
    });
    expect(fixture.file.encodedSha512).toMatch(/^[0-9a-f]{128}$/u);
  });

  it("fails the identity golden when a derivation label changes", () => {
    const salt = sha512Digest(encoder.encode("PPX/IDENTITY/V2/SALT"));
    const mutatedSeed = deriveHkdfSha512(
      cat5GoldenInputs.masterEntropy,
      salt,
      encoder.encode("PPX/IDENTITY/V2/ML-KEM-1024/KEYGEN-SEED-MUTATED"),
      64,
    );
    const mutated = mlKem1024Keygen(mutatedSeed);
    expect(hex(sha512(mutated.publicKey))).not.toBe(
      fixture.identity.kemPublicKeySha512,
    );
  });

  it("fails the KEM golden when transcript order changes", () => {
    const digest = sha512(cat5GoldenInputs.mlKemCiphertext);
    const reorderedInfo = new Uint8Array([
      ...encoder.encode("PPX/ENCRYPT/V2/ML-KEM-1024"),
      0x02,
      0x02,
      ObjectFamilyV2.CompactText,
      ...digest,
      ...cat5GoldenInputs.recipientFingerprint,
    ]);
    const mutated = deriveHkdfSha512(
      cat5GoldenInputs.mlKemSharedSecret,
      cat5GoldenInputs.salt,
      reorderedInfo,
      32,
    );
    expect(hex(mutated)).not.toBe(fixture.kem.aes256Key);
  });

  it("rejects version and suite mutation of the golden PPXC", async () => {
    const encoded = await canonicalCat5ContactBytes();
    for (const offset of [4, 5]) {
      const mutated = Uint8Array.from(encoded);
      mutated[offset] = 0x01;
      mutated.set(checksum16(mutated.slice(0, -16)), mutated.length - 16);
      expect(() => parsePublicContactV2(mutated)).toThrow();
    }
  });
});
