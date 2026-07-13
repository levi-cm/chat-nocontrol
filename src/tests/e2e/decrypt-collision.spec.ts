import { expect, test } from "@playwright/test";
import { encryptFile } from "../../crypto/file";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { encryptText } from "../../crypto/text";
import {
  createPublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import { encodeEncryptedFileObject } from "../../protocol/ppxf";
import { encodeTextArmor } from "../../protocol/ppxt-armor";
import { importSessionIdentity } from "./helpers";

test("keeps same-pseudonym text and file senders separate until verified", async ({
  page,
}) => {
  const bobEntropy = new Uint8Array(32).fill(31);
  const bob = await deriveIdentityFromEntropy(bobEntropy, "Bob");
  const bobContact = createPublicContact(bob, "Bob", 31n);
  const knownAlice = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(32),
    "Alice",
  );
  const textAlice = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(33),
    "Alice",
  );
  const fileAlice = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(34),
    "Alice",
  );
  const text = encodeTextArmor(
    await encryptText({
      sender: createPublicContact(textAlice, "Alice", 33n),
      senderSigningCapability: createSenderSigningCapability(textAlice),
      recipient: bobContact,
      plaintext: "collision text",
      messageId: new Uint8Array(16).fill(3),
      sentAt: 3n,
      createdAt: 3n,
    }),
  );
  const plaintextFile = new Blob(["collision file"]);
  const file = encodeEncryptedFileObject(
    await encryptFile({
      sender: createPublicContact(fileAlice, "Alice", 34n),
      senderSigningCapability: createSenderSigningCapability(fileAlice),
      recipient: bobContact,
      file: plaintextFile,
      filename: "collision.txt",
      mimeHint: "text/plain",
      caption: "",
      fileLength: BigInt(plaintextFile.size),
    }),
  );

  await page.goto("/");
  await importSessionIdentity(page, { entropy: bobEntropy, pseudonym: "Bob" });
  await page.getByRole("link", { name: "Contacts" }).click();
  await page
    .getByLabel("Public contact payload")
    .fill(encodePublicContactQr(createPublicContact(knownAlice, "Alice", 32n)));
  await page.getByRole("button", { name: "Save public contact" }).click();

  await page.getByRole("link", { name: "Decrypt" }).click();
  await page.getByLabel("Encrypted item").fill(text);
  await page.getByRole("button", { name: "Decrypt locally" }).click();
  await page.getByRole("button", { name: "Save contact" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Same pseudonym, different key. Keep both entries separate until you verify which one you want.",
  );

  await page.getByLabel("Encrypted file").setInputFiles({
    name: "collision.ppxfile",
    mimeType: "application/x-ppx-file",
    buffer: Buffer.from(file),
  });
  await page.getByRole("button", { name: "Decrypt locally" }).click();
  await page.getByRole("button", { name: "Save contact" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Same pseudonym, different key. Keep both entries separate until you verify which one you want.",
  );

  await page.getByRole("link", { name: "Contacts" }).click();
  await expect(page.getByText("Alice", { exact: true })).toHaveCount(3);
});
