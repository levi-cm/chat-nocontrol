import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { encryptText } from "../../crypto/text";
import { encryptQrText } from "../../crypto/qr-text";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";
import { encodeMessageLink } from "../../protocol/message-link";
import {
  createPublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import { importSessionIdentity } from "./helpers";

async function messageLink(recipientEntropy: Uint8Array, plaintext: string) {
  const sender = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(71),
    "Link Alice",
  );
  const recipient = await deriveIdentityFromEntropy(
    recipientEntropy,
    "Link Bob",
  );
  const object = await encryptText({
    sender: createPublicContact(sender, "Link Alice", 71n),
    senderSigningCapability: createSenderSigningCapability(sender),
    recipient: createPublicContact(recipient, "Link Bob", 72n),
    plaintext,
    messageId: new Uint8Array(16).fill(73),
    sentAt: 74n,
    createdAt: 74n,
  });
  return encodeMessageLink({ kind: "ppxt", object }, "https://sender.example/");
}

async function compactMessageLink(
  recipientEntropy: Uint8Array,
  plaintext: string,
) {
  const sender = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(81),
    "Compact Alice",
  );
  const recipient = await deriveIdentityFromEntropy(
    recipientEntropy,
    "Compact Bob",
  );
  const senderContact = createPublicContact(sender, "Compact Alice", 81n);
  const object = await encryptQrText({
    sender: senderContact,
    senderSigningCapability: createSenderSigningCapability(sender),
    recipient: createPublicContact(recipient, "Compact Bob", 82n),
    plaintext,
    messageId: new Uint8Array(16).fill(83),
    sentAt: 84n,
    createdAt: 84n,
  });
  return {
    link: encodeMessageLink(
      { kind: "ppxq", object },
      "https://sender.example/",
    ),
    senderContact,
  };
}

test("cold capture scrubs before identity setup and never sends the fragment", async ({
  page,
}) => {
  const link = await messageLink(new Uint8Array(32).fill(72), "cold secret");
  const hash = new URL(link).hash;
  const encoded = hash.slice("#/m/".length);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto(`/${hash}`);

  await expect(page).toHaveURL(/#\/decrypt$/u);
  await expect(
    page.getByRole("heading", { name: "Open encrypted message" }),
  ).toBeVisible();
  await expect(page.getByLabel("24 recovery words")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  expect(
    (
      await new AxeBuilder({ page })
        .include(".incoming-message-context")
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(requests.every((url) => !url.includes(encoded))).toBe(true);
  expect(
    await page.evaluate(async (needle) => {
      const databaseValues: unknown[] = [];
      for (const databaseInfo of await indexedDB.databases()) {
        if (!databaseInfo.name) continue;
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(databaseInfo.name!);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () =>
            reject(request.error ?? new Error("Could not inspect database"));
        });
        for (const storeName of database.objectStoreNames) {
          const transaction = database.transaction(storeName, "readonly");
          databaseValues.push(
            ...(await new Promise<unknown[]>((resolve, reject) => {
              const request = transaction.objectStore(storeName).getAll();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () =>
                reject(request.error ?? new Error("Could not inspect store"));
            })),
          );
        }
        database.close();
      }
      const cacheUrls = (
        await Promise.all(
          (await caches.keys()).map(async (name) =>
            (await caches.open(name)).keys(),
          ),
        )
      ).flatMap((requests) => requests.map((request) => request.url));
      return !JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
        databaseValues,
        cacheUrls,
        resources: performance
          .getEntriesByType("resource")
          .map((entry) => entry.name),
        visibleText: document.body.textContent,
      }).includes(needle);
    }, encoded),
  ).toBe(true);
});

test("preserves a cold message through direct identity import", async ({
  page,
}) => {
  const entropy = new Uint8Array(32).fill(72);
  const link = await messageLink(entropy, "imported secret");
  const words = createRecoveryWordCodec()
    .entropyToRecoveryWords(entropy)
    .join(" ");

  await page.goto(`/${new URL(link).hash}`);
  await expect(page.getByLabel("24 recovery words")).toBeVisible();
  await page.getByLabel("Pseudonym").fill("Link Bob");
  await page.getByLabel("24 recovery words").fill(words);
  await page.getByRole("button", { name: "Import recovery words" }).click();
  await page.getByRole("button", { name: "No, use session only" }).click();

  await expect(page.getByLabel("Decrypted text")).toHaveValue(
    "imported secret",
  );
});

test("keeps a pending message through wrong then correct remembered-vault unlock", async ({
  page,
}) => {
  test.slow();
  const entropy = new Uint8Array(32).fill(72);
  const link = await messageLink(entropy, "remembered secret");
  const words = createRecoveryWordCodec()
    .entropyToRecoveryWords(entropy)
    .join(" ");
  await page.goto("/");
  await page.getByRole("button", { name: "Import identity" }).click();
  await page.getByLabel("Pseudonym").fill("Link Bob");
  await page.getByLabel("24 recovery words").fill(words);
  await page.getByRole("button", { name: "Import recovery words" }).click();
  await page
    .getByRole("button", { name: "Yes, create an encrypted local vault" })
    .click();
  await page
    .getByLabel("Vault passphrase")
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Save encrypted vault" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u, { timeout: 15_000 });
  await page.getByRole("button", { name: "Lock now" }).click();

  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, new URL(link).hash);
  await expect(
    page.getByRole("heading", { name: "Unlock remembered identity" }),
  ).toBeVisible();
  await page.getByLabel("Vault passphrase").fill("wrong password");
  await page.getByRole("button", { name: "Unlock identity" }).click();
  await expect(page.getByRole("alert")).toContainText("Could not unlock", {
    timeout: 15_000,
  });
  await page
    .getByLabel("Vault passphrase")
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Unlock identity" }).click();

  await expect(page.getByLabel("Decrypted text")).toHaveValue(
    "remembered secret",
    { timeout: 15_000 },
  );
});

