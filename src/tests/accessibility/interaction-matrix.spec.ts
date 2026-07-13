import { expect, test, type Locator, type Page } from "@playwright/test";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";
import {
  createPublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import { importSessionIdentity } from "../e2e/helpers";

async function activateWithKeyboard(locator: Locator): Promise<void> {
  await locator.focus();
  await expect(locator).toBeFocused();
  await locator.press("Enter");
}

async function importIdentityWithKeyboard(
  page: Page,
  input: { entropy: Uint8Array; pseudonym: string },
): Promise<void> {
  await activateWithKeyboard(
    page.getByRole("button", { name: "Import identity" }),
  );
  const pseudonym = page.getByLabel("Pseudonym");
  await pseudonym.focus();
  await page.keyboard.insertText(input.pseudonym);
  const recovery = page.getByLabel("24 recovery words");
  await recovery.focus();
  await page.keyboard.insertText(
    createRecoveryWordCodec().entropyToRecoveryWords(input.entropy).join(" "),
  );
  await activateWithKeyboard(
    page.getByRole("button", { name: "Import recovery words" }),
  );
  await activateWithKeyboard(
    page.getByRole("button", { name: "No, use session only" }),
  );
  await expect(page.getByRole("button", { name: "Lock now" })).toBeVisible();
}

test("reduced motion removes nonessential transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page
    .getByRole("link", { name: "Encrypt" })
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  const durations = duration
    .split(", ")
    .map((value) => Number.parseFloat(value));
  expect(durations.every((value) => value <= 0.00001)).toBe(true);
});

test("high-reflow viewport keeps critical actions reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/#/help");
  await page.getByLabel("Language").selectOption("de");
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  const diagnostics = page.getByRole("button", {
    name: "Problem melden",
  });
  await diagnostics.focus();
  await expect(diagnostics).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Diagnosebericht zur Prüfung")).toBeVisible();
});

test("primary actions meet practical touch target height", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const link of await page.locator(".nav-link").all()) {
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  const create = page.getByRole("button", { name: "Create new identity" });
  expect((await create.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test("unlocked mobile topbar keeps every action inside its header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await importSessionIdentity(page, {
    entropy: new Uint8Array(32),
    pseudonym: "Alice",
  });
  const headerBox = await page.locator(".topbar").boundingBox();
  const lockBox = await page
    .getByRole("button", { name: "Lock now" })
    .boundingBox();
  const localeBox = await page.getByLabel("Language").boundingBox();
  expect(headerBox).not.toBeNull();
  for (const box of [lockBox, localeBox]) {
    expect(box).not.toBeNull();
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(headerBox?.y ?? 0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
      (headerBox?.y ?? 0) + (headerBox?.height ?? 0),
    );
  }
});

test("identity creation is keyboard complete through recovery guard", async ({
  page,
}) => {
  await page.goto("/");
  const create = page.getByRole("button", { name: "Create new identity" });
  await create.focus();
  await page.keyboard.press("Enter");
  const pseudonym = page.getByLabel("Pseudonym");
  await pseudonym.focus();
  await page.keyboard.type("Keyboard Alice");
  const generate = page.getByRole("button", { name: "Generate identity" });
  await generate.focus();
  await page.keyboard.press("Enter");

  const words = await page.locator(".word-grid li").allTextContents();
  const downloadEvent = page.waitForEvent("download");
  const download = page.getByRole("button", {
    name: "Press and hold to export private recovery card",
  });
  await download.focus();
  await page.keyboard.press("Enter");
  await downloadEvent;
  const phrase = page.getByLabel("Type EXPORT PRIVATE to continue");
  await phrase.focus();
  await page.keyboard.type("EXPORT PRIVATE");
  const confirmations = page.locator(
    'input[id^="recovery-word-confirmation-"]',
  );
  for (let index = 0; index < (await confirmations.count()); index += 1) {
    const input = confirmations.nth(index);
    const id = await input.getAttribute("id");
    const position = Number(id?.split("-").at(-1));
    await input.focus();
    await page.keyboard.type(words[position - 1] ?? "");
  }
  const confirm = page.getByRole("button", {
    name: "Confirm recovery saved",
  });
  await confirm.focus();
  await page.keyboard.press("Enter");
  const sessionOnly = page.getByRole("button", {
    name: "No, use session only",
  });
  await sessionOnly.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Lock now" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Encrypt" })).toBeVisible();
});

