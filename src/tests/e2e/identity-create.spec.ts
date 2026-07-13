import { expect, test } from "@playwright/test";
import { completeRecoveryConfirmation } from "./helpers";

test("rejects invalid normalized pseudonyms before key generation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Pseudonym").fill("x".repeat(49));
  await expect(
    page.getByText(
      "Enter a pseudonym between 1 and 48 UTF-8 bytes after normalization.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate identity" }),
  ).toBeDisabled();
});

test("identity setup requires recovery export before completion", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Pseudonym").fill("Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();

  await expect(
    page.getByRole("heading", { name: "Private recovery card" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This card is dangerous. Anyone who gets it can recover your private identity. Do not share it.",
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("Type EXPORT PRIVATE to continue"),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Press and hold to export private recovery card",
    })
    .click();
  await expect(
    page.getByLabel("Type EXPORT PRIVATE to continue"),
  ).toBeDisabled();

  const exportAction = page.getByRole("button", {
    name: "Press and hold to export private recovery card",
  });
  const box = await exportAction.boundingBox();
  expect(box).not.toBeNull();
  const exportDownload = page.waitForEvent("download");
  await page.mouse.move((box?.x ?? 0) + 10, (box?.y ?? 0) + 10);
  await page.mouse.down();
  await page.waitForTimeout(850);
  await page.mouse.up();
  await exportDownload;
  await expect(
    page.getByLabel("Type EXPORT PRIVATE to continue"),
  ).toBeEnabled();

  await completeRecoveryConfirmation(page);

  await page.getByRole("button", { name: "No, use session only" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u);
  await page.getByRole("link", { name: "Identity" }).click();
  await expect(
    page.getByRole("heading", { name: "Public contact" }),
  ).toBeVisible();
  await expect(page.getByText("Alice", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Public contact QR code" }),
  ).toBeVisible();
  const contactDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download public contact" }).click();
  expect((await contactDownload).suggestedFilename()).toBe(
    "chat-nocontrol-Alice.ppxcontact",
  );
});
