import { expect, test } from "@playwright/test";

test("English and German shell routes without console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Create identity or import identity" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open settings" }).click();
  await page.getByLabel("Language").selectOption("de");
  await page.getByRole("link", { name: "Chat NoControl" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(
    page.getByRole("heading", { name: "Identität erstellen oder importieren" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Hilfe" }).click();
  await expect(page).toHaveURL(/#\/help$/u);
  await expect(page.getByRole("heading", { name: "Hilfe" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("shell never overflows viewport horizontally", async ({ page }) => {
  await page.goto("/");
  const sizes = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width);
});
