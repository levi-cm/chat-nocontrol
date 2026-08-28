import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deriveIdentityV2FromEntropy,
  type IdentityV2DerivationPrimitives,
} from "../../crypto/identity-v2";
import {
  encapsulateMlKemV2,
  type MlKemV2EncapsulationPrimitives,
} from "../../crypto/kem-v2";
import { deriveHkdfSha512 } from "../../crypto/noble-provider";
import { PPXError } from "../../protocol/types";
import { ObjectFamilyV2 } from "../../protocol/types-v2";
import type {
  EncryptFileInputV2,
  EncryptTextInputV2,
  PublicContactV2,
  SenderSigningCapabilityV2,
} from "../../protocol/types-v2";
import { startEncryptTextJob } from "../../workers/crypto-client";
import { startEncryptFileJob } from "../../workers/file-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function signingCapability(value: number): SenderSigningCapabilityV2 {
  return {
    suite: 0x02,
    fingerprint: new Uint8Array(32).fill(1),
    signingPublicKey: new Uint8Array(2592).fill(2),
    signingSecretKey: new Uint8Array(4896).fill(value),
  };
}

function publicContact(value: number): PublicContactV2 {
  return {
    magic: "PPXC",
    formatVersion: 2,
    suite: 2,
    creationTime: 1n,
    pseudonym: "Test",
    kemPublicKey: new Uint8Array(1568).fill(value),
    signingPublicKey: new Uint8Array(2592).fill(value),
    selfSignature: new Uint8Array(4627).fill(value),
    checksum: new Uint8Array(16).fill(value),
    fingerprint: new Uint8Array(32).fill(value),
    identityId: new Uint8Array(20).fill(value),
  };
}

describe("Cat-5 V2 secret failure cleanup", () => {
  it("wipes derived seeds and ML-KEM-1024 secret if identity derivation fails", async () => {
    const derived: Uint8Array[] = [];
    const kemSecretKey = new Uint8Array(3168).fill(11);
    const primitives: IdentityV2DerivationPrimitives = {
      deriveKey(input, salt, info, length) {
        const output = deriveHkdfSha512(input, salt, info, length);
        derived.push(output);
        return output;
      },
      kemKeygen: () => ({
        publicKey: new Uint8Array(1568),
        secretKey: kemSecretKey,
      }),
      dsaKeygen: () => {
        throw new Error("injected ML-DSA keygen failure");
      },
    };

    await expect(
      deriveIdentityV2FromEntropy(
        new Uint8Array(32).fill(9),
        "Alice",
        0n,
        primitives,
      ),
    ).rejects.toThrow("injected ML-DSA keygen failure");
    expect(derived).toHaveLength(2);
    for (const buffer of derived) {
      expect(buffer.every((byte) => byte === 0)).toBe(true);
    }
    expect(kemSecretKey).toEqual(new Uint8Array(3168));
  });

  it("wipes ML-KEM shared secret when V2 key derivation fails", () => {
    const sharedSecret = new Uint8Array(31).fill(11);
    const primitives: MlKemV2EncapsulationPrimitives = {
      randomBytes: (length) => new Uint8Array(length).fill(12),
      encapsulate: () => ({
        cipherText: new Uint8Array(1568),
        sharedSecret,
      }),
    };

    expect(() =>
      encapsulateMlKemV2(
        {
          objectFamily: ObjectFamilyV2.Text,
          recipientFingerprint: new Uint8Array(32),
          recipientKemPublicKey: new Uint8Array(1568),
        },
        primitives,
      ),
    ).toThrow(PPXError);
    expect(sharedSecret).toEqual(new Uint8Array(31));
  });

  it("rejects malformed recipients before ML-KEM-1024 work", () => {
    const encapsulate = vi.fn();
    const primitives: MlKemV2EncapsulationPrimitives = {
      randomBytes: (length) => new Uint8Array(length),
      encapsulate,
    };

    expect(() =>
      encapsulateMlKemV2(
        {
          objectFamily: ObjectFamilyV2.Text,
          recipientFingerprint: new Uint8Array(31),
          recipientKemPublicKey: new Uint8Array(1568),
        },
        primitives,
      ),
    ).toThrow(PPXError);
    expect(encapsulate).not.toHaveBeenCalled();
  });

  it("wipes caller-owned V2 text authority when Worker construction fails", () => {
    const senderSigningCapability = signingCapability(31);
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("injected Worker failure");
        }
      },
    );
    const input: EncryptTextInputV2 = {
      compact: false,
      sender: publicContact(41),
      senderSigningCapability,
      recipient: publicContact(42),
      plaintext: "secret",
      messageId: new Uint8Array(16).fill(43),
      sentAt: 1n,
      createdAt: 1n,
    };

    expect(() => startEncryptTextJob(input)).toThrow("injected Worker failure");
    expect(senderSigningCapability.signingSecretKey).toEqual(
      new Uint8Array(4896),
    );
  });

  it("wipes V2 file signing authority when Worker construction fails", () => {
    const senderSigningCapability = signingCapability(37);
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("injected Worker failure");
        }
      },
    );
    const input = { senderSigningCapability } as EncryptFileInputV2;

    expect(() => startEncryptFileJob(input)).toThrow("injected Worker failure");
    expect(senderSigningCapability.signingSecretKey).toEqual(
      new Uint8Array(4896),
    );
  });
});
