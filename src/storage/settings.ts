import type { PpxDatabase, StoredSettings } from "./db";

export type ThemePreference = "system" | "light" | "dark";
export type AccentPreference =
  "blue" | "indigo" | "purple" | "teal" | "pink" | "orange" | "graphite";
export type MessageOutputMode = "link" | "text" | "both";

export interface AppSettings {
  locale: "en" | "de";
  theme: ThemePreference;
  accent: AccentPreference;
  translucent: boolean;
  messageOutputMode: MessageOutputMode;
  autoDecryptIncomingMessages: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: "en",
  theme: "system",
  accent: "blue",
  translucent: true,
  messageOutputMode: "both",
  autoDecryptIncomingMessages: true,
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
const messageOutputModes = new Set<MessageOutputMode>(["link", "text", "both"]);

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
    messageOutputMode: messageOutputModes.has(
      value?.messageOutputMode as MessageOutputMode,
    )
      ? (value?.messageOutputMode as MessageOutputMode)
      : DEFAULT_SETTINGS.messageOutputMode,
    autoDecryptIncomingMessages:
      typeof value?.autoDecryptIncomingMessages === "boolean"
        ? value.autoDecryptIncomingMessages
        : typeof value?.qrAutoDecrypt === "boolean"
          ? value.qrAutoDecrypt
          : DEFAULT_SETTINGS.autoDecryptIncomingMessages,
  };
}

export function putSettings(
  db: PpxDatabase,
  settings: StoredSettings,
): Promise<"preferences"> {
  const current = { ...settings };
  delete current.qrAutoDecrypt;
  return db.put("settings", current, "preferences");
}

export function getSettings(
  db: PpxDatabase,
): Promise<StoredSettings | undefined> {
  return db.get("settings", "preferences");
}

export function deleteSettings(db: PpxDatabase): Promise<void> {
  return db.delete("settings", "preferences");
}
