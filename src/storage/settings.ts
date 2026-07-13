import type { PpxDatabase, StoredSettings } from "./db";

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
