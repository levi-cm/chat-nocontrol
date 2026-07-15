import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import {
  createPublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import { importSessionIdentity } from "../e2e/helpers";

const labels = {
  en: {
    contacts: "Contacts",
    contactPayload: "Public contact payload",
    saveContact: "Save public contact",
    encrypt: "Encrypt",
    recipient: "Recipient",
    file: "Encrypted file",
    fileMode: "File",
  },
  de: {
    contacts: "Kontakte",
    contactPayload: "Nutzlast des öffentlichen Kontakts",
    saveContact: "Öffentlichen Kontakt speichern",
    encrypt: "Verschlüsseln",
    recipient: "Empfänger",
    file: "Verschlüsselte Datei",
    fileMode: "Datei",
  },
} as const;

for (const locale of ["en", "de"] as const) {
  test(`final unlocked file UI passes visual, network, console, reflow, ARIA, and axe QA in ${locale}`, async ({
    page,
  }, testInfo) => {
    const projectSlug = testInfo.project.name.replace(/[^a-z0-9-]+/gu, "-");
    const evidenceDirectory = join(
      process.cwd(),
      "output/playwright/final-visual",
    );
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    const externalRequests: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => failedRequests.push(request.url()));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1") {
        externalRequests.push(url.href);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    await page.addInitScript(() => {
      const violations: Array<{
        blockedURI: string;
        violatedDirective: string;
        sourceFile: string;
      }> = [];
      Object.defineProperty(window, "__chatNoControlCspViolations", {
        configurable: false,
        value: violations,
      });
      document.addEventListener("securitypolicyviolation", (event) => {
        violations.push({
          blockedURI: event.blockedURI,
          violatedDirective: event.violatedDirective,
          sourceFile: event.sourceFile,
        });
      });
    });

    await mkdir(evidenceDirectory, { recursive: true });
    await page.goto("/");
    if (locale === "de") {
      await page.getByRole("link", { name: "Open settings" }).click();
      await page.getByLabel("Language").selectOption("de");
      await page.getByRole("link", { name: "Chat NoControl" }).click();
    }
    await page.waitForTimeout(100);
    const initialCspViolations = await page.evaluate(
      () =>
        (Reflect.get(window, "__chatNoControlCspViolations") ?? []) as Array<{
          blockedURI: string;
          violatedDirective: string;
          sourceFile: string;
        }>,
    );
    const appCspViolations = initialCspViolations.filter(
      ({ blockedURI }) =>
        !/^(?:chrome|moz|safari)-extension:/u.test(blockedURI),
    );
    const initialConsoleErrors = [...consoleErrors];
    await page.screenshot({
      path: join(evidenceDirectory, `${projectSlug}-${locale}-identity.png`),
      fullPage: true,
      caret: "initial",
    });
    await page.waitForTimeout(50);
    // WebKit's screenshot implementation injects CSP-blocked helper styles.
    // Startup errors were captured above; discard only that harness noise.
    consoleErrors.length = 0;

    const bob = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(2),
      "Bob",
    );
    await importSessionIdentity(page, {
      entropy: new Uint8Array(32),
      pseudonym: "Alice",
      locale,
    });
    await page.getByRole("link", { name: labels[locale].contacts }).click();
    await page
      .getByLabel(labels[locale].contactPayload)
      .fill(encodePublicContactQr(createPublicContact(bob, "Bob", 2n)));
    await page
      .getByRole("button", { name: labels[locale].saveContact })
      .click();
    await page.getByRole("link", { name: labels[locale].encrypt }).click();
    const recipient = page.getByLabel(labels[locale].recipient);
    const bobOption = recipient.locator("option").nth(1);
    await expect(bobOption).toContainText("Bob");
    await recipient.selectOption((await bobOption.getAttribute("value")) ?? "");
    await page
      .getByRole("button", { name: labels[locale].fileMode, exact: true })
      .click();
    await page.getByLabel(labels[locale].file).setInputFiles({
      name: "visual-check.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("local visual QA"),
    });

    const viewport = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    await page.waitForTimeout(100);
    const productConsoleErrors = [...initialConsoleErrors, ...consoleErrors];
    const productPageErrors = [...pageErrors];
    const productFailedRequests = [...failedRequests];
    const productExternalRequests = [...externalRequests];

    const workspace = page.locator(".workspace");
    await workspace.evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({
      path: join(
        evidenceDirectory,
        `${projectSlug}-${locale}-workspace-top.png`,
      ),
      caret: "initial",
    });
    await workspace.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await page.screenshot({
      path: join(
        evidenceDirectory,
        `${projectSlug}-${locale}-workspace-bottom.png`,
      ),
      caret: "initial",
    });
    await page.screenshot({
      path: join(evidenceDirectory, `${projectSlug}-${locale}-file-ui.png`),
      fullPage: true,
      caret: "initial",
    });

    const axeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    await writeFile(
      join(evidenceDirectory, `${projectSlug}-${locale}-aria.txt`),
      await page.locator("body").ariaSnapshot(),
      "utf8",
    );

    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await page.waitForTimeout(100);
    const zoomedViewport = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>(".workspace");
      const header = document.querySelector<HTMLElement>(".topbar");
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        workspaceClientWidth: workspace?.clientWidth ?? 0,
        workspaceScrollWidth: workspace?.scrollWidth ?? 0,
        headerClientWidth: header?.clientWidth ?? 0,
        headerScrollWidth: header?.scrollWidth ?? 0,
        clippedHeaderActions: header
          ? [...header.querySelectorAll<HTMLElement>("a, button, select")]
              .filter((element) => {
                const elementBox = element.getBoundingClientRect();
                const headerBox = header.getBoundingClientRect();
                return (
                  elementBox.left < headerBox.left - 1 ||
                  elementBox.right > headerBox.right + 1 ||
                  elementBox.top < headerBox.top - 1 ||
                  elementBox.bottom > headerBox.bottom + 1
                );
              })
              .map((element) => {
                const box = element.getBoundingClientRect();
                return {
                  tag: element.tagName,
                  text: element.textContent,
                  box: {
                    left: box.left,
                    right: box.right,
                    top: box.top,
                    bottom: box.bottom,
                    width: box.width,
                    height: box.height,
                  },
                };
              })
          : [],
        overflowers: workspace
          ? [...workspace.querySelectorAll<HTMLElement>("*")]
              .filter(
                (element) =>
                  element.scrollWidth > element.clientWidth + 1 ||
                  element.getBoundingClientRect().right >
                    workspace.getBoundingClientRect().right + 1,
              )
              .slice(0, 12)
              .map((element) => ({
                tag: element.tagName,
                className: element.className,
                text: element.textContent?.slice(0, 80),
                clientWidth: element.clientWidth,
                scrollWidth: element.scrollWidth,
                right: element.getBoundingClientRect().right,
              }))
          : [],
      };
    });
    await page.screenshot({
      path: join(evidenceDirectory, `${projectSlug}-${locale}-zoom-200.png`),
      caret: "initial",
    });

    expect(axeResults.violations).toEqual([]);
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
    expect(zoomedViewport.scrollWidth).toBeLessThanOrEqual(
      zoomedViewport.clientWidth,
    );
    expect(
      zoomedViewport.workspaceScrollWidth,
      JSON.stringify(zoomedViewport.overflowers),
    ).toBeLessThanOrEqual(zoomedViewport.workspaceClientWidth);
    expect(
      zoomedViewport.headerScrollWidth,
      JSON.stringify(zoomedViewport.clippedHeaderActions),
    ).toBeLessThanOrEqual(zoomedViewport.headerClientWidth);
    expect(zoomedViewport.clippedHeaderActions).toEqual([]);
    expect(productConsoleErrors).toEqual([]);
    expect(productPageErrors).toEqual([]);
    expect(productFailedRequests).toEqual([]);
    expect(productExternalRequests).toEqual([]);
    expect(appCspViolations).toEqual([]);
  });
}
