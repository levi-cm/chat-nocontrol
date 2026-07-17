import { describe, expect, it } from "vitest";
import nistMlDsa from "../../../fixtures/crypto/nist-acvp-ml-dsa-87.json";
import nistMlKem from "../../../fixtures/crypto/nist-acvp-ml-kem-1024.json";
import {
  mlDsa87Keygen,
  mlDsa87Sign,
  mlDsa87Verify,
  mlKem1024Decapsulate,
  mlKem1024Encapsulate,
  mlKem1024Keygen,
} from "../../crypto/pq-provider-v2";

const bytes = (hex: string) =>
  Uint8Array.from(hex.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16));
const hex = (value: Uint8Array) =>
  [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");

describe("pinned NIST ACVP Cat-5 vectors", () => {
  it("matches FIPS 203 ML-KEM-1024 keygen, encapsulation and decapsulation", () => {
    const keys = mlKem1024Keygen(
      bytes(nistMlKem.keyGen.d + nistMlKem.keyGen.z),
    );
    expect(hex(keys.publicKey).toUpperCase()).toBe(nistMlKem.keyGen.ek);
    expect(hex(keys.secretKey).toUpperCase()).toBe(nistMlKem.keyGen.dk);
    const encapsulated = mlKem1024Encapsulate(
      bytes(nistMlKem.encapsulation.ek),
      bytes(nistMlKem.encapsulation.m),
    );
    expect(hex(encapsulated.cipherText).toUpperCase()).toBe(
      nistMlKem.encapsulation.c,
    );
    expect(hex(encapsulated.sharedSecret).toUpperCase()).toBe(
      nistMlKem.encapsulation.k,
    );
    expect(
      hex(
        mlKem1024Decapsulate(
          bytes(nistMlKem.decapsulation.c),
          bytes(nistMlKem.decapsulation.dk),
        ),
      ).toUpperCase(),
    ).toBe(nistMlKem.decapsulation.k);
  });

  it("matches randomized FIPS 204 ML-DSA-87 with FIPS context", () => {
    const keys = mlDsa87Keygen(bytes(nistMlDsa.keyGen.seed));
    expect(hex(keys.publicKey).toUpperCase()).toBe(nistMlDsa.keyGen.pk);
    expect(hex(keys.secretKey).toUpperCase()).toBe(nistMlDsa.keyGen.sk);
    const signature = mlDsa87Sign(
      bytes(nistMlDsa.signatureGeneration.message),
      bytes(nistMlDsa.signatureGeneration.sk),
      bytes(nistMlDsa.signatureGeneration.context),
      bytes(nistMlDsa.signatureGeneration.rnd),
    );
    expect(hex(signature).toUpperCase()).toBe(
      nistMlDsa.signatureGeneration.signature,
    );
    expect(
      mlDsa87Verify(
        signature,
        bytes(nistMlDsa.signatureGeneration.message),
        bytes(nistMlDsa.signatureGeneration.pk),
        bytes(nistMlDsa.signatureGeneration.context),
      ),
    ).toBe(true);
    expect(
      mlDsa87Verify(
        bytes(nistMlDsa.signatureVerification.signature),
        bytes(nistMlDsa.signatureVerification.message),
        bytes(nistMlDsa.signatureVerification.pk),
        bytes(nistMlDsa.signatureVerification.context),
      ),
    ).toBe(nistMlDsa.signatureVerification.testPassed);
  });
});
