import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import {
  createPublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import { importSessionIdentity } from "../e2e/helpers";

for (const route of ["contacts", "encrypt", "decrypt", "help"] as const) {
  test(`${route} route has no detectable WCAG A/AA violations`, async ({
    page,
  }) => {
    await page.goto(`/#/${route}`);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

for (const route of ["encrypt", "decrypt"] as const) {
  test(`unlocked ${route} file controls have no detectable WCAG A/AA violations`, async ({
    page,
  }) => {
    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(2),
      "Bob",
    );
    await page.goto("/");
    await importSessionIdentity(page, {
      entropy: new Uint8Array(32),
      pseudonym: "Alice",
    });
    await page.getByRole("link", { name: "Contacts" }).click();
    await page
      .getByLabel("Public contact payload")
      .fill(encodePublicContactQr(createPublicContact(bob, "Bob", 2n)));
    await page.getByRole("button", { name: "Save public contact" }).click();
    await page
      .getByRole("link", { name: route === "encrypt" ? "Encrypt" : "Decrypt" })
      .click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
