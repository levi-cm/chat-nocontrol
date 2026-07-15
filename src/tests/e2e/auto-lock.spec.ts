import { expect, test } from "@playwright/test";
import { completeRecoveryConfirmation } from "./helpers";

test("idle identity locks predictably", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Username").fill("Idle Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();
  await completeRecoveryConfirmation(page);
  await page.getByRole("radio", { name: /No, use session only/u }).check();
  await page.getByRole("button", { name: "Finish identity setup" }).click();
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
  await page.getByLabel("Username").fill("Pending Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();
  await expect(
    page.getByLabel("Browser-vault password", { exact: true }),
  ).toBeVisible();

  await page.clock.fastForward("15:00");

  await expect(
    page.getByRole("button", { name: "Create new identity" }),
  ).toBeVisible();
  await expect(page.locator(".word-grid li")).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "Private recovery QR code" }),
  ).toHaveCount(0);
});

test("idle lock remembers the route active when the timer expires", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  test.slow();
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Username").fill("Idle Route Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();
  await completeRecoveryConfirmation(
    page,
    "en",
    "idle route restore passphrase",
  );
  await page.getByRole("button", { name: "Finish identity setup" }).click();
  await page.getByRole("link", { name: "Decrypt" }).click();

  await page.clock.fastForward("15:00");
  await page.getByRole("link", { name: "Identity" }).click();
  await page
    .getByLabel("Vault passphrase")
    .fill("idle route restore passphrase");
  await page.getByRole("button", { name: "Unlock identity" }).click();

  await expect(page).toHaveURL(/#\/decrypt$/u, { timeout: 15_000 });
});
