import { expect, test } from "@playwright/test";
import { completeRecoveryConfirmation } from "./helpers";

test("remembered vault survives reload but requires passphrase", async ({
  page,
}) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Pseudonym").fill("Remembered Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();

  await completeRecoveryConfirmation(page);
  await page
    .getByRole("button", { name: "Yes, create an encrypted local vault" })
    .click();
  await page
    .getByLabel("Vault passphrase")
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Save encrypted vault" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u, { timeout: 15_000 });
  await page.getByRole("link", { name: "Identity" }).click();
  await expect(
    page.getByText("Remembered Alice", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Encrypted private identity vault QR code",
    }),
  ).toBeVisible();
  const vaultDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download encrypted vault" }).click();
  expect((await vaultDownload).suggestedFilename()).toBe(
    "chat-nocontrol-private.ppxvault",
  );

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Unlock remembered identity" }),
  ).toBeVisible();
  await expect(page.getByText("Remembered Alice", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Vault passphrase").fill("wrong passphrase here");
  await page.getByRole("button", { name: "Unlock identity" }).click();
  await expect(page).toHaveURL(/#\/identity$/u);
  await expect(page.getByRole("alert")).toContainText("Could not unlock", {
    timeout: 15_000,
  });
  await page
    .getByLabel("Vault passphrase")
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Unlock identity" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u, { timeout: 15_000 });
  await page.getByRole("link", { name: "Identity" }).click();
  await expect(
    page.getByText("Remembered Alice", { exact: true }),
  ).toBeVisible();
});
