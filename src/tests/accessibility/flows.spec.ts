import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import {
  createPublicContactV2,
  encodePublicContactV2Text,
} from "../../protocol/ppxc-v2";
import { importSessionIdentity } from "../e2e/helpers";

for (const route of [
  "contacts",
  "encrypt",
  "decrypt",
  "help",
  "settings",
] as const) {
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
    const bob = await deriveIdentityV2FromEntropy(
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
      .fill(encodePublicContactV2Text(createPublicContactV2(bob, "Bob", 2n)));
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
