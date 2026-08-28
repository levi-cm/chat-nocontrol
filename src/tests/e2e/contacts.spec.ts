import { expect, test } from "@playwright/test";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { displayIdentityId } from "../../components/cards/contact-management-card";
import {
  createPublicContactV2,
  encodePublicContactV2Text,
} from "../../protocol/ppxc-v2";

test("contacts import, merge, collision warning, and delete", async ({
  page,
}) => {
  const firstIdentity = await deriveIdentityV2FromEntropy(
    new Uint8Array(32).fill(8),
    "Bob",
  );
  const secondIdentity = await deriveIdentityV2FromEntropy(
    new Uint8Array(32).fill(9),
    "Bob",
  );
  const first = encodePublicContactV2Text(
    createPublicContactV2(firstIdentity, "Bob", 1n),
  );
  const second = encodePublicContactV2Text(
    createPublicContactV2(secondIdentity, "Bob", 2n),
  );

  await page.goto("/");
  await page.getByRole("link", { name: "Contacts" }).click();
  await page.getByLabel("Public contact payload").fill(first);
  await page.getByLabel("Nickname").fill("Work Bob");
  await page.getByRole("button", { name: "Save public contact" }).click();
  await expect(page.getByText("Work Bob", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("link", { name: "Contacts" }).click();
  await expect(page.getByText("Work Bob", { exact: true })).toBeVisible();

  await page.getByLabel("Public contact payload").fill(first);
  await page.getByLabel("Nickname").fill("Updated Bob");
  await page.getByRole("button", { name: "Save public contact" }).click();
  await expect(page.getByText(/entry was merged/u)).toBeVisible();
  await expect(page.getByText("Updated Bob", { exact: true })).toBeVisible();

  await page.getByLabel("Public contact payload").fill(second);
  await page.getByRole("button", { name: "Save public contact" }).click();
  await expect(page.getByText("Same pseudonym, different key")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Delete contact/u }),
  ).toHaveCount(2);
  const deleteNames = await page
    .getByRole("button", { name: /Delete contact/u })
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label") ?? ""),
    );
  expect(new Set(deleteNames).size).toBe(2);
  expect(deleteNames.join(" ")).toContain(
    displayIdentityId(
      createPublicContactV2(firstIdentity, "Bob", 1n).identityId,
    ),
  );
  expect(deleteNames.join(" ")).toContain(
    displayIdentityId(
      createPublicContactV2(secondIdentity, "Bob", 2n).identityId,
    ),
  );
  await page
    .getByRole("button", { name: /Delete contact/u })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Delete contact?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("button", { name: /Delete contact/u }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: /Delete contact/u })
    .first()
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Delete contact/u }),
  ).toHaveCount(1);

  await page.reload();
  await page.getByRole("link", { name: "Contacts" }).click();
  await expect(
    page.getByRole("button", { name: /Delete contact/u }),
  ).toHaveCount(1);
});
