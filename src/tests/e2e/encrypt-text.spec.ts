import { expect, test } from "@playwright/test";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { displayIdentityId } from "../../components/cards/contact-management-card";
import {
  createPublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";

test("encrypts text to one selected contact locally", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: () => Promise.resolve(""),
        writeText: () => Promise.reject(new DOMException("denied")),
      },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: (command: string) => {
        if (command !== "copy") return false;
        localStorage.setItem("legacy-encrypted-copy", "yes");
        return true;
      },
    });
  });
  const bob = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(2),
    "Bob",
  );
  const bobContact = createPublicContact(bob, "Bob", 2n);
  const bobQr = encodePublicContactQr(bobContact);
  const bobOptionValue = Buffer.from(bobContact.fingerprint).toString("hex");
  const secondBob = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(3),
    "Bob",
  );
  const secondBobContact = createPublicContact(secondBob, "Bob", 3n);

  await page.goto("/");
  await page.getByRole("button", { name: "Import identity" }).click();
  await page.getByLabel("Pseudonym").fill("Alice");
  await page
    .getByLabel("24 recovery words")
    .fill(`${"abandon ".repeat(23)}art`);
  await page.getByRole("button", { name: "Import recovery words" }).click();
  await page.getByRole("button", { name: "No, use session only" }).click();

  await page.getByRole("link", { name: "Contacts" }).click();
  await page.getByLabel("Public contact payload").fill(bobQr);
  await page.getByRole("button", { name: "Save public contact" }).click();

  await page.getByRole("link", { name: "Encrypt" }).click();
  await expect(
    page.getByText("Choose a recipient to start encrypting", { exact: true }),
  ).toBeVisible();
  await page
    .getByPlaceholder("Search by pseudonym, nickname, or fingerprint")
    .fill("Bob");
  await page.getByLabel("Recipient").selectOption(bobOptionValue);
  await page.getByLabel("Encrypted text").fill("Meet at 21:00.");
  await page
    .getByPlaceholder("Search by pseudonym, nickname, or fingerprint")
    .fill("Alice");
  await expect(page.getByLabel("Recipient")).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Encrypt", exact: true }),
  ).toBeDisabled();
  await page
    .getByPlaceholder("Search by pseudonym, nickname, or fingerprint")
    .fill("Bob");
  await page.getByLabel("Recipient").selectOption(bobOptionValue);
  await page.getByRole("button", { name: "Encrypt", exact: true }).click();
  await expect(page.getByLabel("Encrypted output")).toHaveValue(
    /BEGIN PPX ENCRYPTED TEXT/u,
  );
  await page.getByRole("button", { name: "Copy encrypted output" }).click();
  await expect(
    page.getByRole("status").filter({
      hasText:
        /^Copied\. Clipboard clearing after 60 seconds is best effort\.$/u,
    }),
  ).toHaveText("Copied. Clipboard clearing after 60 seconds is best effort.");
  expect(
    await page.evaluate(() => localStorage.getItem("legacy-encrypted-copy")),
  ).toBe("yes");
  await page.getByLabel("Encrypted text").fill("Changed after encryption");
  await expect(page.getByLabel("Encrypted output")).toHaveCount(0);

  await page.getByRole("link", { name: "Contacts" }).click();
  await page
    .getByLabel("Public contact payload")
    .fill(encodePublicContactQr(secondBobContact));
  await page.getByRole("button", { name: "Save public contact" }).click();
  await page.getByRole("link", { name: "Encrypt" }).click();
  const bobOptions = await page
    .getByLabel("Recipient")
    .locator("option")
    .filter({ hasText: "Bob" })
    .allTextContents();
  expect(bobOptions).toHaveLength(2);
  expect(new Set(bobOptions).size).toBe(2);
  expect(bobOptions.join(" ")).toContain(
    displayIdentityId(bobContact.identityId),
  );
  expect(bobOptions.join(" ")).toContain(
    displayIdentityId(secondBobContact.identityId),
  );
  await page
    .getByLabel("Recipient")
    .selectOption(Buffer.from(secondBobContact.fingerprint).toString("hex"));
  await expect(page.getByLabel("Recipient")).toHaveValue(
    Buffer.from(secondBobContact.fingerprint).toString("hex"),
  );
});
