import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { decryptFile } from "../../crypto/file";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import {
  createPublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import { parseEncryptedFileObject } from "../../protocol/ppxf";
import { importSessionIdentity } from "./helpers";

test("encrypts one file locally and produces a decryptable PPXF download", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__allowPpxFileShare", {
      configurable: true,
      writable: true,
      value: true,
    });
    Object.defineProperty(window, "__sharedPpxFilename", {
      configurable: true,
      writable: true,
      value: "",
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () =>
        (window as typeof window & { __allowPpxFileShare: boolean })
          .__allowPpxFileShare,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: ShareData) => {
        (
          window as typeof window & { __sharedPpxFilename: string }
        ).__sharedPpxFilename = data.files?.[0]?.name ?? "";
        return Promise.resolve();
      },
    });
  });
  const aliceEntropy = new Uint8Array(32);
  const bob = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(2),
    "Bob",
  );
  const bobContact = createPublicContact(bob, "Bob", 2n);
  const bobQr = encodePublicContactQr(bobContact);

  await page.goto("/");
  await importSessionIdentity(page, {
    entropy: aliceEntropy,
    pseudonym: "Alice",
  });
  await page.getByRole("link", { name: "Contacts" }).click();
  await page.getByLabel("Public contact payload").fill(bobQr);
  await page.getByRole("button", { name: "Save public contact" }).click();
  await page.getByRole("link", { name: "Encrypt" }).click();
  await page
    .getByLabel("Recipient")
    .selectOption(Buffer.from(bobContact.fingerprint).toString("hex"));
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByLabel("Encrypted file").setInputFiles({
    name: "hello.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello from PPXF"),
  });
  await expect(page.getByText("File name")).toBeVisible();
  await expect(page.getByText("hello.txt", { exact: true })).toBeVisible();
  await page.getByLabel("Caption").fill("😀".repeat(4_097));
  await expect(
    page.getByText("Keep the caption at or below 16 KiB in UTF-8."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Encrypt", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Caption").fill("Local test");

  await page.getByRole("button", { name: "Encrypt", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Download encrypted file" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Share encrypted file" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __sharedPpxFilename: string })
            .__sharedPpxFilename,
      ),
    )
    .toBe("hello.txt.ppxfile");
  await page.evaluate(() => {
    (
      window as typeof window & { __allowPpxFileShare: boolean }
    ).__allowPpxFileShare = false;
  });
  await page.getByLabel("Language").selectOption("de");
  await expect(
    page.getByRole("button", { name: "Verschlüsselte Datei teilen" }),
  ).toHaveCount(0);
  await page.getByLabel("Sprache").selectOption("en");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download encrypted file" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("hello.txt.ppxfile");
  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = new Uint8Array(await readFile(path));
  const decrypted = await decryptFile({
    object: parseEncryptedFileObject(bytes),
    activeIdentity: bob,
  });
  expect(decrypted.filename).toBe("hello.txt");
  expect(decrypted.caption).toBe("Local test");
  expect(await decrypted.blob.text()).toBe("hello from PPXF");
});