test("keyboard-only identity import, contact import, encrypt, decrypt, save, and delete flow", async ({
  page,
}) => {
  const aliceEntropy = new Uint8Array(32);
  const bobEntropy = new Uint8Array(32).fill(2);
  const bobIdentity = await deriveIdentityFromEntropy(bobEntropy, "Bob");
  const bobPayload = encodePublicContactQr(
    createPublicContact(bobIdentity, "Bob", 2n),
  );

  await page.goto("/");
  await importIdentityWithKeyboard(page, {
    entropy: aliceEntropy,
    pseudonym: "Alice",
  });

  await activateWithKeyboard(page.getByRole("link", { name: "Contacts" }));
  const contactPayload = page.getByLabel("Public contact payload");
  await contactPayload.focus();
  await page.keyboard.insertText(bobPayload);
  await activateWithKeyboard(
    page.getByRole("button", { name: "Save public contact" }),
  );
  await expect(page.getByText("Bob", { exact: true })).toBeVisible();

  await activateWithKeyboard(page.getByRole("link", { name: "Encrypt" }));
  const recipient = page.getByLabel("Recipient");
  await recipient.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(recipient).not.toHaveValue("");
  const plaintext = page.getByLabel("Encrypted text");
  await plaintext.focus();
  await page.keyboard.insertText("Keyboard-only local round trip");
  await activateWithKeyboard(
    page.getByRole("button", { name: "Encrypt", exact: true }),
  );
  const encryptedOutput = page.getByLabel("Encrypted output");
  await expect(encryptedOutput).toHaveValue(/BEGIN PPX ENCRYPTED TEXT/u);
  const armor = await encryptedOutput.inputValue();

  await activateWithKeyboard(page.getByRole("button", { name: "Lock now" }));
  await activateWithKeyboard(page.getByRole("link", { name: "Identity" }));
  await importIdentityWithKeyboard(page, {
    entropy: bobEntropy,
    pseudonym: "Bob",
  });

  await activateWithKeyboard(page.getByRole("link", { name: "Decrypt" }));
  const encryptedInput = page.getByLabel("Encrypted item");
  await encryptedInput.focus();
  await page.keyboard.insertText(armor);
  await activateWithKeyboard(
    page.getByRole("button", { name: "Decrypt locally" }),
  );
  await expect(
    page.getByText("Keyboard-only local round trip", { exact: true }),
  ).toBeVisible();
  await activateWithKeyboard(
    page.getByRole("button", { name: "Save contact" }),
  );

  await activateWithKeyboard(page.getByRole("link", { name: "Contacts" }));
  const deleteAlice = page.getByRole("button", {
    name: /Delete contact Alice/u,
  });
  await activateWithKeyboard(deleteAlice);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  const confirmDelete = page.getByRole("button", {
    name: "Delete",
    exact: true,
  });
  await expect(confirmDelete).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(deleteAlice).toHaveCount(0);
});

test("mobile recovery export remains fully inside its scroll viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Create new identity" }).click();
  await page.getByLabel("Pseudonym").fill("Recovery Visual");
  await page.getByRole("button", { name: "Generate identity" }).click();
  await expect(
    page.getByRole("img", { name: "Private recovery QR code" }),
  ).toBeVisible();
  const dimensions = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>(".workspace");
    const card = document.querySelector<HTMLElement>(".private-card");
    if (!workspace || !card) throw new Error("recovery layout missing");
    const workspaceBox = workspace.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    return {
      workspaceClient: workspace.clientWidth,
      workspaceScroll: workspace.scrollWidth,
      cardLeft: cardBox.left,
      cardRight: cardBox.right,
      visibleLeft: workspaceBox.left,
      visibleRight: workspaceBox.right,
      overflowers: [...workspace.querySelectorAll<HTMLElement>("*")]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return (
            element.scrollWidth > element.clientWidth + 1 ||
            box.right > workspaceBox.right + 1 ||
            box.left < workspaceBox.left - 1
          );
        })
        .slice(0, 12)
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          client: element.clientWidth,
          scroll: element.scrollWidth,
          left: element.getBoundingClientRect().left,
          right: element.getBoundingClientRect().right,
        })),
    };
  });
  expect(
    dimensions.workspaceScroll,
    JSON.stringify(dimensions.overflowers),
  ).toBeLessThanOrEqual(dimensions.workspaceClient);
  expect(dimensions.cardLeft).toBeGreaterThanOrEqual(dimensions.visibleLeft);
  expect(dimensions.cardRight).toBeLessThanOrEqual(dimensions.visibleRight);
});
