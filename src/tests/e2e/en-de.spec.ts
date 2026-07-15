import { expect, test } from "@playwright/test";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";
import {
  createPublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import { completeRecoveryConfirmation } from "./helpers";

test("English and German preserve navigation and warning severity", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Keep secret. Anyone who has it can recover your identity."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open settings" }).click();
  await page.getByLabel("Language").selectOption("de");
  await page.getByRole("link", { name: "Chat NoControl" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByText(/Geheim halten/u)).toBeVisible();
  await page.getByRole("link", { name: "Hilfe" }).click();
  await expect(page.getByRole("heading", { name: "Hilfe" })).toBeVisible();
  await expect(page.getByText(/Stabile Sicherheit/u)).toHaveCount(0);
});

test("German identity recovery guard is complete", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open settings" }).click();
  await page.getByLabel("Language").selectOption("de");
  await page.getByRole("link", { name: "Chat NoControl" }).click();
  await page.getByRole("button", { name: "Neue Identität erstellen" }).click();
  await page.getByLabel("Benutzername").fill("Waldkauz");
  await page.getByRole("button", { name: "Identität erzeugen" }).click();
  await completeRecoveryConfirmation(page, "de");
  await page
    .getByRole("radio", { name: /Nein, nur für diese Sitzung verwenden/u })
    .check();
  await page
    .getByRole("button", { name: "Identitätseinrichtung abschließen" })
    .click();
  await expect(
    page.getByRole("button", { name: "Jetzt sperren" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Identität" }).click();
  await expect(page.getByText("Waldkauz", { exact: true })).toBeVisible();
});

test("German contacts encrypt and decrypt path is complete", async ({
  page,
}) => {
  const entropy = new Uint8Array(32).fill(7);
  const identity = await deriveIdentityFromEntropy(entropy, "Biber");
  const contact = createPublicContact(identity, "Biber", 2n);
  const contactQr = encodePublicContactQr(contact);
  const words = createRecoveryWordCodec()
    .entropyToRecoveryWords(entropy)
    .join(" ");

  await page.goto("/");
  await page.getByRole("link", { name: "Open settings" }).click();
  await page.getByLabel("Language").selectOption("de");
  await page.getByRole("link", { name: "Chat NoControl" }).click();
  await page.getByRole("button", { name: "Identität importieren" }).click();
  await page.getByLabel("Pseudonym").fill("Biber");
  await page.getByLabel("24 Wiederherstellungswörter").fill(words);
  await page
    .getByRole("button", { name: "Wiederherstellungswörter importieren" })
    .click();
  await page
    .getByRole("button", { name: "Nein, nur für diese Sitzung verwenden" })
    .click();

  await page.getByRole("link", { name: "Kontakte" }).click();
  await page.getByLabel("Nutzlast des öffentlichen Kontakts").fill(contactQr);
  await page
    .getByRole("button", { name: "Öffentlichen Kontakt speichern" })
    .click();
  await page.getByRole("link", { name: "Verschlüsseln" }).click();
  await page
    .getByPlaceholder("Nach Pseudonym, Spitznamen oder Fingerabdruck suchen")
    .fill("Biber");
  await page
    .getByLabel("Empfänger")
    .selectOption(Buffer.from(contact.fingerprint).toString("hex"));
  await page.getByRole("button", { name: "Datei", exact: true }).click();
  await expect(page.getByLabel("Verschlüsselte Datei")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verschlüsseln", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByLabel("Verschlüsselter Text").fill("Geheime Nachricht");
  await page
    .getByRole("button", { name: "Verschlüsseln", exact: true })
    .click();
  const armor = await page.getByLabel("Verschlüsselte Ausgabe").inputValue();

  await page.getByRole("link", { name: "Entschlüsseln" }).click();
  await expect(page.getByLabel("Verschlüsselte Datei")).toBeVisible();
  await page.getByLabel("Verschlüsseltes Element").fill(armor);
  await page
    .getByRole("button", { name: "Lokal entschlüsseln", exact: true })
    .click();
  await expect(page.getByLabel("Entschlüsselter Text")).toHaveValue(
    "Geheime Nachricht",
  );
});