test("malformed reserved links scrub to a safe error without identity prompts", async ({
  page,
}) => {
  await page.goto("/?tracking=1#/m/not+padded=");
  await expect(page).toHaveURL(/#\/decrypt$/u);
  await expect(page.getByRole("alert")).toHaveText(
    "This encrypted message link is invalid, incomplete, or too large.",
  );
  await expect(
    page.getByRole("button", { name: "Import identity" }),
  ).toHaveCount(0);
});

test("captures, scrubs, and auto-decrypts a link in an active session", async ({
  page,
}) => {
  const entropy = new Uint8Array(32).fill(72);
  const link = await messageLink(entropy, "one-click secret 😀");
  await page.goto("/");
  await importSessionIdentity(page, { entropy, pseudonym: "Link Bob" });
  await page.getByRole("link", { name: "Decrypt" }).click();

  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, new URL(link).hash);

  await expect(page).toHaveURL(/#\/decrypt$/u);
  await expect(page.getByLabel("Decrypted text")).toHaveValue(
    "one-click secret 😀",
  );
  await expect(
    page.getByRole("heading", { name: "Unknown sender" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Not now" })).toBeVisible();
});

test("locking clears a manual-ready incoming intent before identity zeroization", async ({
  page,
}) => {
  const entropy = new Uint8Array(32).fill(72);
  const link = await messageLink(entropy, "must disappear on lock");
  await page.goto("/");
  await importSessionIdentity(page, { entropy, pseudonym: "Link Bob" });
  await page.getByRole("link", { name: "Open settings" }).click();
  await page
    .getByRole("checkbox", {
      name: /^Auto-decrypt incoming message links and QRs/u,
    })
    .uncheck();
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, new URL(link).hash);
  await expect(
    page.getByText("Encrypted message ready. Decrypt when you are ready."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Lock now" }).click();

  await expect(
    page.getByText("Encrypted message ready. Decrypt when you are ready."),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Open encrypted message" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Create or import an identity first."),
  ).toBeVisible();
});

test("shows incoming identity import in German", async ({ page }) => {
  const link = await messageLink(
    new Uint8Array(32).fill(72),
    "deutsche Nachricht",
  );
  await page.goto("/#/settings");
  await page.getByLabel("Language").selectOption("de");
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, new URL(link).hash);

  await expect(
    page.getByRole("heading", { name: "Verschlüsselte Nachricht öffnen" }),
  ).toBeVisible();
  await expect(page.getByLabel("24 Wiederherstellungswörter")).toBeVisible();
});

test("honors manual mode and parses a foreign-host pasted link without navigation", async ({
  page,
}) => {
  const entropy = new Uint8Array(32).fill(72);
  const link = await messageLink(entropy, "manual secret");
  await page.goto("/");
  await importSessionIdentity(page, { entropy, pseudonym: "Link Bob" });
  await page.getByRole("link", { name: "Open settings" }).click();
  await page
    .getByRole("checkbox", {
      name: /^Auto-decrypt incoming message links and QRs/u,
    })
    .uncheck();

  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, new URL(link).hash);
  await expect(
    page.getByText("Encrypted message ready. Decrypt when you are ready."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Help" }).click();
  await page.goBack();
  await expect(
    page.getByText("Encrypted message ready. Decrypt when you are ready."),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Decrypt locally" }),
  ).toBeDisabled();
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, new URL(link).hash);
  await expect(
    page.getByText("Encrypted message ready. Decrypt when you are ready."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Decrypt locally" }).click();
  await expect(page.getByLabel("Decrypted text")).toHaveValue("manual secret");

  await page.getByRole("link", { name: "Decrypt" }).click();
  const before = page.url();
  await page
    .getByLabel("Encrypted item")
    .fill(link.replace("sender.example", "other.example"));
  expect(page.url()).toBe(before);
  await page.getByRole("button", { name: "Decrypt locally" }).click();
  await expect(page.getByLabel("Decrypted text")).toHaveValue("manual secret");
});

test("compact links fail closed for unknown senders and decrypt for saved senders", async ({
  page,
}) => {
  const entropy = new Uint8Array(32).fill(82);
  const { link, senderContact } = await compactMessageLink(
    entropy,
    "compact secret",
  );
  await page.goto("/");
  await importSessionIdentity(page, { entropy, pseudonym: "Compact Bob" });
  await page.getByRole("link", { name: "Decrypt" }).click();
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, new URL(link).hash);
  await expect(page.getByRole("alert")).toContainText(
    "Import this sender's public contact first",
  );

  await page.getByRole("link", { name: "Contacts" }).click();
  await page
    .getByLabel("Public contact payload")
    .fill(encodePublicContactQr(senderContact));
  await page.getByRole("button", { name: "Save public contact" }).click();
  await page.getByRole("link", { name: "Decrypt" }).click();
  await page.getByLabel("Encrypted item").fill(link);
  await expect(page.getByLabel("Decrypted text")).toHaveValue("compact secret");
});
