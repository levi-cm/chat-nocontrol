import { expect, test } from "@playwright/test";
import { encryptFile } from "../../crypto/file";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { createPublicContact } from "../../protocol/ppxc";
import { encodeEncryptedFileObject } from "../../protocol/ppxf";
import { importSessionIdentity } from "./helpers";
import { displayIdentityId } from "../../components/cards/contact-management-card";

test("validates one PPXF file before exposing its download", async ({
  page,
}) => {
  const alice = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(1),
    "Alice",
  );
  const bobEntropy = new Uint8Array(32).fill(2);
  const bob = await deriveIdentityFromEntropy(bobEntropy, "Bob");
  const aliceContact = createPublicContact(alice, "Alice", 1n);
  const object = await encryptFile({
    sender: aliceContact,
    senderSigningCapability: createSenderSigningCapability(alice),
    recipient: createPublicContact(bob, "Bob", 2n),
    file: new Blob(["verified file"]),
    filename: "verified.txt",
    mimeHint: "text/plain",
    caption: "Authenticated caption",
    fileLength: 13n,
  });

  await page.goto("/");
  await importSessionIdentity(page, { entropy: bobEntropy, pseudonym: "Bob" });
  await page.getByRole("link", { name: "Decrypt" }).click();
  await page.getByLabel("Encrypted file").setInputFiles({
    name: "verified.txt.ppxfile",
    mimeType: "application/x-ppx-file",
    buffer: Buffer.from(encodeEncryptedFileObject(object)),
  });
  await expect(
    page.getByText("The app will route armor or file automatically."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Decrypt locally" }).click();

  await expect(
    page.getByRole("heading", { name: "Decrypted file" }),
  ).toBeVisible();
  await expect(page.getByText("verified.txt", { exact: true })).toBeVisible();
  await expect(page.getByText("Authenticated caption")).toBeVisible();
  await expect(
    page.getByText("Preview only after full authentication", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Unknown sender" }),
  ).toBeVisible();
  const senderCard = page.getByLabel("Authenticated sender");
  await expect(senderCard).toContainText("Alice");
  await expect(senderCard).toContainText(
    displayIdentityId(aliceContact.identityId),
  );
  await expect(senderCard).toContainText("Unknown sender");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download decrypted file" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("verified.txt");
});
