import { expect, test } from "@playwright/test";

test("all main routes reflow without horizontal overflow", async ({ page }) => {
  for (const route of ["identity", "contacts", "encrypt", "decrypt", "help"]) {
    await page.goto(`/#/${route}`);
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  }
});

test("device profile supports bounded PPXT gzip primitives", async ({
  page,
}) => {
  await page.goto("/");
  expect(
    await page.evaluate(() => {
      try {
        new CompressionStream("gzip");
        new DecompressionStream("gzip");
        return true;
      } catch {
        return false;
      }
    }),
  ).toBe(true);
});
