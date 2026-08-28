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

  const layout = page.locator("main.identity-workspace .identity-layout");
  await expect(layout).toBeVisible();
  const geometry = await layout.evaluate((element) => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    layoutDisplay: getComputedStyle(element).display,
  }));
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.layoutDisplay).toBe("block");
});
