import { describe, expect, it } from "vitest";
import { createI18nBundle, messages, translate } from "../../i18n";
import { formatLocalCount, formatLocalDateTime } from "../../i18n/format";

describe("EN/DE resources", () => {
  it("keeps exact key parity and English fallback", () => {
    expect(Object.keys(messages.de).sort()).toEqual(
      Object.keys(messages.en).sort(),
    );
    expect(translate("de", "settingsTitle")).toBe("Einstellungen");
    expect(translate("fr" as never, "noBackend")).toBe("No backend");
  });

  it("formats user-visible dates through the active locale", () => {
    const timestamp = new Date("2026-07-12T20:00:00Z");
    expect(formatLocalDateTime(timestamp, "en")).not.toBe(
      formatLocalDateTime(timestamp, "de"),
    );
  });

  it("preserves exact recovery, file, and cancellation copy", () => {
    expect(messages.en.weakVaultPasswordTitle).toBe(
      "Use a weak browser-vault password?",
    );
    expect(messages.de.weakVaultPasswordTitle).toBe(
      "Schwaches Browser-Tresor-Passwort verwenden?",
    );
    expect(messages.en.changeVaultPassword).toBe("Change password");
    expect(messages.de.changeVaultPassword).toBe("Passwort ändern");
    expect(messages.en.useWeakVaultPassword).toBe("Use weak password");
    expect(messages.de.useWeakVaultPassword).toBe(
      "Schwaches Passwort verwenden",
    );
    expect(messages.en.vaultCreationErrorTitle).toBe(
      "Browser vault could not be created",
    );
    expect(messages.de.vaultCreationErrorTitle).toBe(
      "Browser-Tresor konnte nicht erstellt werden",
    );
    expect(messages.en.savePrivateQr).toBe("Save private QR as PNG");
    expect(messages.de.savePrivateQr).toBe(
      "Privaten QR-Code als PNG speichern",
    );
    expect(messages.en.maximumFile).toBe("Maximum file size: 100 MiB");
    expect(messages.de.maximumFile).toBe("Maximale Dateigröße: 100 MiB");
    expect(messages.en.fileCaption).toBe("Caption");
    expect(messages.de.fileCaption).toBe("Bildunterschrift");
    expect(messages.en.cancelNote).toBe(
      "The current operation will stop safely.",
    );
    expect(messages.de.cancelNote).toBe(
      "Der aktuelle Vorgang wird sicher beendet.",
    );
    expect(messages.en.chooseRecipient).toBe(
      "Choose a recipient to start encrypting",
    );
    expect(messages.de.chooseRecipient).toBe(
      "Wähle einen Empfänger aus, um zu verschlüsseln",
    );
    expect(messages.en.encryptLocally).toBe("Encrypt");
    expect(messages.de.encryptLocally).toBe("Verschlüsseln");
    expect(messages.en.encryptFileLocally).toBe("Encrypt");
    expect(messages.de.encryptFileLocally).toBe("Verschlüsseln");
    expect(messages.en.previewAfterAuthentication).toBe(
      "Preview only after full authentication",
    );
    expect(messages.de.previewAfterAuthentication).toBe(
      "Vorschau nur nach vollständiger Authentifizierung",
    );
    expect(messages.en.deleteContactTitle).toBe("Delete contact?");
    expect(messages.de.deleteContactTitle).toBe("Kontakt löschen?");
    expect(messages.en.privateQrRejected).toContain(
      "cannot be imported as a public contact",
    );
    expect(messages.de.privateQrRejected).toContain(
      "nicht als öffentlicher Kontakt",
    );
  });

  it("supports safe interpolation and locale plural rules", () => {
    expect(createI18nBundle("en").t("confirmWordPosition", { n: 7 })).toBe(
      "Enter the word in position 7 of 24",
    );
    expect(formatLocalCount(1, "en", { one: "item", other: "items" })).toBe(
      "1 item",
    );
    expect(
      formatLocalCount(2, "de", { one: "Element", other: "Elemente" }),
    ).toBe("2 Elemente");
  });
});
