import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { completeRecoveryConfirmation } from "./helpers";

test("rejects invalid normalized usernames before key generation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Username").fill("x".repeat(49));
  await expect(
    page.getByText(
      "Enter a pseudonym between 1 and 48 UTF-8 bytes after normalization.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate identity" }),
  ).toBeDisabled();
});

test("creates, exports, verifies, and stores recovery material through seven screens", async ({
  page,
}, testInfo) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await expect(page.getByText("Step 1 of 7")).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "30",
  );
  await page.getByLabel("Username").fill("Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();

  await expect(page.getByText("Step 2 of 7")).toBeVisible();
  await page
    .getByLabel("Browser-vault password", { exact: true })
    .fill("Vault pass 123!");
  await page
    .getByLabel("Confirm browser-vault password")
    .fill("Vault pass 123!");
  await page.getByRole("button", { name: "Create encrypted vault" }).click();

  await expect(page.getByText("Step 3 of 7")).toBeVisible({ timeout: 15_000 });
  const qrDownloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save private QR as PNG" }).click();
  const qrDownload = await qrDownloadEvent;
  expect(qrDownload.suggestedFilename()).toMatch(
    /^chat-nocontrol-alice-recovery-\d{4}-\d{2}-\d{2}\.png$/u,
  );
  const qrPath = await qrDownload.path();
  expect(qrPath).not.toBeNull();
  const qrBytes = await readFile(qrPath);
  expect(qrBytes.readUInt32BE(16)).toBe(1024);
  expect(qrBytes.readUInt32BE(20)).toBe(1280);
  await page
    .getByRole("checkbox", { name: "I stored the private QR safely" })
    .check();

  const fileDownloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download .ppxrecovery file" })
    .click();
  const fileDownload = await fileDownloadEvent;
  const recoveryPath = await fileDownload.path();
  expect(recoveryPath).not.toBeNull();
  await page
    .getByRole("checkbox", {
      name: "I stored the .ppxrecovery file safely",
    })
    .check();
  await page
    .getByRole("button", { name: "Continue to recovery words" })
    .click();

  await expect(page.getByText("Step 4 of 7")).toBeVisible();
  const recoveryWords = await page.locator(".word-grid li").allTextContents();
  expect(recoveryWords).toHaveLength(24);
  const preview = page.getByTitle("Private recovery PDF preview");
  if (testInfo.project.name.startsWith("mobile")) {
    await expect(preview).toHaveCount(0);
    const recoveryPdfRegion = page.getByRole("region", {
      name: "Recovery PDF",
    });
    const [regionWidth, downloadWidth] = await Promise.all([
      recoveryPdfRegion.evaluate(
        (element) => element.getBoundingClientRect().width,
      ),
      page
        .getByRole("button", { name: "Download recovery PDF" })
        .evaluate((element) => element.getBoundingClientRect().width),
    ]);
    expect(downloadWidth).toBeGreaterThanOrEqual(regionWidth - 1);
  } else {
    await expect(preview).toBeVisible();
  }
  await expect(
    page.getByRole("link", { name: "Print / Save as PDF" }),
  ).toHaveCount(0);
  const pdfDownloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download recovery PDF" }).click();
  const pdfDownload = await pdfDownloadEvent;
  const pdfPath = await pdfDownload.path();
  expect(pdfPath).not.toBeNull();
  const pdfBytes = await readFile(pdfPath);
  expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect((await PDFDocument.load(pdfBytes)).getPageCount()).toBe(1);
  const continueRecovery = page.getByRole("button", {
    name: "Continue to restore practice",
  });
  await page
    .getByRole("checkbox", { name: "I wrote down all 24 words" })
    .check();
  await expect(continueRecovery).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "I safely stored the recovery PDF" })
    .check();
  await expect(continueRecovery).toBeEnabled();
  await page
    .getByRole("button", { name: "Continue to restore practice" })
    .click();

  await expect(page.getByText("Step 5 of 7")).toBeVisible();
  await expect(page.getByText("Vault pass 123!", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator(".word-grid li")).toHaveCount(0);
  await page.locator("#onboarding-recovery-qr-file").setInputFiles(qrPath);
  await expect(
    page.getByRole("button", { name: "Verify private QR recovery" }),
  ).toBeEnabled({ timeout: 45_000 });
  await page
    .getByRole("button", { name: "Verify private QR recovery" })
    .click();

  await expect(page.getByText("Step 6 of 7")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
  await page.locator("#practice-recovery-file").setInputFiles(recoveryPath);
  await page.getByRole("button", { name: "Verify .ppxrecovery file" }).click();
  const confirmations = page.locator(
    'input[id^="recovery-word-confirmation-"]',
  );
  await expect(confirmations).toHaveCount(4, { timeout: 15_000 });
  const requestedIds = await confirmations.evaluateAll((inputs) =>
    inputs.map((input) => input.id),
  );
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await page
      .getByRole("button", { name: "Verify four recovery words" })
      .click();
  }
  await expect(
    page.getByRole("button", { name: "Restart identity creation" }),
  ).toBeVisible();
  expect(
    await confirmations.evaluateAll((inputs) =>
      inputs.map((input) => input.id),
    ),
  ).toEqual(requestedIds);
  for (let index = 0; index < 4; index += 1) {
    const input = confirmations.nth(index);
    const id = await input.getAttribute("id");
    const position = Number(id?.split("-").at(-1));
    await input.fill(recoveryWords[position - 1] ?? "");
  }
  await page
    .getByRole("button", { name: "Verify four recovery words" })
    .click();

  await expect(page.getByText("Step 7 of 7")).toBeVisible();
  const remembered = page.getByRole("radio", {
    name: /Remember on this device \(recommended\)/u,
  });
  await expect(remembered).toBeChecked();
  await page.getByRole("radio", { name: /No, use session only/u }).check();
  await page.getByRole("button", { name: "Finish identity setup" }).click();

  await expect(page).toHaveURL(/#\/encrypt$/u);
  await page.getByRole("link", { name: "Identity" }).click();
  await expect(page.getByText("Alice", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Public contact QR code" }),
  ).toBeVisible();
});

test("unavailable IndexedDB visibly forces session-only completion", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Username").fill("No Storage Alice");
  await page.getByRole("button", { name: "Generate identity" }).click();
  await completeRecoveryConfirmation(page);

  await expect(
    page.getByText(
      "Storage is unavailable, so this session will not be remembered.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: /Remember on this device/u }),
  ).toBeDisabled();
  await expect(
    page.getByRole("radio", { name: /No, use session only/u }),
  ).toBeChecked();
});
