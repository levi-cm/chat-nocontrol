import { expect, test } from "@playwright/test";

test("does not show an update prompt", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("ppx-update-available"));
  });

  await expect(page.getByText("A newer version is available.")).toHaveCount(0);
});
