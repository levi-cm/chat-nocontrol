import type { Page } from "@playwright/test";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";
import {
  estimatePassphraseBits,
  passphraseStrengthBand,
} from "../../crypto/vault";

export async function importSessionIdentity(
  page: Page,
  input: { entropy: Uint8Array; pseudonym: string; locale?: "en" | "de" },
): Promise<void> {
  const locale = input.locale ?? "en";
  const labels =
    locale === "de"
      ? {
          importIdentity: "Identität importieren",
          recoveryWords: "24 Wiederherstellungswörter",
          importWords: "Wiederherstellungswörter importieren",
          sessionOnly: "Nein, nur für diese Sitzung verwenden",
        }
      : {
          importIdentity: "Import identity",
          recoveryWords: "24 recovery words",
          importWords: "Import recovery words",
          sessionOnly: "No, use session only",
        };
  const words = createRecoveryWordCodec()
    .entropyToRecoveryWords(input.entropy)
    .join(" ");

  await page.getByRole("button", { name: labels.importIdentity }).click();
  await page.getByLabel("Pseudonym").fill(input.pseudonym);
  await page.getByLabel(labels.recoveryWords).fill(words);
  await page.getByRole("button", { name: labels.importWords }).click();
  await page.getByRole("button", { name: labels.sessionOnly }).click();
}

export async function completeRecoveryConfirmation(
  page: Page,
  locale: "en" | "de" = "en",
  passphrase = "correct horse battery staple",
): Promise<void> {
  const labels =
    locale === "de"
      ? {
          password: "Browser-Tresor-Passwort",
          passwordConfirmation: "Browser-Tresor-Passwort bestätigen",
          createVault: "Verschlüsselten Tresor erstellen",
          useWeakPassword: "Schwaches Passwort verwenden",
          qrDownload: "Privaten QR-Code als PNG speichern",
          qrStored: "Ich habe den privaten QR-Code sicher gespeichert",
          fileDownload: ".ppxrecovery-Datei herunterladen",
          fileStored: "Ich habe die .ppxrecovery-Datei sicher gespeichert",
          continueWords: "Weiter zu den Wiederherstellungswörtern",
          printLink: "Drucken / Als PDF speichern",
          pdfDownload: "Wiederherstellungs-PDF herunterladen",
          wordsWritten: "Ich habe alle 24 Wörter aufgeschrieben",
          printStored:
            "Ich habe das gedruckte Wiederherstellungsdokument sicher gespeichert",
          pdfStored: "Ich habe die Wiederherstellungs-PDF sicher gespeichert",
          continuePractice: "Weiter zur Wiederherstellungsübung",
          expertSkip: "Ich weiß, was ich tue",
          confirmSkip: "Übung überspringen",
        }
      : {
          password: "Browser-vault password",
          passwordConfirmation: "Confirm browser-vault password",
          createVault: "Create encrypted vault",
          useWeakPassword: "Use weak password",
          qrDownload: "Save private QR as PNG",
          qrStored: "I stored the private QR safely",
          fileDownload: "Download .ppxrecovery file",
          fileStored: "I stored the .ppxrecovery file safely",
          continueWords: "Continue to recovery words",
          printLink: "Print / Save as PDF",
          pdfDownload: "Download recovery PDF",
          wordsWritten: "I wrote down all 24 words",
          printStored: "I printed and safely stored the recovery document",
          pdfStored: "I safely stored the recovery PDF",
          continuePractice: "Continue to restore practice",
          expertSkip: "I know what I’m doing",
          confirmSkip: "Skip practice",
        };
  await page.getByLabel(labels.password, { exact: true }).fill(passphrase);
  await page
    .getByLabel(labels.passwordConfirmation, { exact: true })
    .fill(passphrase);
  await page.getByRole("button", { name: labels.createVault }).click();
  if (passphraseStrengthBand(estimatePassphraseBits(passphrase)) === "weak") {
    await page.getByRole("button", { name: labels.useWeakPassword }).click();
  }
  const qrDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: labels.qrDownload }).click();
  await qrDownload;
  await page.getByRole("checkbox", { name: labels.qrStored }).check();
  const fileDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: labels.fileDownload }).click();
  await fileDownload;
  await page.getByRole("checkbox", { name: labels.fileStored }).check();
  await page.getByRole("button", { name: labels.continueWords }).click();
  const printWindow = page.waitForEvent("popup");
  await page.getByRole("link", { name: labels.printLink }).click();
  await (await printWindow).close();
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: labels.pdfDownload }).click();
  await pdfDownload;
  await page.getByRole("checkbox", { name: labels.wordsWritten }).check();
  await page.getByRole("checkbox", { name: labels.printStored }).check();
  await page.getByRole("checkbox", { name: labels.pdfStored }).check();
  await page.getByRole("button", { name: labels.continuePractice }).click();
  await page.getByRole("button", { name: labels.expertSkip }).click();
  await page.getByRole("button", { name: labels.confirmSkip }).click();
}
