import type { PpxDatabase, StoredSettings } from "./db";

export type ThemePreference = "system" | "light" | "dark";
export type AccentPreference =
  "blue" | "indigo" | "purple" | "teal" | "pink" | "orange" | "graphite";
export type QrExportMode = "app" | "link" | "both";
export type QrImportControls = "camera" | "image" | "both";

export interface AppSettings {
  locale: "en" | "de";
  theme: ThemePreference;
  accent: AccentPreference;
  translucent: boolean;
  messageQrCreationEnabled: boolean;
  qrExportMode: QrExportMode;
  qrImportControls: QrImportControls;
  qrAutoDecrypt: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: "en",
  theme: "system",
  accent: "blue",
  translucent: true,
  messageQrCreationEnabled: false,
  qrExportMode: "both",
  qrImportControls: "both",
  qrAutoDecrypt: true,
};

const themes = new Set<ThemePreference>(["system", "light", "dark"]);
const accents = new Set<AccentPreference>([
  "blue",
  "indigo",
  "purple",
  "teal",
  "pink",
  "orange",
  "graphite",
]);
const qrExportModes = new Set<QrExportMode>(["app", "link", "both"]);
const qrImportControlValues = new Set<QrImportControls>([
  "camera",
  "image",
  "both",
]);

export function normalizeSettings(
  value: StoredSettings | undefined,
  fallbackLocale: "en" | "de" = "en",
): AppSettings {
  return {
    locale: value?.locale === "de" ? "de" : fallbackLocale,
    theme: themes.has(value?.theme as ThemePreference)
      ? (value?.theme as ThemePreference)
      : DEFAULT_SETTINGS.theme,
    accent: accents.has(value?.accent as AccentPreference)
      ? (value?.accent as AccentPreference)
      : DEFAULT_SETTINGS.accent,
    translucent:
      typeof value?.translucent === "boolean"
        ? value.translucent
        : DEFAULT_SETTINGS.translucent,
    messageQrCreationEnabled:
      typeof value?.messageQrCreationEnabled === "boolean"
        ? value.messageQrCreationEnabled
        : DEFAULT_SETTINGS.messageQrCreationEnabled,
    qrExportMode: qrExportModes.has(value?.qrExportMode as QrExportMode)
      ? (value?.qrExportMode as QrExportMode)
      : DEFAULT_SETTINGS.qrExportMode,
    qrImportControls: qrImportControlValues.has(
      value?.qrImportControls as QrImportControls,
    )
      ? (value?.qrImportControls as QrImportControls)
      : DEFAULT_SETTINGS.qrImportControls,
    qrAutoDecrypt:
      typeof value?.qrAutoDecrypt === "boolean"
        ? value.qrAutoDecrypt
        : DEFAULT_SETTINGS.qrAutoDecrypt,
  };
}

export function putSettings(
  db: PpxDatabase,
  settings: StoredSettings,
): Promise<"preferences"> {
  return db.put("settings", settings, "preferences");
}

export function getSettings(
  db: PpxDatabase,
): Promise<StoredSettings | undefined> {
  return db.get("settings", "preferences");
}

export function deleteSettings(db: PpxDatabase): Promise<void> {
  return db.delete("settings", "preferences");
}
