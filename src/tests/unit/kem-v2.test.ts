import { describe, expect, it } from "vitest";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { decapsulateMlKemV2, encapsulateMlKemV2 } from "../../crypto/kem-v2";
import { mlKem1024Encapsulate } from "../../crypto/pq-provider-v2";
import { ObjectFamilyV2 } from "../../protocol/types-v2";

describe("Cat-5 ML-KEM-only encapsulation", () => {
  it("round-trips and binds object family into the derived key", async () => {
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(0x55),
    );
    const randomness = new Uint8Array(32).fill(0x66);
    const salt = new Uint8Array(32).fill(0x77);
    const primitives = {
      encapsulate: (publicKey: Uint8Array) =>
        mlKem1024Encapsulate(publicKey, randomness),
      randomBytes: (length: number) => {
        expect(length).toBe(32);
        return Uint8Array.from(salt);
      },
    };
    const text = encapsulateMlKemV2(
      {
        objectFamily: ObjectFamilyV2.Text,
        recipientFingerprint: identity.fingerprint,
        recipientKemPublicKey: identity.kemPublicKey,
      },
      primitives,
    );
    const file = encapsulateMlKemV2(
      {
        objectFamily: ObjectFamilyV2.File,
        recipientFingerprint: identity.fingerprint,
        recipientKemPublicKey: identity.kemPublicKey,
      },
      primitives,
    );

    expect(text.mlKemCiphertext).toHaveLength(1568);
    expect(text.salt).toHaveLength(32);
    expect(text.aes256Key).toHaveLength(32);
    expect(text.aes256Key).not.toEqual(file.aes256Key);
    expect(
      decapsulateMlKemV2({
        objectFamily: ObjectFamilyV2.Text,
        activeIdentity: identity,
        mlKemCiphertext: text.mlKemCiphertext,
        salt: text.salt,
      }),
    ).toEqual(text.aes256Key);
  });

  it("rejects malformed metadata before decapsulation", async () => {
    const identity = await deriveIdentityV2FromEntropy(new Uint8Array(32));
    expect(() =>
      decapsulateMlKemV2({
        objectFamily: ObjectFamilyV2.Text,
        activeIdentity: identity,
        mlKemCiphertext: new Uint8Array(1567),
        salt: new Uint8Array(32),
      }),
    ).toThrow("invalid-hybrid-encapsulation");
  });
});
