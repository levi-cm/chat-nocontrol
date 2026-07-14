import { expect, test } from "@playwright/test";
import { completeRecoveryConfirmation } from "./helpers";

test("remembered vault survives reload but requires passphrase", async ({
  page,
}) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Username").fill("Remembered Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();

  await completeRecoveryConfirmation(page);
  await page.getByRole("button", { name: "Finish identity setup" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u, { timeout: 15_000 });
  const persistedVault = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const request = indexedDB.open("chat-nocontrol-ppx");
        request.onerror = () =>
          reject(request.error ?? new Error("Could not open test database"));
        request.onsuccess = () => {
          const database = request.result;
          const get = database
            .transaction("vaults", "readonly")
            .objectStore("vaults")
            .get("active");
          get.onerror = () =>
            reject(get.error ?? new Error("Could not read test vault"));
          get.onsuccess = () => {
            resolve(JSON.stringify(get.result));
            database.close();
          };
        };
      }),
  );
  expect(persistedVault).not.toContain("correct horse battery staple");
  expect(page.url()).not.toContain("correct%20horse");
  await page.getByRole("link", { name: "Identity" }).click();
  await expect(
    page.getByText("Remembered Alice", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Encrypted private identity vault QR code",
    }),
  ).toBeVisible();
  const contactQrDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save contact QR as PNG" }).click();
  expect((await contactQrDownload).suggestedFilename()).toBe(
    "chat-nocontrol-Remembered-Alice-contact-qr.png",
  );
  const vaultQrDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save private vault QR as PNG" })
    .click();
  expect((await vaultQrDownload).suggestedFilename()).toBe(
    "chat-nocontrol-private-vault-qr.png",
  );
  const vaultDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download encrypted vault" }).click();
  expect((await vaultDownload).suggestedFilename()).toBe(
    "chat-nocontrol-private.ppxvault",
  );

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Unlock remembered identity" }),
  ).toBeVisible();
  await expect(page.getByText("Remembered Alice", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Vault passphrase").fill("wrong passphrase here");
  await page.getByRole("button", { name: "Unlock identity" }).click();
  await expect(page).toHaveURL(/#\/identity$/u);
  await expect(page.getByRole("alert")).toContainText("Could not unlock", {
    timeout: 15_000,
  });
  await page
    .getByLabel("Vault passphrase")
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Unlock identity" }).click();
  await expect(page).toHaveURL(/#\/identity$/u, { timeout: 15_000 });
  await expect(
    page.getByText("Remembered Alice", { exact: true }),
  ).toBeVisible();
});

test("pasting a remembered-vault passphrase on mobile stays on Identity", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"));
  test.slow();
  const passphrase = "mobile paste unlock passphrase";
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Username").fill("Mobile Paste Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();
  await completeRecoveryConfirmation(page, "en", passphrase);
  await page.getByRole("button", { name: "Finish identity setup" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u, { timeout: 15_000 });
  await page.getByRole("link", { name: "Identity" }).click();
  await page.reload();
  const input = page.getByLabel("Vault passphrase");
  await expect(input).toBeVisible();
  await input.evaluate((element, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", value);
    element.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, clipboardData }),
    );
  }, passphrase);
  await expect(page).toHaveURL(/#\/identity$/u, { timeout: 15_000 });
});

test("a weak four-digit passphrase remains saveable and visibly weak", async ({
  page,
}) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Username").fill("Simple Vault Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();
  await page.getByLabel("Browser-vault password", { exact: true }).fill("1234");
  await page.getByLabel("Confirm browser-vault password").fill("1234");
  await expect(page.locator(".passphrase-meter.weak")).toContainText(
    /Estimated strength: \d+ bits.*Weak/u,
  );
  await expect(
    page.getByRole("button", { name: "Create encrypted vault" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Create encrypted vault" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Use a weak browser-vault password?",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Change password" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByLabel("Browser-vault password", { exact: true }),
  ).toBeFocused();
  await completeRecoveryConfirmation(page, "en", "1234");
  await page.getByRole("button", { name: "Finish identity setup" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u, { timeout: 15_000 });
});

test("remembering can be re-enabled after a session-only identity", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Username").fill("Temporary Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();
  await completeRecoveryConfirmation(page);
  await page.getByRole("radio", { name: /No, use session only/u }).check();
  await page.getByRole("button", { name: "Finish identity setup" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u, { timeout: 15_000 });

  await page.getByRole("button", { name: "Lock now" }).click();
  await page.getByRole("link", { name: "Identity" }).click();
  await expect(
    page.getByRole("heading", { name: "Create identity or import identity" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Username").fill("Persistent Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();
  await completeRecoveryConfirmation(page);
  await expect(
    page.getByRole("radio", { name: /Remember on this device/u }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Finish identity setup" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u, { timeout: 15_000 });
  await page.reload();
  await page.getByRole("link", { name: "Identity" }).click();
  await expect(
    page.getByRole("heading", { name: "Unlock remembered identity" }),
  ).toBeVisible();
});
