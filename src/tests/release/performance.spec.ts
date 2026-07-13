import { expect, test } from "@playwright/test";

test("static shell loads promptly with no remote dependency", async ({
  page,
}) => {
  const started = Date.now();
  await page.goto("/");
  await page
    .getByRole("heading", { name: "Create identity or import identity" })
    .waitFor();
  expect(Date.now() - started).toBeLessThan(5_000);
  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => entry.name),
  );
  const hostname = new URL(page.url()).hostname;
  expect(resources.every((url) => new URL(url).hostname === hostname)).toBe(
    true,
  );
});
