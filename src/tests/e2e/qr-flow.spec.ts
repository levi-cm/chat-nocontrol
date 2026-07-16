import { expect, test } from "@playwright/test";

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

test("captures a fragment-only message link and scrubs it immediately", async ({
  page,
}) => {
  const payload = canonicalLinkPayload();
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`/#/decrypt/qr/${payload}`);
  await expect(page).toHaveURL(/#\/decrypt$/u);
  await expect(
    page.getByText("Create or import an identity first."),
  ).toBeVisible();
  expect(requests.every((url) => !url.includes(payload))).toBe(true);
});

test("message delivery preferences persist without the legacy key", async ({
  page,
}) => {
  await page.goto("/#/settings");
  await expect(page.getByLabel("Message output")).toHaveValue("both");
  await page.getByLabel("Message output").selectOption("link");
  await expect(page.getByLabel("Export")).toBeHidden();
  await page.getByLabel("Offer message QR after text encryption").check();
  await page.getByLabel("Export").selectOption("app");
  await page.getByLabel("Import controls").selectOption("image");
  await page
    .getByLabel("Auto-decrypt incoming message links and QRs")
    .uncheck();
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const request = indexedDB.open("chat-nocontrol-ppx");
        request.onerror = () => resolve(false);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("settings", "readonly");
          const read = transaction.objectStore("settings").get("preferences");
          read.onerror = () => resolve(false);
          read.onsuccess = () => {
            const value = read.result as
              | {
                  messageQrCreationEnabled?: boolean;
                  messageOutputMode?: string;
                  autoDecryptIncomingMessages?: boolean;
                  qrAutoDecrypt?: boolean;
                }
              | undefined;
            database.close();
            resolve(
              value?.messageQrCreationEnabled === true &&
                value.messageOutputMode === "link" &&
                value.autoDecryptIncomingMessages === false &&
                !("qrAutoDecrypt" in value),
            );
          };
        };
      }),
  );
  await page.reload();
  await expect(
    page.getByLabel("Offer message QR after text encryption"),
  ).toBeChecked();
  await expect(page.getByLabel("Export")).toHaveValue("app");
  await expect(page.getByLabel("Import controls")).toHaveValue("image");
  await expect(page.getByLabel("Message output")).toHaveValue("link");
  await expect(
    page.getByLabel("Auto-decrypt incoming message links and QRs"),
  ).not.toBeChecked();
});
