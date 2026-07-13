import { expect, test } from "@playwright/test";
import {
  createFileRecordAad,
  createFileRecordNonce,
  encryptFile,
} from "../../crypto/file";
import { decapsulateHybrid } from "../../crypto/hybrid";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { encryptText } from "../../crypto/text";
import { decryptAesGcm, encryptAesGcm } from "../../crypto/webcrypto";
import { checksum16 } from "../../protocol/checksum";
import {
  calculateEncryptedFileChecksum,
  encodeEncryptedFileObject,
} from "../../protocol/ppxf";
import { hashFileHeader } from "../../protocol/ppxf-header";
import { createPublicContact } from "../../protocol/ppxc";
import { encodeTextArmor } from "../../protocol/ppxt-armor";
import { encodeEncryptedTextHeader } from "../../protocol/ppxt-outer";
import type {
  DerivedIdentity,
  EncryptedFileObject,
  EncryptedTextObject,
} from "../../protocol/types";
import { importSessionIdentity } from "./helpers";

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

async function invalidateTextSignature(
  object: EncryptedTextObject,
  recipient: DerivedIdentity,
): Promise<EncryptedTextObject> {
  const key = decapsulateHybrid({
    activeIdentity: recipient,
    mlKemCiphertext: object.mlKemCiphertext,
    ephemeralX25519PublicKey: object.ephemeralX25519PublicKey,
    salt: object.salt,
  });
  const header = encodeEncryptedTextHeader(object);
  const inner = await decryptAesGcm(
    key,
    object.nonce,
    object.ciphertext,
    header,
  );
  const signatureByte = inner.byteLength - 1;
  inner[signatureByte] = (inner[signatureByte] ?? 0) ^ 1;
  const ciphertext = await encryptAesGcm(key, object.nonce, inner, header);
  return {
    ...object,
    ciphertext,
    checksum: checksum16(concatBytes(header, ciphertext)),
  };
}

async function invalidateFileSignature(
  object: EncryptedFileObject,
  recipient: DerivedIdentity,
): Promise<EncryptedFileObject> {
  const key = decapsulateHybrid({
    activeIdentity: recipient,
    mlKemCiphertext: object.header.mlKemCiphertext,
    ephemeralX25519PublicKey: object.header.ephemeralX25519PublicKey,
    salt: object.header.salt,
  });
  const headerHash = hashFileHeader(object.header);
  const nonce = createFileRecordNonce(object.header.noncePrefix, 0xffff_ffff);
  const aad = createFileRecordAad(
    headerHash,
    0xffff_ffff,
    object.manifest.plaintextLength,
    object.header.declaredChunkCount,
    object.header.totalFileLength,
  );
  const manifestPlaintext = await decryptAesGcm(
    key,
    nonce,
    object.manifest.ciphertext,
    aad,
  );
  const signatureByte = manifestPlaintext.byteLength - 1;
  manifestPlaintext[signatureByte] =
    (manifestPlaintext[signatureByte] ?? 0) ^ 1;
  const manifest = {
    ...object.manifest,
    ciphertext: await encryptAesGcm(key, nonce, manifestPlaintext, aad),
  };
  const base = { header: object.header, chunks: object.chunks, manifest };
  return { ...base, checksum: calculateEncryptedFileChecksum(base) };
}

test("shows the distinct authenticated bad-signature failure for text and file", async ({
  page,
}) => {
  const alice = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(21),
    "Alice",
  );
  const bobEntropy = new Uint8Array(32).fill(22);
  const bob = await deriveIdentityFromEntropy(bobEntropy, "Bob");
  const aliceContact = createPublicContact(alice, "Alice", 21n);
  const bobContact = createPublicContact(bob, "Bob", 22n);
  const text = await encryptText({
    sender: aliceContact,
    senderSigningCapability: createSenderSigningCapability(alice),
    recipient: bobContact,
    plaintext: "must stay hidden",
    messageId: new Uint8Array(16).fill(1),
    sentAt: 1n,
    createdAt: 1n,
  });
  const file = new Blob(["must stay hidden"]);
  const encryptedFile = await encryptFile({
    sender: aliceContact,
    senderSigningCapability: createSenderSigningCapability(alice),
    recipient: bobContact,
    file,
    filename: "hidden.txt",
    mimeHint: "text/plain",
    caption: "hidden caption",
    fileLength: BigInt(file.size),
  });
  const badText = encodeTextArmor(await invalidateTextSignature(text, bob));
  const badFile = encodeEncryptedFileObject(
    await invalidateFileSignature(encryptedFile, bob),
  );

  await page.goto("/");
  await importSessionIdentity(page, { entropy: bobEntropy, pseudonym: "Bob" });
  await page.getByRole("link", { name: "Decrypt" }).click();
  await page.getByLabel("Encrypted item").fill(badText);
  await page.getByRole("button", { name: "Decrypt locally" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "The item decrypted, but the sender check failed.",
  );
  await expect(page.getByText("must stay hidden", { exact: true })).toHaveCount(
    0,
  );

  await page.getByLabel("Encrypted file").setInputFiles({
    name: "hidden.ppxfile",
    mimeType: "application/x-ppx-file",
    buffer: Buffer.from(badFile),
  });
  await page.getByRole("button", { name: "Decrypt locally" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "The item decrypted, but the sender check failed.",
  );
  await expect(
    page.getByRole("button", { name: "Download decrypted file" }),
  ).toHaveCount(0);
});
