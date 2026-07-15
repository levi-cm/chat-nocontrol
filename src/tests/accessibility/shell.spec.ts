import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const locale of ["en", "de"] as const) {
  test(`identity shell has no detectable WCAG A/AA violations in ${locale}`, async ({
    page,
  }) => {
    await page.goto("/");
    if (locale === "de") {
      await page.getByRole("link", { name: "Open settings" }).click();
      await page.getByLabel("Language").selectOption("de");
      await page.getByRole("link", { name: "Chat NoControl" }).click();
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
