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

test("supported browser exposes exact gzip streams off the UI workflow", async ({
  page,
}) => {
  await page.goto("/");
  const support = await page.evaluate(() => {
    try {
      return {
        compression:
          new CompressionStream("gzip").readable instanceof ReadableStream,
        decompression:
          new DecompressionStream("gzip").readable instanceof ReadableStream,
      };
    } catch {
      return { compression: false, decompression: false };
    }
  });
  expect(support).toEqual({ compression: true, decompression: true });
});
