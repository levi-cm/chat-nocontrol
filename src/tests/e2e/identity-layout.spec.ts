import { expect, test } from "@playwright/test";

test("identity route uses a wider adaptive desktop workspace", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/#/identity");

  const workspace = page.locator("main.identity-workspace");
  await expect(workspace).toBeVisible();
  const width = await workspace.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  expect(width).toBeGreaterThanOrEqual(1180);
  await expect(page.locator("html")).not.toHaveCSS("overflow-x", "scroll");
});

test("identity route remains single-column without horizontal overflow on mobile", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"));
  await page.goto("/#/identity");

  await expect(page.locator("main.identity-workspace")).toBeVisible();
  const geometry = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    layoutDisplay: getComputedStyle(
      document.querySelector<HTMLElement>(".identity-layout")!,
    ).display,
  }));
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.layoutDisplay).toBe("block");
});
