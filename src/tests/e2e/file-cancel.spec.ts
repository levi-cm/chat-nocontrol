import { expect, test } from "@playwright/test";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import {
  createPublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import { importSessionIdentity } from "./helpers";

test("cancels active file encryption without a partial download", async ({
  page,
}) => {
  await page.route(/\/assets\/file-worker-[^/]+\.js$/u, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue().catch(() => undefined);
  });
  const bob = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(2),
    "Bob",
  );
  const bobContact = createPublicContact(bob, "Bob", 2n);
  const bobQr = encodePublicContactQr(bobContact);
  let downloads = 0;
  page.on("download", () => {
    downloads += 1;
  });

  await page.goto("/");
  await importSessionIdentity(page, {
    entropy: new Uint8Array(32),
    pseudonym: "Alice",
  });
  await page.getByRole("link", { name: "Contacts" }).click();
  await page.getByLabel("Public contact payload").fill(bobQr);
  await page.getByRole("button", { name: "Save public contact" }).click();
  await page.getByRole("link", { name: "Encrypt" }).click();
  await page
    .getByLabel("Recipient")
    .selectOption(Buffer.from(bobContact.fingerprint).toString("hex"));
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByLabel("Encrypted file").setInputFiles({
    name: "cancel.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(16 * 1_048_576, 7),
  });
  await page.getByRole("button", { name: "Encrypt", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await expect(page.getByRole("status")).toContainText(
    "File operation cancelled.",
  );
  await expect.poll(() => downloads).toBe(0);
});
