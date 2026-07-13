import { expect, test } from "@playwright/test";

test("diagnostics stay local until reviewed", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await page.getByRole("link", { name: "Help" }).click();
  await expect(
    page.getByText("Version 1 has no forward secrecy."),
  ).toBeVisible();
  await page
    .getByRole("heading", {
      name: "Dedicated chat-control explainer",
      exact: true,
    })
    .click();
  await expect(page.getByText(/opposes generalized scanning/u)).toBeVisible();
  await page.getByText("View source and build info").click();
  await expect(page.getByText(/static local-first build/iu)).toBeVisible();
  await page.getByRole("button", { name: "Report a problem" }).click();
  await expect(page.getByLabel("Diagnostics report for review")).toHaveValue(
    /Chat NoControl/u,
  );
  const issueDraft = page.getByRole("link", {
    name: "Open reviewed issue draft",
  });
  await expect(issueDraft).toBeVisible();
  await expect(issueDraft).toHaveAttribute(
    "href",
    /^https:\/\/github\.com\/levi-cm\/chat-nocontrol\/issues\/new\?/u,
  );
  expect(requests.some((url) => url.includes("github.com"))).toBe(false);
});
