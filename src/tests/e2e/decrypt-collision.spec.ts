import { expect, test } from "@playwright/test";
import { encryptFileV2 } from "../../crypto/file-v2";
import {
  createSenderSigningCapabilityV2,
  deriveIdentityV2FromEntropy,
} from "../../crypto/identity-v2";
import { encryptTextV2 } from "../../crypto/text-v2";
import {
  createPublicContactV2,
  encodePublicContactV2Text,
} from "../../protocol/ppxc-v2";
import { encodeEncryptedFileObjectV2 } from "../../protocol/ppxf-v2";
import { encodeTextArmorV2 } from "../../protocol/ppxt-armor-v2";
import { importSessionIdentity } from "./helpers";

test("keeps same-pseudonym text and file senders separate until verified", async ({
  page,
}) => {
  const bobEntropy = new Uint8Array(32).fill(31);
  const bob = await deriveIdentityV2FromEntropy(bobEntropy, "Bob");
  const bobContact = createPublicContactV2(bob, "Bob", 31n);
  const knownAlice = await deriveIdentityV2FromEntropy(
    new Uint8Array(32).fill(32),
    "Alice",
  );
  const textAlice = await deriveIdentityV2FromEntropy(
    new Uint8Array(32).fill(33),
    "Alice",
  );
  const fileAlice = await deriveIdentityV2FromEntropy(
    new Uint8Array(32).fill(34),
    "Alice",
  );
  const text = encodeTextArmorV2(
    await encryptTextV2({
      compact: false,
      sender: createPublicContactV2(textAlice, "Alice", 33n),
      senderSigningCapability: createSenderSigningCapabilityV2(textAlice),
      recipient: bobContact,
      plaintext: "collision text",
      messageId: new Uint8Array(16).fill(3),
      sentAt: 3n,
      createdAt: 3n,
    }),
  );
  const plaintextFile = new Blob(["collision file"]);
  const file = encodeEncryptedFileObjectV2(
    await encryptFileV2({
      sender: createPublicContactV2(fileAlice, "Alice", 34n),
      senderSigningCapability: createSenderSigningCapabilityV2(fileAlice),
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
    .fill(
      encodePublicContactV2Text(
        createPublicContactV2(knownAlice, "Alice", 32n),
      ),
    );
  await page.getByRole("button", { name: "Save public contact" }).click();

  await page.getByRole("link", { name: "Decrypt" }).click();
  await page.getByLabel("Encrypted item").fill(text);
  await page.getByRole("button", { name: "Decrypt locally" }).click();
  await page.getByRole("button", { name: "Save contact" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Same pseudonym, different key. Keep both entries separate until you verify which one you want.",
  );
  await page.getByRole("button", { name: "Save as separate contact" }).click();

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
