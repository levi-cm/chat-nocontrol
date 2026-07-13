import { expect, test } from "@playwright/test";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { lockVault } from "../../crypto/vault";
import { encodeRecoveryObject } from "../../protocol/ppxr";
import { encodeLockedVault } from "../../protocol/ppxv";
import { parsePublicContact } from "../../protocol/ppxc";
import { readFile } from "node:fs/promises";

test("validates the new public pseudonym for every import source", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import identity" }).click();
  await page.getByLabel("Pseudonym").fill("x".repeat(49));
  await expect(
    page.getByText(
      "Enter a pseudonym between 1 and 48 UTF-8 bytes after normalization.",
    ),
  ).toBeVisible();
  await page
    .getByLabel("24 recovery words")
    .fill(`${"abandon ".repeat(23)}art`);
  await expect(
    page.getByRole("button", { name: "Import recovery words" }),
  ).toBeDisabled();
});

test("imports a 24-word identity with a new public pseudonym", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import identity" }).click();
  await page.getByLabel("Pseudonym").fill("Recovered Alice");
  await page
    .getByLabel("24 recovery words")
    .fill(`${"abandon ".repeat(23)}art`);
  await page.getByRole("button", { name: "Import recovery words" }).click();
  await page.getByRole("button", { name: "No, use session only" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u);
  await page.getByRole("link", { name: "Identity" }).click();
  await expect(
    page.getByRole("heading", { name: "Public contact" }),
  ).toBeVisible();
  await expect(
    page.getByText("Recovered Alice", { exact: true }),
  ).toBeVisible();
});

test("imports a PPXR file with its signed pseudonym and creation time", async ({
  page,
}) => {
  const bytes = encodeRecoveryObject({
    magic: "PPXR",
    formatVersion: 1,
    suite: 1,
    flags: 0,
    masterEntropy: new Uint8Array(32).fill(6),
    creationTime: 1n,
    pseudonym: "Old label",
    checksum: new Uint8Array(16),
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Import identity" }).click();
  await page.getByLabel("Private recovery file").setInputFiles({
    name: "recovery.ppxrecovery",
    mimeType: "application/x-ppx-recovery",
    buffer: Buffer.from(bytes),
  });
  await expect(
    page.getByText(
      "This recovery material is unencrypted. Anyone who gets it can recover your private identity.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Import private file" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Do you want to remember this identity on this device?",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "No, use session only" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u);
  await page.getByRole("link", { name: "Identity" }).click();
  await expect(page.getByText("Old label", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Verify this fingerprint through a trusted channel when authenticity matters.",
    ),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download public contact" }).click();
  const downloaded = await download;
  const path = await downloaded.path();
  expect(path).not.toBeNull();
  const contact = parsePublicContact(new Uint8Array(await readFile(path)));
  expect(contact.creationTime).toBe(1n);
});

test("imports a locked PPXV vault with generic failure", async ({ page }) => {
  const identity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(8),
    "Old vault label",
  );
  const bytes = encodeLockedVault(
    await lockVault({
      identity,
      passphrase: "correct horse battery staple",
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Import identity" }).click();
  await page.getByLabel("Private recovery file").setInputFiles({
    name: "identity.ppxvault",
    mimeType: "application/x-ppx-vault",
    buffer: Buffer.from(bytes),
  });
  await page.getByLabel("Vault passphrase").fill("wrong passphrase");
  await page.getByRole("button", { name: "Import private file" }).click();
  await expect(page.getByText("Could not import this identity")).toBeVisible();
  await page
    .getByLabel("Vault passphrase")
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Import private file" }).click();
  await page.getByRole("button", { name: "No, use session only" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u);
  await page.getByRole("link", { name: "Identity" }).click();
  await expect(
    page.getByText("Old vault label", { exact: true }),
  ).toBeVisible();
});
