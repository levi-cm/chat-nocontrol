import { describe, expect, it } from "vitest";
import {
  createNobleCryptoProvider,
  createWebCryptoAdapter,
} from "../../crypto/provider";
import { encodePublicContactV2 } from "../../protocol/ppxc-v2";

describe("CryptoProvider factories", () => {
  it("creates Cat-5 identities and contacts only", async () => {
    const provider = createNobleCryptoProvider();
    const identity = await provider.deriveIdentity(
      new Uint8Array(32),
      "Alice",
      1n,
    );
    expect(identity.suite).toBe(2);
    expect(identity.kemPublicKey).toHaveLength(1568);
    expect(identity.signingPublicKey).toHaveLength(2592);
    expect(identity.fingerprint).toHaveLength(32);
    const contact = provider.createPublicContact(
      identity,
      "Alice",
      1n,
      new Uint8Array(32),
    );
    expect(contact).toMatchObject({ formatVersion: 2, suite: 2 });
    expect(provider.parsePublicContact(encodePublicContactV2(contact))).toEqual(
      contact,
    );
    expect("createHybridEncapsulation" in provider).toBe(false);
    expect("encryptQrText" in provider).toBe(false);
    expect("decryptQrText" in provider).toBe(false);
  });

  it("exposes the exact optional WebCrypto adapter factory", () => {
    const provider = createWebCryptoAdapter();
    expect(provider).not.toBeNull();
    expect(provider).toHaveProperty("encryptText");
  });
});
