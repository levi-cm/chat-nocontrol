import { describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import {
  createPublicContact,
  parsePublicContact,
  PPXC_MAXIMUM_SIZE,
} from "../../protocol/ppxc";
import {
  parseEncryptedFileObject,
  PPXF_ENCODED_MAX_BYTES,
} from "../../protocol/ppxf";
import { parseRecoveryObject, PPXR_MAXIMUM_SIZE } from "../../protocol/ppxr";
import {
  parseEncryptedTextOuter,
  PPXT_MAXIMUM_OBJECT_SIZE,
} from "../../protocol/ppxt-outer";
import { encodeSignedTextInner } from "../../protocol/ppxt-inner";
import { parseLockedVault, PPXV_MAXIMUM_SIZE } from "../../protocol/ppxv";
import { checksum16 } from "../../protocol/checksum";
import { StrictByteWriter } from "../../protocol/bytes";
import { parseFileHeader } from "../../protocol/ppxf-header";
import {
  canonicalProtocolBytes,
  parseForCanonicalRoundTrip,
} from "../helpers/canonical-protocol";

describe("declared protocol boundaries", () => {
  it("rejects oversize PPXC, PPXV, PPXR, PPXT, and PPXF before allocation", () => {
    const oversized = (byteLength: number) =>
      ({ byteLength }) as unknown as Uint8Array;
    const cases = [
      [parsePublicContact, PPXC_MAXIMUM_SIZE],
      [parseLockedVault, PPXV_MAXIMUM_SIZE],
      [parseRecoveryObject, PPXR_MAXIMUM_SIZE],
      [parseEncryptedTextOuter, PPXT_MAXIMUM_OBJECT_SIZE],
      [parseEncryptedFileObject, PPXF_ENCODED_MAX_BYTES],
    ] as const;
    for (const [parse, maximum] of cases) {
      expect(() => parse(oversized(maximum + 1))).toThrow(
        "oversize-before-allocation",
      );
    }
  });

  it("rejects checksum-valid noncanonical PPXV ciphertext before KDF", () => {
    const ciphertextLength = 106;
    const writer = new StrictByteWriter(56 + ciphertextLength + 16);
    writer.writeBytes(new TextEncoder().encode("PPXV"));
    writer.writeUint8(1);
    writer.writeUint8(1);
    writer.writeUint8(1);
    writer.writeUint8(1);
    writer.writeUint64BE(65_536n);
    writer.writeUint32BE(8);
    writer.writeUint32BE(2);
    writer.writeBytes(new Uint8Array(16));
    writer.writeBytes(new Uint8Array(12));
    writer.writeUint32BE(ciphertextLength);
    writer.writeBytes(new Uint8Array(ciphertextLength));
    const payload = writer.toBytes();
    writer.writeBytes(checksum16(payload));
    expect(() => parseLockedVault(writer.toBytes())).toThrow(
      "oversize-before-allocation",
    );
  });

  it("reports impossible lengths before unknown versions in every family", async () => {
    const fixtures = await canonicalProtocolBytes();
    const ppxc = fixtures.ppxc.slice();
    ppxc[4] = 2;
    ppxc[7] = 0;
    expect(() => parseForCanonicalRoundTrip("ppxc", ppxc)).toThrow(
      "impossible-length",
    );

    const ppxr = fixtures.ppxr.slice();
    ppxr[4] = 2;
    ppxr[7] = 0;
    expect(() => parseForCanonicalRoundTrip("ppxr", ppxr)).toThrow(
      "impossible-length",
    );

    const ppxv = fixtures.ppxv.slice();
    ppxv[4] = 2;
    ppxv.fill(0, 52, 56);
    expect(() => parseForCanonicalRoundTrip("ppxv", ppxv)).toThrow(
      "impossible-length",
    );

    const ppxt = fixtures.ppxt.slice();
    ppxt[4] = 2;
    ppxt.fill(0, 851, 855);
    expect(() => parseForCanonicalRoundTrip("ppxt", ppxt)).toThrow(
      "impossible-length",
    );

    const ppxfHeader = fixtures.ppxf.slice(0, 884);
    ppxfHeader[4] = 2;
    ppxfHeader.fill(0, 872, 876);
    expect(() => parseFileHeader(ppxfHeader)).toThrow("impossible-length");
  });

  it("enforces pseudonym, text, recipient, and message ID limits", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const contact = createPublicContact(identity, "Alice", 1n);
    expect(() => createPublicContact(identity, "A".repeat(49), 1n)).toThrow(
      "impossible-length",
    );
    expect(() =>
      encodeSignedTextInner({
        senderContact: contact,
        signingSecretKey: identity.signingSecretKey,
        recipientId: identity.identityId,
        messageId: new Uint8Array(65),
        sentAt: 1n,
        createdAt: 1n,
        plaintext: "x",
      }),
    ).toThrow("impossible-length");
    expect(() =>
      encodeSignedTextInner({
        senderContact: contact,
        signingSecretKey: identity.signingSecretKey,
        recipientId: identity.identityId,
        messageId: new Uint8Array(16),
        sentAt: 1n,
        createdAt: 1n,
        plaintext: "x".repeat(262_145),
      }),
    ).toThrow("impossible-length");
  });
});
