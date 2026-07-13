import { expect, test } from "@playwright/test";
import { completeRecoveryConfirmation } from "./helpers";

test("idle identity locks predictably", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Pseudonym").fill("Idle Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();
  await completeRecoveryConfirmation(page);
  await page.getByRole("button", { name: "No, use session only" }).click();
  await expect(page.getByRole("button", { name: "Lock now" })).toBeVisible();
  await page.getByRole("link", { name: "Identity" }).click();
  await expect(page.getByText("Idle Alice", { exact: true })).toBeVisible();

  await page.clock.fastForward("15:00");

  await expect(
    page.getByRole("button", { name: "Create new identity" }),
  ).toBeVisible();
  await expect(page.getByText("Idle Alice", { exact: true })).toHaveCount(0);
});

test("unfinished recovery setup auto-locks and removes private material", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Pseudonym").fill("Pending Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();
  await expect(page.locator(".word-grid li")).toHaveCount(24);

  await page.clock.fastForward("15:00");

  await expect(
    page.getByRole("button", { name: "Create new identity" }),
  ).toBeVisible();
  await expect(page.locator(".word-grid li")).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "Private recovery QR code" }),
  ).toHaveCount(0);
});
