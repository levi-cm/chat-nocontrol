import { describe, expect, it } from "vitest";
import {
  deriveHkdfSha512,
  deriveVaultKey,
  ed25519PublicKey,
  mlKem512Decapsulate,
  mlKem512Encapsulate,
  mlKem512Keygen,
  sha512Digest,
  signEd25519,
  verifyEd25519,
  x25519PublicKey,
} from "../../crypto/noble-provider";
import { decryptAesGcm, encryptAesGcm } from "../../crypto/webcrypto";
import nistMlKem from "../../../fixtures/crypto/nist-acvp-ml-kem-512.json";

const text = new TextEncoder();
const bytes = (hex: string) =>
  Uint8Array.from(hex.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16));
const hex = (value: Uint8Array) =>
  [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");

describe("primitive known-answer vectors", () => {
  it("matches SHA-512 and HKDF-SHA-512 vectors", () => {
    expect(hex(sha512Digest(text.encode("abc")))).toBe(
      "ddaf35a193617abacc417349ae204131" +
        "12e6fa4e89a97ea20a9eeee64b55d39a" +
        "2192992a274fc1a836ba3c23a3feebbd" +
        "454d4423643ce80e2a9ac94fa54ca49f",
    );
    expect(
      hex(
        deriveHkdfSha512(
          text.encode("input key material"),
          text.encode("salt"),
          text.encode("PPX test"),
          32,
        ),
      ),
    ).toBe("d0551ce4810a8a3932a1558f1b3d186ae25621b372968d1ee797f7f1d253cd44");
  });

  it("matches fixed PPX scrypt parameters", async () => {
    const key = await deriveVaultKey(
      "correct horse battery staple",
      new Uint8Array(16).fill(0x5a),
    );
    expect(hex(key)).toBe(
      "4e1b81b0fbc5b10780762b394a44bc3ff1b54350134740afd586d6cef869122f",
    );
  });

  it("matches RFC 7748 X25519 and RFC 8032 Ed25519", () => {
    const xSecret = bytes(
      "77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a",
    );
    expect(hex(x25519PublicKey(xSecret))).toBe(
      "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a",
    );

    const signingSeed = bytes(
      "9d61b19deffd5a60ba844af492ec2cc4" + "4449c5697b326919703bac031cae7f60",
    );
    const publicKey = ed25519PublicKey(signingSeed);
    expect(hex(publicKey)).toBe(
      "d75a980182b10ab7d54bfed3c964073a" + "0ee172f3daa62325af021a68f707511a",
    );
    const signature = signEd25519(new Uint8Array(), signingSeed);
    expect(hex(signature)).toBe(
      "e5564300c360ac729086e2cc806e828a" +
        "84877f1eb8e5d974d873e06522490155" +
        "5fb8821590a33bacc61e39701cf9b46b" +
        "d25bf5f0595bbe24655141438e7a100b",
    );
    expect(verifyEd25519(signature, new Uint8Array(), publicKey)).toBe(true);
  });

  it("matches deterministic ML-KEM-512 fixture", () => {
    const seed = Uint8Array.from({ length: 64 }, (_, index) => index);
    const randomness = Uint8Array.from(
      { length: 32 },
      (_, index) => 255 - index,
    );
    const keyPair = mlKem512Keygen(seed);
    const encapsulated = mlKem512Encapsulate(keyPair.publicKey, randomness);

    expect(keyPair.publicKey).toHaveLength(800);
    expect(keyPair.secretKey).toHaveLength(1632);
    expect(encapsulated.cipherText).toHaveLength(768);
    expect(hex(sha512Digest(keyPair.publicKey))).toBe(
      "0d482a52a675b20d8236fa85f19e248e0d582c95b44b20adfb18dfc21b49e518" +
        "3f04b31ee7d7008442c3325dd62dd72aa2da1f09c1257daaf46017952a140d91",
    );
    expect(hex(sha512Digest(encapsulated.cipherText))).toBe(
      "c1f7af6c05ba6a6c97133b5c3f3d08e0e1b774400aa7c8e56605c478fe02f952" +
        "933ccffe3d98b5f30b2b41a6ef95f5a10eca02bd55318e7dc538ebb80f14638f",
    );
    expect(
      mlKem512Decapsulate(encapsulated.cipherText, keyPair.secretKey),
    ).toEqual(encapsulated.sharedSecret);
  });

  it("matches pinned NIST ACVP FIPS 203 ML-KEM-512 cases", () => {
    const keyPair = mlKem512Keygen(
      bytes(nistMlKem.keyGen.d + nistMlKem.keyGen.z),
    );
    expect(hex(keyPair.publicKey).toUpperCase()).toBe(nistMlKem.keyGen.ek);
    expect(hex(keyPair.secretKey).toUpperCase()).toBe(nistMlKem.keyGen.dk);

    const encapsulated = mlKem512Encapsulate(
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
        mlKem512Decapsulate(
          bytes(nistMlKem.decapsulation.c),
          bytes(nistMlKem.decapsulation.dk),
        ),
      ).toUpperCase(),
    ).toBe(nistMlKem.decapsulation.k);
  });

  it("matches AES-256-GCM zero-length vector", async () => {
    const encrypted = await encryptAesGcm(
      new Uint8Array(32),
      new Uint8Array(12),
      new Uint8Array(),
    );
    expect(hex(encrypted)).toBe("530f8afbc74536b9a963b4f1c4cb738b");
    await expect(
      decryptAesGcm(new Uint8Array(32), new Uint8Array(12), encrypted),
    ).resolves.toEqual(new Uint8Array());
  });
});
