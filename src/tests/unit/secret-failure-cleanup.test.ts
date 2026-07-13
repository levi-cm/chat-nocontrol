import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deriveIdentityFromEntropy,
  type IdentityDerivationPrimitives,
} from "../../crypto/identity";
import {
  encapsulateHybrid,
  type HybridEncapsulationPrimitives,
} from "../../crypto/hybrid";
import {
  deriveHkdfSha512,
  ed25519PublicKey,
  mlKem512Encapsulate,
  mlKem512Keygen,
  x25519PublicKey,
  x25519SharedSecret,
} from "../../crypto/noble-provider";
import type { EncryptFileInput, EncryptTextInput } from "../../protocol/types";
import { startEncryptTextJob } from "../../workers/crypto-client";
import { startEncryptFileJob } from "../../workers/file-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("secret failure cleanup", () => {
  it("wipes derived identity secrets if derivation fails", async () => {
    const derived: Uint8Array[] = [];
    const primitives: IdentityDerivationPrimitives = {
      deriveKey(input, salt, info, length) {
        const output = deriveHkdfSha512(input, salt, info, length);
        derived.push(output);
        return output;
      },
      keygen: mlKem512Keygen,
      xPublicKey: () => {
        throw new Error("injected public-key failure");
      },
      signingPublicKey: ed25519PublicKey,
    };

    await expect(
      deriveIdentityFromEntropy(
        new Uint8Array(32).fill(9),
        "Alice",
        0n,
        primitives,
      ),
    ).rejects.toThrow("injected public-key failure");
    expect(derived).toHaveLength(4);
    for (const buffer of derived)
      expect(buffer.every((byte) => byte === 0)).toBe(true);
  });

  it("wipes post-KEM secrets when X25519 fails", () => {
    const kemShared = new Uint8Array(32).fill(11);
    const primitives: HybridEncapsulationPrimitives = {
      publicKey: x25519PublicKey,
      encapsulate: () => ({
        cipherText: new Uint8Array(768),
        sharedSecret: kemShared,
      }),
      sharedSecret: () => {
        throw new Error("injected X25519 failure");
      },
      deriveKey: vi.fn(),
    };

    expect(() =>
      encapsulateHybrid(
        {
          recipientFingerprint: new Uint8Array(32),
          recipientKemPublicKey: new Uint8Array(800),
          recipientX25519PublicKey: new Uint8Array(32),
        },
        primitives,
      ),
    ).toThrow("invalid-hybrid-encapsulation");
    expect(kemShared).toEqual(new Uint8Array(32));
  });

  it("rejects malformed recipients before ML-KEM work", () => {
    const encapsulate = vi.fn(mlKem512Encapsulate);
    const primitives: HybridEncapsulationPrimitives = {
      publicKey: x25519PublicKey,
      encapsulate,
      sharedSecret: x25519SharedSecret,
      deriveKey: vi.fn(),
    };
    expect(() =>
      encapsulateHybrid(
        {
          recipientFingerprint: new Uint8Array(31),
          recipientKemPublicKey: new Uint8Array(800),
          recipientX25519PublicKey: new Uint8Array(32),
        },
        primitives,
      ),
    ).toThrow("invalid-hybrid-encapsulation");
    expect(encapsulate).not.toHaveBeenCalled();
  });

  it("wipes the ephemeral X25519 secret when salt generation fails", () => {
    let ephemeralSecret: Uint8Array | undefined;
    let calls = 0;
    vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(((
      output: Uint8Array,
    ) => {
      calls += 1;
      if (calls === 1) {
        output.fill(23);
        ephemeralSecret = output;
        return output;
      }
      throw new Error("injected salt RNG failure");
    }) as typeof crypto.getRandomValues);

    expect(() =>
      encapsulateHybrid({
        recipientFingerprint: new Uint8Array(32),
        recipientKemPublicKey: new Uint8Array(800),
        recipientX25519PublicKey: new Uint8Array(32),
      }),
    ).toThrow("invalid-hybrid-encapsulation");
    expect(ephemeralSecret).toEqual(new Uint8Array(32));
  });

  it("wipes a text signing capability when Worker construction fails", () => {
    const signingSecretKey = new Uint8Array(32).fill(31);
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("injected Worker failure");
        }
      },
    );
    const input = {
      senderSigningCapability: { signingSecretKey },
    } as EncryptTextInput;

    expect(() => startEncryptTextJob(input)).toThrow("injected Worker failure");
    expect(signingSecretKey).toEqual(new Uint8Array(32));
  });

  it("wipes a file signing capability when Worker construction fails", () => {
    const signingSecretKey = new Uint8Array(32).fill(37);
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("injected Worker failure");
        }
      },
    );
    const input = {
      senderSigningCapability: { signingSecretKey },
    } as EncryptFileInput;

    expect(() => startEncryptFileJob(input)).toThrow("injected Worker failure");
    expect(signingSecretKey).toEqual(new Uint8Array(32));
  });
});
