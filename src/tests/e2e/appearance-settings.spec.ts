import { expect, test } from "@playwright/test";

test("appearance settings apply and persist theme, accent, and glass preference", async ({
  page,
}) => {
  await page.goto("/#/settings");
  await page.getByLabel("Theme").selectOption("dark");
  await page.getByLabel("Accent color").selectOption("purple");
  await page
    .getByRole("checkbox", { name: /Translucent interface effects/u })
    .uncheck();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#0e1118",
  );
  await expect(page.locator("html")).toHaveAttribute("data-accent", "purple");
  await expect(page.locator("html")).toHaveAttribute(
    "data-translucency",
    "off",
  );
  await expect
    .poll(() =>
      page.locator(".topbar").evaluate((element) => {
        const style = getComputedStyle(element);
        return style.backdropFilter;
      }),
    )
    .toBe("none");

  await page.reload();
  await expect(page.getByLabel("Theme")).toHaveValue("dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#0e1118",
  );
  await expect(page.getByLabel("Accent color")).toHaveValue("purple");
  await expect(
    page.getByRole("checkbox", { name: /Translucent interface effects/u }),
  ).not.toBeChecked();
});

test("Paste reads the clipboard only after the user activates the button", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: () => {
          localStorage.setItem("test-clipboard-read", "yes");
          return Promise.resolve("PPX1:CONTACT:ABC");
        },
      },
    });
  });
  await page.goto("/#/contacts");
  await expect(page.getByLabel("Public contact payload")).toHaveValue("");
  expect(
    await page.evaluate(() => localStorage.getItem("test-clipboard-read")),
  ).toBeNull();
  await page.getByRole("button", { name: "Paste" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("test-clipboard-read")),
  ).toBe("yes");
  await expect(page.getByLabel("Public contact payload")).toHaveValue(
    "PPX1:CONTACT:ABC",
  );
});

test("mobile primary navigation is icon-only but keeps accessible names", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"));
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Encrypt" })).toBeVisible();
  const labelBox = await page
    .getByRole("link", { name: "Encrypt" })
    .locator("span:last-child")
    .boundingBox();
  expect(labelBox?.width ?? 0).toBeLessThanOrEqual(1);
  await expect(page.locator(".nav-link .nav-icon svg")).toHaveCount(5);
});

test("mobile safe-area space stays outside centered control rows", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"));
  await page.goto("/");

  const geometry = async () =>
    page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>(".primary-nav");
      const navLink = document.querySelector<HTMLElement>(".nav-link");
      const topbar = document.querySelector<HTMLElement>(".topbar");
      const brand = document.querySelector<HTMLElement>(".brand");
      const settings = document.querySelector<HTMLElement>(".icon-button");
      if (!nav || !navLink || !topbar || !brand || !settings) {
        throw new Error("Missing shell controls");
      }
      const box = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          center: rect.top + rect.height / 2,
        };
      };
      return {
        nav: box(nav),
        navLink: box(navLink),
        topbar: box(topbar),
        brand: box(brand),
        settings: box(settings),
      };
    });

  const before = await geometry();
  await page.locator("html").evaluate((element) => {
    const root = element as HTMLElement;
    root.style.setProperty("--safe-area-top", "28px");
    root.style.setProperty("--safe-area-bottom", "34px");
  });
  const after = await geometry();

  expect(after.nav.height).toBeCloseTo(before.nav.height, 1);
  expect(after.nav.bottom).toBeCloseTo(before.nav.bottom - 34, 1);
  expect(after.navLink.center).toBeCloseTo(after.nav.center, 1);
  expect(after.topbar.height).toBeCloseTo(before.topbar.height + 28, 1);
  const topbarControlCenter =
    after.topbar.top + 28 + (after.topbar.height - 28) / 2;
  expect(
    Math.abs(after.brand.center - topbarControlCenter),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(after.settings.center - topbarControlCenter),
  ).toBeLessThanOrEqual(1);
});
