import { expect, test } from "@playwright/test";

test("shows an update recorded before the App effect subscribes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__PPX_UPDATE_AVAILABLE__", {
      configurable: true,
      writable: true,
      value: true,
    });
  });
  await page.goto("/");
  await expect(page.getByText("A newer version is available.")).toBeVisible();
});

test("shows a non-interrupting update banner", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("ppx-update-available")),
  );
  await expect(page.getByText("A newer version is available.")).toBeVisible();
  await page.getByRole("button", { name: "Review later" }).click();
  await expect(page.getByText("A newer version is available.")).toHaveCount(0);
});

test("defers update banner while private identity is unlocked", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import identity" }).click();
  await page.getByLabel("Pseudonym").fill("Alice");
  await page
    .getByLabel("24 recovery words")
    .fill(`${"abandon ".repeat(23)}art`);
  await page.getByRole("button", { name: "Import recovery words" }).click();
  await page.getByRole("button", { name: "No, use session only" }).click();

  await page.evaluate(() =>
    window.dispatchEvent(new Event("ppx-update-available")),
  );
  await expect(page.getByText("A newer version is available.")).toHaveCount(0);
  await page.getByRole("button", { name: "Lock now" }).click();
  await expect(page.getByText("A newer version is available.")).toBeVisible();
});
