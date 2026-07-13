import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import QRCode from "qrcode";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { encodeBase45Upper } from "../../protocol/base45";
import {
  createPublicContact,
  encodePublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import { encodeRecoveryObject } from "../../protocol/ppxr";

async function qrFile(text: string, name: string) {
  return {
    name,
    mimeType: "image/png",
    buffer: await QRCode.toBuffer(text, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 700,
    }),
  };
}

test("imports a public contact from a QR image", async ({ page }) => {
  const identity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(7),
    "QR Bob",
  );
  const qr = encodePublicContactQr(createPublicContact(identity, "QR Bob", 7n));

  await page.goto("/#/contacts");
  await page.getByLabel("QR image").setInputFiles(await qrFile(qr, "bob.png"));
  await expect(page.getByLabel("Public contact payload")).toHaveValue(qr);
  await page.getByRole("button", { name: "Save public contact" }).click();
  await expect(page.getByText("QR Bob", { exact: true })).toBeVisible();
});

test("committed QR image fixtures decode valid and reject damaged contact", async ({
  page,
}) => {
  await page.goto("/#/contacts");
  await page.getByLabel("QR image").setInputFiles({
    name: "contact-valid.png",
    mimeType: "image/png",
    buffer: await readFile("fixtures/qr/contact-valid.png"),
  });
  await expect(page.getByLabel("Public contact payload")).toHaveValue(
    /^PPX1:CONTACT:/u,
  );
  await page.getByRole("button", { name: "Save public contact" }).click();
  await expect(page.getByText("QR Bob", { exact: true })).toBeVisible();

  await page.getByLabel("QR image").setInputFiles({
    name: "contact-checksum-damaged.png",
    mimeType: "image/png",
    buffer: await readFile("fixtures/qr/contact-checksum-damaged.png"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Could not read this QR image.",
  );
});

test("imports a public contact file", async ({ page }) => {
  const identity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(9),
    "File Bob",
  );
  const bytes = encodePublicContact(
    createPublicContact(identity, "File Bob", 9n),
  );

  await page.goto("/#/contacts");
  await page.getByLabel("Public contact file").setInputFiles({
    name: "bob.ppxcontact",
    mimeType: "application/x-ppx-contact",
    buffer: Buffer.from(bytes),
  });
  await page.getByRole("button", { name: "Save public contact" }).click();
  await expect(page.getByText("File Bob", { exact: true })).toBeVisible();
});

test("clears private recovery scanned on the public-contact surface", async ({
  page,
}) => {
  const bytes = encodeRecoveryObject({
    magic: "PPXR",
    formatVersion: 1,
    suite: 1,
    flags: 0,
    masterEntropy: new Uint8Array(32).fill(44),
    creationTime: 44n,
    pseudonym: "Private Alice",
    checksum: new Uint8Array(16),
  });
  const qr = `PPX1:RECOVERY:${encodeBase45Upper(bytes)}`;

  await page.goto("/#/contacts");
  await page
    .getByLabel("QR image")
    .setInputFiles(await qrFile(qr, "private-recovery.png"));
  await expect(page.getByRole("alert")).toContainText(
    "Private recovery material cannot be imported as a public contact. It was cleared.",
  );
  await expect(page.getByLabel("Public contact payload")).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Save public contact" }),
  ).toBeDisabled();
});

test("imports private recovery from a QR image", async ({ page }) => {
  const bytes = encodeRecoveryObject({
    magic: "PPXR",
    formatVersion: 1,
    suite: 1,
    flags: 0,
    masterEntropy: new Uint8Array(32).fill(5),
    creationTime: 5n,
    pseudonym: "QR Alice",
    checksum: new Uint8Array(16),
  });
  const qr = `PPX1:RECOVERY:${encodeBase45Upper(bytes)}`;

  await page.goto("/");
  await page.getByRole("button", { name: "Import identity" }).click();
  await page.getByLabel("Pseudonym").fill("QR Alice relabeled");
  await page
    .getByLabel("QR image")
    .setInputFiles(await qrFile(qr, "recovery.png"));
  await page.getByRole("button", { name: "Import scanned QR" }).click();
  await page.getByRole("button", { name: "No, use session only" }).click();
  await expect(page.getByRole("button", { name: "Lock now" })).toBeVisible();
  await page.getByRole("link", { name: "Identity" }).click();
  await expect(page.getByText("QR Alice", { exact: true })).toBeVisible();
});
