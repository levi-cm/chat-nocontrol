import { describe, expect, it } from "vitest";
import {
  mlDsa87Keygen,
  mlDsa87Sign,
  mlDsa87Verify,
  mlKem1024Decapsulate,
  mlKem1024Encapsulate,
  mlKem1024Keygen,
} from "../../crypto/pq-provider-v2";

describe("Cat-5 post-quantum primitive wrappers", () => {
  it("enforces ML-KEM-1024 wire sizes and round-trips", () => {
    const keys = mlKem1024Keygen(new Uint8Array(64).fill(0x11));
    const encapsulated = mlKem1024Encapsulate(
      keys.publicKey,
      new Uint8Array(32).fill(0x22),
    );

    expect(keys.publicKey).toHaveLength(1568);
    expect(keys.secretKey).toHaveLength(3168);
    expect(encapsulated.cipherText).toHaveLength(1568);
    expect(
      mlKem1024Decapsulate(encapsulated.cipherText, keys.secretKey),
    ).toEqual(encapsulated.sharedSecret);
    expect(() => mlKem1024Keygen(new Uint8Array(63))).toThrow();
    expect(() =>
      mlKem1024Encapsulate(new Uint8Array(1567), new Uint8Array(32)),
    ).toThrow();
  });

  it("requires explicit 32-byte entropy and supports FIPS context", () => {
    const keys = mlDsa87Keygen(new Uint8Array(32).fill(0x33));
    const message = new TextEncoder().encode("Cat-5 test");
    const context = new TextEncoder().encode("PPX/CONTACT/V2");
    const signature = mlDsa87Sign(
      message,
      keys.secretKey,
      context,
      new Uint8Array(32).fill(0x44),
    );

    expect(keys.publicKey).toHaveLength(2592);
    expect(keys.secretKey).toHaveLength(4896);
    expect(signature).toHaveLength(4627);
    expect(mlDsa87Verify(signature, message, keys.publicKey, context)).toBe(
      true,
    );
    expect(
      mlDsa87Verify(
        signature,
        message,
        keys.publicKey,
        new TextEncoder().encode("PPX/OTHER/V2"),
      ),
    ).toBe(false);
    expect(() =>
      mlDsa87Sign(message, keys.secretKey, context, new Uint8Array(31)),
    ).toThrow();
  });
});
