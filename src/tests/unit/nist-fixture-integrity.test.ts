import { describe, expect, it } from "vitest";
import dsa from "../../../fixtures/crypto/nist-acvp-ml-dsa-87.json";
import kem1024 from "../../../fixtures/crypto/nist-acvp-ml-kem-1024.json";
import kem512 from "../../../fixtures/crypto/nist-acvp-ml-kem-512.json";
import { verifyNistFixtureIntegrity } from "../../../scripts/verify-nist-fixtures";

describe("offline pinned NIST fixture integrity", () => {
  it("validates committed metadata, source hashes and selected cases", () => {
    expect(() =>
      verifyNistFixtureIntegrity({ kem512, kem1024, dsa }),
    ).not.toThrow();
  });

  it("rejects source-commit, source-hash and selected-case mutation", () => {
    expect(() =>
      verifyNistFixtureIntegrity({
        kem512: { ...kem512, sourceCommit: "0".repeat(40) },
        kem1024,
        dsa,
      }),
    ).toThrow();
    expect(() =>
      verifyNistFixtureIntegrity({
        kem512,
        kem1024: {
          ...kem1024,
          sources: {
            ...kem1024.sources,
            keyGen: { ...kem1024.sources.keyGen, sha256: "0".repeat(64) },
          },
        },
        dsa,
      }),
    ).toThrow();
    expect(() =>
      verifyNistFixtureIntegrity({
        kem512,
        kem1024,
        dsa: {
          ...dsa,
          signatureGeneration: { ...dsa.signatureGeneration, tcId: -1 },
        },
      }),
    ).toThrow();
  });
});
