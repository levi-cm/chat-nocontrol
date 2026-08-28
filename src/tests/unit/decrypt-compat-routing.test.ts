import { beforeAll, describe, expect, it } from "vitest";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import {
  createSenderSigningCapabilityV2,
  deriveIdentityV2FromEntropy,
} from "../../crypto/identity-v2";
import { encryptText } from "../../crypto/text";
import { encryptTextV2 } from "../../crypto/text-v2";
import {
  classifyEncryptedFile,
  classifyEncryptedText,
} from "../../flows/decrypt/compat-routing";
import { createPublicContact } from "../../protocol/ppxc";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import { encodeTextArmor } from "../../protocol/ppxt-armor";
import { encodeTextArmorV2 } from "../../protocol/ppxt-armor-v2";
import { encodeMessageLink } from "../../protocol/message-link";
import { encodeBase37Upper } from "../../protocol/base37";
import { encodeBase64UrlNoPad } from "../../protocol/base64url";
import { checksum16 } from "../../protocol/checksum";
import {
  encodeEncryptedQrText,
  encodeEncryptedQrTextHeader,
} from "../../protocol/ppxq-outer";

describe("read-old/write-new decrypt routing", () => {
  let legacyShort: string;
  let legacyCompressed: string;
  let cat5: string;
  let legacyLink: string;
  let legacyCompressedLink: string;
  let legacyCompactBytes: Uint8Array;

  beforeAll(async () => {
    const legacyAlice = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(31),
      "Alice",
    );
    const legacyBob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(32),
      "Bob",
    );
    const legacySender = createPublicContact(legacyAlice, "Alice", 31n);
    const legacyRecipient = createPublicContact(legacyBob, "Bob", 32n);
    const encryptLegacy = (plaintext: string, marker: number) =>
      encryptText({
        sender: legacySender,
        senderSigningCapability: createSenderSigningCapability(legacyAlice),
        recipient: legacyRecipient,
        plaintext,
        messageId: new Uint8Array(16).fill(marker),
        sentAt: BigInt(marker),
        createdAt: BigInt(marker),
      });
    const legacyShortObject = await encryptLegacy("old", 33);
    legacyShort = encodeTextArmor(legacyShortObject);
    legacyLink = encodeMessageLink(
      { kind: "ppxt", object: legacyShortObject },
      "https://example.test/app/",
    );
    const legacyCompressedObject = await encryptLegacy(
      "compressible ".repeat(600),
      34,
    );
    legacyCompressed = encodeTextArmor(legacyCompressedObject);
    legacyCompressedLink = encodeMessageLink(
      { kind: "ppxt", object: legacyCompressedObject },
      "https://example.test/app/",
    );
    const compactBase = {
      magic: "PPXQ" as const,
      formatVersion: 1 as const,
      suite: 1 as const,
      flags: 0 as const,
      mlKemCiphertext: new Uint8Array(768).fill(1),
      ephemeralX25519PublicKey: new Uint8Array(32).fill(2),
      salt: new Uint8Array(32).fill(3),
      nonce: new Uint8Array(12).fill(4),
      ciphertextLength: 16,
      ciphertext: new Uint8Array(16).fill(5),
    };
    const compactHeader = encodeEncryptedQrTextHeader(compactBase);
    const compactPayload = new Uint8Array(
      compactHeader.byteLength + compactBase.ciphertext.byteLength,
    );
    compactPayload.set(compactHeader);
    compactPayload.set(compactBase.ciphertext, compactHeader.byteLength);
    legacyCompactBytes = encodeEncryptedQrText({
      ...compactBase,
      checksum: checksum16(compactPayload),
    });

    const cat5Alice = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(35),
      "Alice",
    );
    const cat5Bob = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(36),
      "Bob",
    );
    cat5 = encodeTextArmorV2(
      await encryptTextV2({
        compact: false,
        sender: createPublicContactV2(cat5Alice, "Alice", 35n),
        senderSigningCapability: createSenderSigningCapabilityV2(cat5Alice),
        recipient: createPublicContactV2(cat5Bob, "Bob", 36n),
        plaintext: "new",
        messageId: new Uint8Array(16).fill(37),
        sentAt: 37n,
        createdAt: 37n,
      }),
    );
  }, 30_000);

  it("routes both Suite-1 PPXT envelope versions to the legacy reader", () => {
    const short = classifyEncryptedText(legacyShort);
    const compressed = classifyEncryptedText(legacyCompressed);

    expect(short.kind).toBe("legacy-v1-full");
    expect(compressed.kind).toBe("legacy-v1-full");
    if (
      short.kind !== "legacy-v1-full" ||
      compressed.kind !== "legacy-v1-full"
    ) {
      throw new Error("expected legacy text");
    }
    expect(short.object.formatVersion).toBe(1);
    expect(compressed.object.formatVersion).toBe(2);
  });

  it("keeps CAT-5 PPXT on the V2 path", () => {
    const classified = classifyEncryptedText(cat5);

    expect(classified.kind).toBe("cat5-v2");
    if (classified.kind !== "cat5-v2") throw new Error("expected CAT-5");
    expect(classified.object).toMatchObject({ formatVersion: 2, suite: 2 });
  });

  it("routes canonical V1 compact text and old QR links", () => {
    const base37 = encodeBase37Upper(legacyCompactBytes);
    for (const text of [
      `PPX1:MESSAGE:${base37}`,
      `https://example.test/#/decrypt/qr/${base37}`,
      `https://foreign.invalid/app/#/decrypt/qr/${base37}`,
      `https://example.test/#/m/${encodeBase64UrlNoPad(legacyCompactBytes)}`,
    ]) {
      const classified = classifyEncryptedText(text);
      expect(classified.kind).toBe("legacy-v1-compact");
      if (classified.kind !== "legacy-v1-compact") throw new Error("compact");
      expect(classified.ppxqBytes).toEqual(legacyCompactBytes);
    }
  });

  it("routes V1 full PPXT inside the old #/m family", () => {
    for (const [link, armor] of [
      [legacyLink, legacyShort],
      [legacyCompressedLink, legacyCompressed],
    ] as const) {
      const classified = classifyEncryptedText(link);
      expect(classified.kind).toBe("legacy-v1-full");
      if (classified.kind !== "legacy-v1-full") throw new Error("full");
      const armored = classifyEncryptedText(armor);
      if (armored.kind !== "legacy-v1-full") throw new Error("armored full");
      expect(classified.object).toEqual(armored.object);
    }
  });

  it.each([
    "PPX1:MESSAGE:abc",
    "http://example.test/#/decrypt/qr/ABC",
    "http://localhost/#/decrypt/qr/ABC",
    "http://127.0.0.1/#/decrypt/qr/ABC",
    "http://[::1]/#/decrypt/qr/ABC",
    "https://u:p@example.test/#/decrypt/qr/ABC",
    "https://example.test/?leak=1#/decrypt/qr/ABC",
    `https://example.test/#/m/${"A".repeat(100_000)}`,
  ])("fails closed for malformed or unsafe legacy transport %s", (text) => {
    expect(() => classifyEncryptedText(text)).toThrow();
  });

  it("routes only exact PPXF version/suite pairs", async () => {
    expect(
      await classifyEncryptedFile(
        new File([Uint8Array.of(80, 80, 88, 70, 1, 1)], "old.ppxfile"),
      ),
    ).toBe("legacy-v1");
    expect(
      await classifyEncryptedFile(
        new File([Uint8Array.of(80, 80, 88, 70, 2, 2)], "new.ppxfile"),
      ),
    ).toBe("cat5-v2");
    await expect(
      classifyEncryptedFile(
        new File([Uint8Array.of(80, 80, 88, 70, 2, 1)], "mixed.ppxfile"),
      ),
    ).rejects.toThrow();
  });
});
