import { beforeAll, describe, expect, it, vi } from "vitest";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import {
  createDecapsulationCapabilityV2,
  createSenderSigningCapabilityV2,
} from "../../crypto/identity-v2";
import {
  mlDsa87Verify,
  mlKem1024Encapsulate,
} from "../../crypto/pq-provider-v2";
import { decryptTextV2, encryptTextV2 } from "../../crypto/text-v2";
import { checksum16 } from "../../protocol/checksum";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import {
  PPXM_V2_EMPTY_INNER_SIZE,
  PPXT_V2_EMPTY_INNER_MINIMUM_SIZE,
  PPXT_V2_FULL_SIGNATURE_CONTEXT,
  PPXT_V2_COMPACT_SIGNATURE_CONTEXT,
  encodeSignedCompactTextInnerV2,
  encodeSignedFullTextInnerV2,
  parseSignedCompactTextInnerV2,
  parseSignedFullTextInnerV2,
} from "../../protocol/text-v2-inner";
import {
  PPX_TEXT_V2_HEADER_SIZE,
  PPXM_V2_EMPTY_OBJECT_SIZE,
  PPXT_V2_EMPTY_OBJECT_MINIMUM_SIZE,
  encodeEncryptedTextOuterV2,
  encodeEncryptedTextHeaderV2,
  parseEncryptedTextOuterV2,
} from "../../protocol/text-v2-outer";
import type {
  DerivedIdentityV2,
  PublicContactV2,
} from "../../protocol/types-v2";

const bytes = (length: number, value: number) =>
  new Uint8Array(length).fill(value);

describe("Cat-5 PPXT/PPXM V2 wire format", () => {
  it("locks canonical header and exact empty-object sizes", () => {
    expect(PPX_TEXT_V2_HEADER_SIZE).toBe(1623);
    expect(PPXT_V2_EMPTY_INNER_MINIMUM_SIZE).toBe(13_508);
    expect(PPXM_V2_EMPTY_INNER_SIZE).toBe(4_715);
    expect(PPXT_V2_EMPTY_OBJECT_MINIMUM_SIZE).toBe(15_163);
    expect(PPXM_V2_EMPTY_OBJECT_SIZE).toBe(6_370);
  });

  it("round-trips each family without an X25519 field", () => {
    for (const magic of ["PPXT", "PPXM"] as const) {
      const ciphertext = bytes(magic === "PPXT" ? 13_524 : 4_731, 0x55);
      const base = {
        magic,
        formatVersion: 2 as const,
        suite: 2 as const,
        flags: 0 as const,
        mlKemCiphertext: bytes(1568, 0x11),
        salt: bytes(32, 0x22),
        nonce: bytes(12, 0x33),
        ciphertextLength: ciphertext.byteLength,
      };
      const header = encodeEncryptedTextHeaderV2(base);
      expect(header).toHaveLength(1623);
      const payload = new Uint8Array(header.length + ciphertext.length);
      payload.set(header);
      payload.set(ciphertext, header.length);
      const object = { ...base, ciphertext, checksum: checksum16(payload) };
      expect(
        parseEncryptedTextOuterV2(encodeEncryptedTextOuterV2(object)),
      ).toEqual(object);
      expect("ephemeralX25519PublicKey" in object).toBe(false);
    }
  });

  it("rejects V1, wrong suite, unknown flags, family swap and malformed bounds", () => {
    const ciphertext = bytes(13_524, 0x55);
    const base = {
      magic: "PPXT" as const,
      formatVersion: 2 as const,
      suite: 2 as const,
      flags: 0 as const,
      mlKemCiphertext: bytes(1568, 0x11),
      salt: bytes(32, 0x22),
      nonce: bytes(12, 0x33),
      ciphertextLength: ciphertext.length,
    };
    const header = encodeEncryptedTextHeaderV2(base);
    const payload = new Uint8Array(header.length + ciphertext.length);
    payload.set(header);
    payload.set(ciphertext, header.length);
    const encoded = encodeEncryptedTextOuterV2({
      ...base,
      ciphertext,
      checksum: checksum16(payload),
    });
    for (const [offset, value, message] of [
      [4, 1, "unknown-format-version"],
      [5, 1, "unknown-suite"],
      [6, 2, "unknown-flags"],
    ] as const) {
      const mutated = Uint8Array.from(encoded);
      mutated[offset] = value;
      mutated.set(checksum16(mutated.slice(0, -16)), mutated.length - 16);
      expect(() => parseEncryptedTextOuterV2(mutated)).toThrow(message);
    }
    expect(() => parseEncryptedTextOuterV2(encoded.slice(0, -1))).toThrow();
    expect(() => parseEncryptedTextOuterV2(encoded, "PPXM")).toThrow(
      "noncanonical-text",
    );
  });
});

