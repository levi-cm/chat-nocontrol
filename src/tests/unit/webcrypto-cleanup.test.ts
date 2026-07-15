import { describe, expect, it } from "vitest";
import { decryptAesGcm, encryptAesGcm } from "../../crypto/webcrypto";

function captureBuffer(
  captured: ArrayBuffer[],
  source: BufferSource | undefined,
): void {
  if (!source) return;
  if (source instanceof ArrayBuffer) captured.push(source);
  else captured.push(source.buffer);
}

function subtleFixture(
  captured: ArrayBuffer[],
  failOperation: boolean,
): SubtleCrypto {
  return {
    importKey(_format: KeyFormat, keyData: BufferSource | JsonWebKey) {
      captureBuffer(captured, keyData as BufferSource);
      return Promise.resolve({} as CryptoKey);
    },
    encrypt(
      algorithm:
        | AlgorithmIdentifier
        | RsaOaepParams
        | AesCtrParams
        | AesCbcParams
        | AesGcmParams,
      _key: CryptoKey,
      data: BufferSource,
    ) {
      const parameters = algorithm as AesGcmParams;
      captureBuffer(captured, parameters.iv);
      captureBuffer(captured, parameters.additionalData);
      captureBuffer(captured, data);
      if (failOperation) {
        return Promise.reject(new Error("injected subtle failure"));
      }
      return Promise.resolve(Uint8Array.of(9, 8, 7).buffer);
    },
    decrypt(
      algorithm:
        | AlgorithmIdentifier
        | RsaOaepParams
        | AesCtrParams
        | AesCbcParams
        | AesGcmParams,
      _key: CryptoKey,
      data: BufferSource,
    ) {
      const parameters = algorithm as AesGcmParams;
      captureBuffer(captured, parameters.iv);
      captureBuffer(captured, parameters.additionalData);
      captureBuffer(captured, data);
      if (failOperation) {
        return Promise.reject(new Error("injected subtle failure"));
      }
      return Promise.resolve(Uint8Array.of(6, 5, 4).buffer);
    },
  } as unknown as SubtleCrypto;
}

describe("WebCrypto temporary ownership", () => {
  it("uses the development AES-GCM fallback when SubtleCrypto is unavailable", async () => {
    const key = new Uint8Array(32);
    const nonce = new Uint8Array(12);
    const encrypted = await encryptAesGcm(
      key,
      nonce,
      new Uint8Array(),
      undefined,
      null,
    );

    expect(encrypted).toEqual(
      new Uint8Array([
        0x53, 0x0f, 0x8a, 0xfb, 0xc7, 0x45, 0x36, 0xb9, 0xa9, 0x63, 0xb4, 0xf1,
        0xc4, 0xcb, 0x73, 0x8b,
      ]),
    );
    await expect(
      decryptAesGcm(key, nonce, encrypted, undefined, null),
    ).resolves.toEqual(new Uint8Array());
  });

  it("wipes owned key, nonce, AAD, and plaintext copies after success", async () => {
    const captured: ArrayBuffer[] = [];
    await expect(
      encryptAesGcm(
        new Uint8Array(32).fill(1),
        new Uint8Array(12).fill(2),
        new Uint8Array(8).fill(3),
        new Uint8Array(7).fill(4),
        subtleFixture(captured, false),
      ),
    ).resolves.toEqual(Uint8Array.of(9, 8, 7));
    expect(captured).toHaveLength(4);
    for (const buffer of captured) {
      expect(new Uint8Array(buffer).every((byte) => byte === 0)).toBe(true);
    }
  });

  it("wipes every owned copy when subtle encryption fails", async () => {
    const captured: ArrayBuffer[] = [];
    await expect(
      encryptAesGcm(
        new Uint8Array(32).fill(1),
        new Uint8Array(12).fill(2),
        new Uint8Array(8).fill(3),
        new Uint8Array(7).fill(4),
        subtleFixture(captured, true),
      ),
    ).rejects.toThrow("injected subtle failure");
    expect(captured).toHaveLength(4);
    for (const buffer of captured) {
      expect(new Uint8Array(buffer).every((byte) => byte === 0)).toBe(true);
    }
  });

  it("wipes owned key, nonce, AAD, and ciphertext copies after decrypt success", async () => {
    const captured: ArrayBuffer[] = [];
    await expect(
      decryptAesGcm(
        new Uint8Array(32).fill(1),
        new Uint8Array(12).fill(2),
        new Uint8Array(24).fill(3),
        new Uint8Array(7).fill(4),
        subtleFixture(captured, false),
      ),
    ).resolves.toEqual(Uint8Array.of(6, 5, 4));
    expect(captured).toHaveLength(4);
    for (const buffer of captured) {
      expect(new Uint8Array(buffer).every((byte) => byte === 0)).toBe(true);
    }
  });

  it("wipes every owned copy and maps subtle decrypt failure to invalid-aead", async () => {
    const captured: ArrayBuffer[] = [];
    await expect(
      decryptAesGcm(
        new Uint8Array(32).fill(1),
        new Uint8Array(12).fill(2),
        new Uint8Array(24).fill(3),
        new Uint8Array(7).fill(4),
        subtleFixture(captured, true),
      ),
    ).rejects.toMatchObject({ code: "invalid-aead" });
    expect(captured).toHaveLength(4);
    for (const buffer of captured) {
      expect(new Uint8Array(buffer).every((byte) => byte === 0)).toBe(true);
    }
  });
});
