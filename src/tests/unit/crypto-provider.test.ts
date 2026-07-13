import { describe, expect, it } from "vitest";
import {
  createNobleCryptoProvider,
  createWebCryptoAdapter,
} from "../../crypto/provider";

describe("CryptoProvider factories", () => {
  it("creates the complete Noble/WebCrypto-backed provider", async () => {
    const provider = createNobleCryptoProvider();
    const identity = await provider.deriveIdentity(new Uint8Array(32));
    expect(identity.fingerprint).toHaveLength(32);
    expect(provider.createPublicContact(identity, "Alice", 1n).pseudonym).toBe(
      "Alice",
    );
  });

  it("exposes the exact optional WebCrypto adapter factory", () => {
    const provider = createWebCryptoAdapter();
    expect(provider).not.toBeNull();
    expect(provider).toHaveProperty("encryptText");
  });
});
