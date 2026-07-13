import type { Page } from "@playwright/test";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";

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
): Promise<void> {
  const labels =
    locale === "de"
      ? {
          action:
            "Zum Export der privaten Wiederherstellungskarte gedrückt halten",
          phraseLabel: "Tippe PRIVAT EXPORTIEREN zum Fortfahren",
          phrase: "PRIVAT EXPORTIEREN",
          confirm: "Gespeicherte Wiederherstellung bestätigen",
        }
      : {
          action: "Press and hold to export private recovery card",
          phraseLabel: "Type EXPORT PRIVATE to continue",
          phrase: "EXPORT PRIVATE",
          confirm: "Confirm recovery saved",
        };
  const words = await page.locator(".word-grid li").allTextContents();
  const phrase = page.getByLabel(labels.phraseLabel);
  if (await phrase.isDisabled()) {
    const download = page.waitForEvent("download");
    const exportAction = page.getByRole("button", {
      name: labels.action,
    });
    await exportAction.focus();
    await page.keyboard.press("Enter");
    await download;
  }
  await phrase.fill(labels.phrase);
  const confirmationInputs = page.locator(
    'input[id^="recovery-word-confirmation-"]',
  );
  for (let index = 0; index < (await confirmationInputs.count()); index += 1) {
    const input = confirmationInputs.nth(index);
    const id = await input.getAttribute("id");
    const position = Number(id?.split("-").at(-1));
    await input.fill(words[position - 1] ?? "");
  }
  await page.getByRole("button", { name: labels.confirm }).click();
}
