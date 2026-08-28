import { expect, test, type Page } from "@playwright/test";

import { encodeBase37Upper } from "../../protocol/base37";
import { checksum16 } from "../../protocol/checksum";
import {
  encodeEncryptedQrText,
  encodeEncryptedQrTextHeader,
} from "../../protocol/ppxq-outer";

function canonicalLinkPayload(): string {
  const base = {
    magic: "PPXQ" as const,
    formatVersion: 1 as const,
    suite: 1 as const,
    flags: 0 as const,
    mlKemCiphertext: new Uint8Array(768).fill(1),
    ephemeralX25519PublicKey: new Uint8Array(32).fill(2),
    salt: new Uint8Array(32).fill(3),
    nonce: new Uint8Array(12).fill(4),
    ciphertextLength: 170,
    ciphertext: new Uint8Array(170).fill(5),
  };
  const header = encodeEncryptedQrTextHeader(base);
  const payload = new Uint8Array(
    header.byteLength + base.ciphertext.byteLength,
  );
  payload.set(header);
  payload.set(base.ciphertext, header.byteLength);
  return encodeBase37Upper(
    encodeEncryptedQrText({ ...base, checksum: checksum16(payload) }),
  );
}

async function readStoredMessagePreferences(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        autoDecryptIncomingMessages?: boolean;
        hasLegacyMessageQrCreationEnabled: boolean;
        hasLegacyQrAutoDecrypt: boolean;
        messageOutputMode?: string;
      }>((resolve, reject) => {
        const request = indexedDB.open("chat-nocontrol-ppx");
        request.onerror = () =>
          reject(request.error ?? new Error("Could not open settings storage"));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("settings", "readonly");
          const read = transaction.objectStore("settings").get("preferences");
          let result:
            | {
                autoDecryptIncomingMessages?: boolean;
                hasLegacyMessageQrCreationEnabled: boolean;
                hasLegacyQrAutoDecrypt: boolean;
                messageOutputMode?: string;
              }
            | undefined;
          read.onsuccess = () => {
            const value = read.result as
              | {
                  messageOutputMode?: string;
                  autoDecryptIncomingMessages?: boolean;
                  messageQrCreationEnabled?: boolean;
                  qrAutoDecrypt?: boolean;
                }
              | undefined;
            result = {
              messageOutputMode: value?.messageOutputMode,
              autoDecryptIncomingMessages: value?.autoDecryptIncomingMessages,
              hasLegacyMessageQrCreationEnabled:
                value !== undefined && "messageQrCreationEnabled" in value,
              hasLegacyQrAutoDecrypt:
                value !== undefined && "qrAutoDecrypt" in value,
            };
          };
          transaction.onerror = () =>
            reject(transaction.error ?? new Error("Could not read settings"));
          transaction.onabort = () =>
            reject(transaction.error ?? new Error("Settings read aborted"));
          transaction.oncomplete = () => {
            database.close();
            if (result === undefined) {
              reject(new Error("Settings read completed without a result"));
              return;
            }
            resolve(result);
          };
        };
      }),
  );
}

test("captures a fragment-only message link and scrubs it immediately", async ({
  page,
}) => {
  const payload = canonicalLinkPayload();
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`/#/decrypt/qr/${payload}`);
  await expect(page).toHaveURL(/#\/decrypt$/u);
  await expect(
    page.getByRole("heading", { name: "Open encrypted message" }),
  ).toBeVisible();
  await expect(page.getByLabel("24 recovery words")).toBeVisible();
  expect(requests.every((url) => !url.includes(payload))).toBe(true);
});

test("message delivery preferences persist without obsolete QR settings", async ({
  page,
}) => {
  await page.goto("/#/settings");
  await expect(page.getByLabel("Message output")).toHaveValue("both");
  await page.getByLabel("Message output").selectOption("link");
  await page
    .getByLabel("Auto-decrypt incoming message links and QRs")
    .uncheck();
  await expect
    .poll(() => readStoredMessagePreferences(page))
    .toEqual({
      messageOutputMode: "link",
      autoDecryptIncomingMessages: false,
      hasLegacyMessageQrCreationEnabled: false,
      hasLegacyQrAutoDecrypt: false,
    });
  await page.reload();
  await expect
    .poll(async () => ({
      ...(await readStoredMessagePreferences(page)),
      uiAutoDecryptIncomingMessages: await page
        .getByLabel("Auto-decrypt incoming message links and QRs")
        .isChecked(),
      uiMessageOutputMode: await page.getByLabel("Message output").inputValue(),
    }))
    .toEqual({
      messageOutputMode: "link",
      autoDecryptIncomingMessages: false,
      hasLegacyMessageQrCreationEnabled: false,
      hasLegacyQrAutoDecrypt: false,
      uiAutoDecryptIncomingMessages: false,
      uiMessageOutputMode: "link",
    });
});
