import { expect, test, type Page } from "@playwright/test";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { encryptText } from "../../crypto/text";
import { encodeMessageLink } from "../../protocol/message-link";
import { createPublicContact } from "../../protocol/ppxc";
import {
  LEGACY_DEPLOY_COMMIT,
  startPwaUpgradeServer,
} from "./helpers/pwa-upgrade-server";

test.use({ trace: "off", screenshot: "off", video: "off" });

const CURRENT_VERSION = "0.2.0-beta.1";
const LEGACY_ONLY_CACHE_PATHS = [
  "/assets/index-CZw01I_i.js",
  "/assets/index-2QzZXGYg.css",
  "/assets/scan-worker-CEv5irOu.js",
  "/assets/file-worker-CXWEHcx3.js",
  "/assets/crypto-worker-MOUhQJlG.js",
] as const;

async function createCanonicalLegacyMessageHash(): Promise<string> {
  const sender = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(201),
    "PWA legacy sender",
  );
  const recipient = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(202),
    "PWA legacy recipient",
  );
  return new URL(
    encodeMessageLink(
      {
        kind: "ppxt",
        object: await encryptText({
          sender: createPublicContact(sender, "PWA legacy sender", 201n),
          senderSigningCapability: createSenderSigningCapability(sender),
          recipient: createPublicContact(
            recipient,
            "PWA legacy recipient",
            202n,
          ),
          plaintext: "PWA upgrade ciphertext must remain fragment-only",
          messageId: new Uint8Array(16).fill(203),
          sentAt: 204n,
          createdAt: 204n,
        }),
      },
      "https://fixture.invalid/",
    ),
  ).hash;
}

async function inspectFragmentPersistence(page: Page, token: string) {
  return page.evaluate(async (forbidden) => {
    const requestResult = <T>(request: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        request.addEventListener("success", () => resolve(request.result), {
          once: true,
        });
        request.addEventListener(
          "error",
          () => reject(request.error ?? new Error("IndexedDB request failed")),
          { once: true },
        );
      });
    const storageEntries = (storage: Storage) =>
      Array.from({ length: storage.length }, (_, index) => {
        const key = storage.key(index) ?? "";
        return `${key}=${storage.getItem(key) ?? ""}`;
      });
    const indexedDbEntries: string[] = [];
    for (const info of await indexedDB.databases()) {
      if (!info.name) continue;
      try {
        const database = await requestResult(indexedDB.open(info.name));
        try {
          for (const storeName of database.objectStoreNames) {
            const transaction = database.transaction(storeName, "readonly");
            const records = await requestResult(
              transaction.objectStore(storeName).getAll(),
            );
            indexedDbEntries.push(
              JSON.stringify(records, (_key, value: unknown) => {
                if (typeof value === "bigint") return value.toString();
                if (value instanceof ArrayBuffer)
                  return Array.from(new Uint8Array(value));
                if (ArrayBuffer.isView(value))
                  return Array.from(
                    new Uint8Array(
                      value.buffer,
                      value.byteOffset,
                      value.byteLength,
                    ),
                  );
                return value;
              }),
            );
          }
        } finally {
          database.close();
        }
      } catch (error) {
        indexedDbEntries.push(`inspection-error:${String(error)}`);
      }
    }
    const cacheNames = await caches.keys();
    const cacheUrls = (
      await Promise.all(
        cacheNames.map(async (name) =>
          (await (await caches.open(name)).keys()).map(
            (request) => request.url,
          ),
        ),
      )
    ).flat();
    const resourceUrls = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name);
    const inspected = [
      ...storageEntries(localStorage),
      ...storageEntries(sessionStorage),
      JSON.stringify(history.state),
      ...indexedDbEntries,
      ...cacheUrls,
      ...resourceUrls,
    ];
    return {
      cacheNames,
      cacheUrls,
      resourceUrls,
      hasForbiddenMaterial: inspected.some((value) =>
        value.includes(forbidden),
      ),
    };
  }, token);
}