describe("Cat-5 signed text V2", () => {
  let senderIdentity: DerivedIdentityV2;
  let recipientIdentity: DerivedIdentityV2;
  let sender: PublicContactV2;
  let recipient: PublicContactV2;

  beforeAll(async () => {
    senderIdentity = await deriveIdentityV2FromEntropy(bytes(32, 0x10));
    recipientIdentity = await deriveIdentityV2FromEntropy(bytes(32, 0x20));
    sender = createPublicContactV2(senderIdentity, "A", 1n, bytes(32, 0x30));
    recipient = createPublicContactV2(
      recipientIdentity,
      "B",
      2n,
      bytes(32, 0x40),
    );
  });

  it("locks distinct short signature contexts and canonical empty layouts", () => {
    expect(PPXT_V2_FULL_SIGNATURE_CONTEXT).toBe("PPX/TEXT/FULL/V2");
    expect(PPXT_V2_COMPACT_SIGNATURE_CONTEXT).toBe("PPX/TEXT/COMPACT/V2");
    const fullSigningSecret = Uint8Array.from(senderIdentity.signingSecretKey);
    const fullEntropy = bytes(32, 0x60);
    const common = {
      signingSecretKey: fullSigningSecret,
      recipientId: recipient.identityId,
      messageId: bytes(16, 0x50),
      sentAt: 3n,
      createdAt: 4n,
      originalUtf8Length: 0,
      storedPayload: new Uint8Array(),
      signatureEntropy: fullEntropy,
    };
    const full = encodeSignedFullTextInnerV2({
      ...common,
      senderContact: sender,
    });
    const compact = encodeSignedCompactTextInnerV2({
      ...common,
      signingSecretKey: Uint8Array.from(senderIdentity.signingSecretKey),
      signatureEntropy: bytes(32, 0x61),
      senderFingerprint: sender.fingerprint,
    });
    expect(fullSigningSecret.every((byte) => byte === 0)).toBe(true);
    expect(fullEntropy.every((byte) => byte === 0)).toBe(true);
    expect(full).toHaveLength(13_508);
    expect(compact).toHaveLength(4_715);
    expect(parseSignedFullTextInnerV2(full).senderContact).toEqual(sender);
    expect(
      parseSignedCompactTextInnerV2(compact, [sender]).senderContact,
    ).toEqual(sender);
  });

  it("uses randomized signatures and rejects cross-context/type swaps", () => {
    const common = {
      signingSecretKey: Uint8Array.from(senderIdentity.signingSecretKey),
      recipientId: recipient.identityId,
      messageId: bytes(16, 0x50),
      sentAt: 3n,
      createdAt: 4n,
      originalUtf8Length: 2,
      storedPayload: new TextEncoder().encode("hi"),
    };
    const first = encodeSignedCompactTextInnerV2({
      ...common,
      senderFingerprint: sender.fingerprint,
      signatureEntropy: bytes(32, 0x61),
    });
    const second = encodeSignedCompactTextInnerV2({
      ...common,
      signingSecretKey: Uint8Array.from(senderIdentity.signingSecretKey),
      senderFingerprint: sender.fingerprint,
      signatureEntropy: bytes(32, 0x62),
    });
    expect(first.slice(-4627)).not.toEqual(second.slice(-4627));
    expect(
      mlDsa87Verify(
        first.slice(-4627),
        first.slice(0, -4627),
        sender.signingPublicKey,
        new TextEncoder().encode(PPXT_V2_FULL_SIGNATURE_CONTEXT),
      ),
    ).toBe(false);
    expect(() => parseSignedFullTextInnerV2(first)).toThrow();
    expect(() => parseSignedCompactTextInnerV2(first, [])).toThrow(
      "unknown-sender-contact",
    );
    const tampered = Uint8Array.from(first);
    tampered[88] = (tampered[88] as number) ^ 1;
    expect(() => parseSignedCompactTextInnerV2(tampered, [sender])).toThrow(
      "invalid-signature",
    );
  });

  it("encrypts/decrypts both families, binds family, and collapses wrong keys", async () => {
    const deterministicKem = {
      encapsulate: (publicKey: Uint8Array) =>
        mlKem1024Encapsulate(publicKey, bytes(32, 0x71)),
      randomBytes: () => bytes(32, 0x72),
    };
    for (const compact of [false, true]) {
      const object = await encryptTextV2(
        {
          compact,
          sender,
          senderSigningCapability:
            createSenderSigningCapabilityV2(senderIdentity),
          recipient,
          plaintext: compact ? "compact hello" : "full hello",
          messageId: bytes(16, 0x73),
          sentAt: 5n,
          createdAt: 6n,
        },
        {
          kem: deterministicKem,
          randomBytes: (length) => bytes(length, 0x74),
        },
      );
      expect(object.magic).toBe(compact ? "PPXM" : "PPXT");
      const decapsulationCapability =
        createDecapsulationCapabilityV2(recipientIdentity);
      const output = await decryptTextV2({
        object,
        activeIdentity: decapsulationCapability,
        knownSenders: compact ? [sender] : [],
      });
      expect(output.plaintext).toBe(compact ? "compact hello" : "full hello");
      expect(output.senderContact).toEqual(sender);
      expect(
        decapsulationCapability.kemSecretKey.every((byte) => byte === 0),
      ).toBe(true);

      const wrongFamily = {
        ...object,
        magic: compact ? "PPXT" : "PPXM",
      } as typeof object;
      await expect(
        decryptTextV2({
          object: wrongFamily,
          activeIdentity: createDecapsulationCapabilityV2(recipientIdentity),
          knownSenders: [sender],
        }),
      ).rejects.toThrow("wrong-identity-or-corruption");
    }

    const wrong = await deriveIdentityV2FromEntropy(bytes(32, 0x75));
    const object = await encryptTextV2({
      compact: true,
      sender,
      senderSigningCapability: createSenderSigningCapabilityV2(senderIdentity),
      recipient,
      plaintext: "secret",
      messageId: bytes(16, 0x76),
      sentAt: 7n,
      createdAt: 8n,
    });
    await expect(
      decryptTextV2({
        object,
        activeIdentity: createDecapsulationCapabilityV2(wrong),
        knownSenders: [sender],
      }),
    ).rejects.toThrow("wrong-identity-or-corruption");
    await expect(
      decryptTextV2({
        object,
        activeIdentity: createDecapsulationCapabilityV2(recipientIdentity),
        knownSenders: [],
      }),
    ).rejects.toThrow("unknown-sender-contact");
  });

  it("uses meaningful plaintext gzip and enforces exact original length", async () => {
    const plaintext = "compress me ".repeat(1000);
    const object = await encryptTextV2({
      compact: true,
      sender,
      senderSigningCapability: createSenderSigningCapabilityV2(senderIdentity),
      recipient,
      plaintext,
      messageId: bytes(16, 0x77),
      sentAt: 9n,
      createdAt: 10n,
    });
    expect(object.flags).toBe(1);
    const tamperedCiphertext = Uint8Array.from(object.ciphertext);
    tamperedCiphertext[0] = (tamperedCiphertext[0] as number) ^ 1;
    const tamperedHeader = encodeEncryptedTextHeaderV2({
      ...object,
      ciphertextLength: tamperedCiphertext.length,
    });
    const tamperedPayload = new Uint8Array(
      tamperedHeader.length + tamperedCiphertext.length,
    );
    tamperedPayload.set(tamperedHeader);
    tamperedPayload.set(tamperedCiphertext, tamperedHeader.length);
    await expect(
      decryptTextV2({
        object: {
          ...object,
          ciphertext: tamperedCiphertext,
          checksum: checksum16(tamperedPayload),
        },
        activeIdentity: createDecapsulationCapabilityV2(recipientIdentity),
        knownSenders: [sender],
      }),
    ).rejects.toThrow("wrong-identity-or-corruption");
    await expect(
      decryptTextV2({
        object,
        activeIdentity: createDecapsulationCapabilityV2(recipientIdentity),
        knownSenders: [sender],
      }),
    ).resolves.toMatchObject({ plaintext });

    vi.stubGlobal("DecompressionStream", undefined);
    await expect(
      decryptTextV2({
        object,
        activeIdentity: createDecapsulationCapabilityV2(recipientIdentity),
        knownSenders: [sender],
      }),
    ).rejects.toThrow("unsupported-compression");
    vi.unstubAllGlobals();
  });

  it("rejects noncanonical message ids, oversized plaintext and bad signing capability", async () => {
    const base = {
      compact: true,
      sender,
      recipient,
      plaintext: "ok",
      messageId: bytes(16, 0x91),
      sentAt: 11n,
      createdAt: 12n,
    };
    await expect(
      encryptTextV2({
        ...base,
        messageId: bytes(15, 0x91),
        senderSigningCapability:
          createSenderSigningCapabilityV2(senderIdentity),
      }),
    ).rejects.toThrow("invalid-signature");
    await expect(
      encryptTextV2({
        ...base,
        plaintext: "a".repeat(262_145),
        senderSigningCapability:
          createSenderSigningCapabilityV2(senderIdentity),
      }),
    ).rejects.toThrow("impossible-length");
    const badCapability = createSenderSigningCapabilityV2(senderIdentity);
    badCapability.signingPublicKey[0] =
      (badCapability.signingPublicKey[0] as number) ^ 1;
    await expect(
      encryptTextV2({ ...base, senderSigningCapability: badCapability }),
    ).rejects.toThrow("invalid-signature");
  });
});
