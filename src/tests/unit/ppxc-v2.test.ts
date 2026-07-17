import { beforeAll, describe, expect, it } from "vitest";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { checksum16 } from "../../protocol/checksum";
import {
  PPXC_V2_MAXIMUM_SIZE,
  PPXC_V2_SIGNATURE_CONTEXT,
  createPublicContactV2,
  encodePublicContactV2,
  encodePublicContactV2Text,
  parsePublicContactV2,
  parsePublicContactV2Text,
} from "../../protocol/ppxc-v2";
import type {
  DerivedIdentityV2,
  PublicContactV2,
} from "../../protocol/types-v2";

describe("Cat-5 PPXC V2", () => {
  let identity: DerivedIdentityV2;
  let contact: PublicContactV2;

  beforeAll(async () => {
    identity = await deriveIdentityV2FromEntropy(new Uint8Array(32).fill(0x88));
    contact = createPublicContactV2(
      identity,
      "Alice",
      123n,
      new Uint8Array(32).fill(0x99),
    );
  });

  it("exposes the normative signature context as immutable text", () => {
    expect(PPXC_V2_SIGNATURE_CONTEXT).toBe("PPX/CONTACT/V2");
  });

  it("encodes exact canonical size and parses identity fields", () => {
    const encoded = encodePublicContactV2(contact);
    expect(encoded).toHaveLength(8819 + 5);
    const parsed = parsePublicContactV2(encoded);
    expect(parsed).toEqual(contact);
    expect(parsed.fingerprint).toEqual(identity.fingerprint);
    expect(parsed.identityId).toEqual(identity.identityId);
  });

  it("caps binary size at 8867 bytes", () => {
    const maximum = createPublicContactV2(
      identity,
      "a".repeat(48),
      123n,
      new Uint8Array(32).fill(0xaa),
    );
    expect(encodePublicContactV2(maximum)).toHaveLength(PPXC_V2_MAXIMUM_SIZE);
  });

  it("round-trips PPX2 Base45 text without QR UI", () => {
    const armored = encodePublicContactV2Text(contact);
    expect(armored.startsWith("PPX2:CONTACT:")).toBe(true);
    expect(parsePublicContactV2Text(armored)).toEqual(contact);
  });

  it("rejects V1 version and suite bytes", () => {
    const encoded = encodePublicContactV2(contact);
    const versionOne = Uint8Array.from(encoded);
    versionOne[4] = 1;
    const suiteOne = Uint8Array.from(encoded);
    suiteOne[5] = 1;
    expect(() => parsePublicContactV2(versionOne)).toThrow(
      "unknown-format-version",
    );
    expect(() => parsePublicContactV2(suiteOne)).toThrow("unknown-suite");
  });

  it("rejects truncation, trailing bytes, checksum and signature corruption", () => {
    const encoded = encodePublicContactV2(contact);
    expect(() => parsePublicContactV2(encoded.slice(0, -1))).toThrow();
    const trailing = new Uint8Array(encoded.length + 1);
    trailing.set(encoded);
    expect(() => parsePublicContactV2(trailing)).toThrow();
    const checksum = Uint8Array.from(encoded);
    checksum[checksum.length - 1] =
      (checksum[checksum.length - 1] as number) ^ 1;
    expect(() => parsePublicContactV2(checksum)).toThrow("checksum-mismatch");
    const signature = Uint8Array.from(encoded);
    signature[4200] = (signature[4200] as number) ^ 1;
    const signedPart = signature.slice(0, -16);
    signature.set(checksum16(signedPart), signature.length - 16);
    expect(() => parsePublicContactV2(signature)).toThrow("invalid-signature");
  });
});