test("forces deployed legacy PWA into CAT5 without a banner or reload loop", async ({
  browserName,
  context,
  page,
}) => {
  test.skip(browserName !== "chromium", "real lifecycle gate targets Chromium");
  test.setTimeout(90_000);
  const incomingHash = await createCanonicalLegacyMessageHash();
  const fragmentToken = incomingHash.slice("#/m/".length);
  expect(/^#\/m\/[A-Za-z0-9_-]+$/u.test(incomingHash)).toBe(true);
  const server = await startPwaUpgradeServer();
  let stopped = false;
  try {
    expect(server.legacyCommit).toBe(LEGACY_DEPLOY_COMMIT);
    await page.goto(`${server.origin}/`);
    await page.evaluate(async () => navigator.serviceWorker.ready);
    await page.reload();
    expect(
      await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    ).toBe(true);
    await expect(
      page.locator('script[src="./assets/index-CZw01I_i.js"]'),
    ).toHaveCount(1);
    await expect(page.getByText("A newer version is available.")).toHaveCount(
      0,
    );
    await page.evaluate((hash) => {
      history.replaceState(null, "", hash);
    }, incomingHash);
    await page.reload();
    await expect(
      page.locator('script[src="./assets/index-CZw01I_i.js"]'),
    ).toHaveCount(1);
    expect(
      await page.evaluate(
        () =>
          location.hash.startsWith("#/m/") &&
          /^[A-Za-z0-9_-]+$/u.test(location.hash.slice("#/m/".length)),
      ),
    ).toBe(true);

    const legacyPersistence = await inspectFragmentPersistence(
      page,
      fragmentToken,
    );
    expect(legacyPersistence.hasForbiddenMaterial).toBe(false);
    expect(
      legacyPersistence.cacheUrls.some(
        (url) => new URL(url).pathname === "/assets/index-CZw01I_i.js",
      ),
    ).toBe(true);
    expect(
      server.requests().some((request) => request.includes(fragmentToken)),
    ).toBe(false);

    server.serveCurrentBuild();
    await page.evaluate(() => {
      void navigator.serviceWorker.ready.then((registration) =>
        registration.update(),
      );
    });
    await expect(
      page.locator('script[src="./assets/index-CZw01I_i.js"]'),
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Open encrypted message" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Unlock, import, or create the recipient identity to decrypt this message.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(`${server.origin}/#/decrypt`);
    await expect(page.getByText("A newer version is available.")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Review later" }),
    ).toHaveCount(0);

    const cdp = await context.newCDPSession(page);
    const navigationHistory = await cdp.send("Page.getNavigationHistory");
    expect(
      navigationHistory.entries.some((entry) =>
        entry.url.includes(fragmentToken),
      ),
    ).toBe(false);
    await cdp.detach();

    const forcedDocumentTimeOrigin = await page.evaluate(
      () => performance.timeOrigin,
    );
    await page.waitForTimeout(1_000);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(
      forcedDocumentTimeOrigin,
    );

    const updatedPersistence = await inspectFragmentPersistence(
      page,
      fragmentToken,
    );
    expect(updatedPersistence.hasForbiddenMaterial).toBe(false);
    for (const oldPath of LEGACY_ONLY_CACHE_PATHS) {
      expect(
        updatedPersistence.cacheUrls.some(
          (url) => new URL(url).pathname === oldPath,
        ),
      ).toBe(false);
    }
    expect(
      updatedPersistence.cacheUrls.some((url) =>
        new URL(url).search.includes(
          "__WB_REVISION__=ac6b66ff77758c13f5a6d67f4872503a",
        ),
      ),
    ).toBe(false);
    expect(
      updatedPersistence.cacheUrls.some((url) =>
        /\/assets\/index-[A-Za-z0-9_-]+\.js$/u.test(new URL(url).pathname),
      ),
    ).toBe(true);
    expect(
      server.requests().some((request) => request.includes(fragmentToken)),
    ).toBe(false);

    const currentScript = await page
      .locator('script[type="module"]')
      .getAttribute("src");
    expect(currentScript).toMatch(/^\.\/assets\/index-[A-Za-z0-9_-]+\.js$/u);
    const currentBundle = await page.evaluate(async (scriptUrl) => {
      if (!scriptUrl) throw new Error("current module script missing");
      return (await fetch(scriptUrl)).text();
    }, currentScript);
    expect(currentBundle.includes(CURRENT_VERSION)).toBe(true);

    await page.reload();
    await expect(page).toHaveURL(`${server.origin}/#/decrypt`);
    await expect(page.getByRole("heading", { name: "Decrypt" })).toBeVisible();
    await expect(
      page.getByText(
        "Unlock, import, or create the recipient identity to decrypt this message.",
      ),
    ).toHaveCount(0);
    await expect(page.locator(`script[src="${currentScript}"]`)).toHaveCount(1);
    await expect(page.getByText("A newer version is available.")).toHaveCount(
      0,
    );

    await page.close();
    await server.stop();
    stopped = true;
    await context.setOffline(true);
    const reopened = await context.newPage();
    await reopened.goto(`${server.origin}/`);
    await expect(
      reopened.getByRole("heading", {
        name: "Create identity or import identity",
      }),
    ).toBeVisible();
    await expect(
      reopened.locator(`script[src="${currentScript}"]`),
    ).toHaveCount(1);
    expect(
      await reopened.evaluate(() =>
        Boolean(navigator.serviceWorker.controller),
      ),
    ).toBe(true);
    const reopenedPersistence = await inspectFragmentPersistence(
      reopened,
      fragmentToken,
    );
    expect(reopenedPersistence.hasForbiddenMaterial).toBe(false);
    expect(
      server.requests().some((request) => request.includes(fragmentToken)),
    ).toBe(false);
    await reopened.close();
  } finally {
    await context.setOffline(false).catch(() => undefined);
    if (!stopped) await server.stop();
  }
});
