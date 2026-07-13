import type { PpxDatabase } from "./db";

export async function deleteAllLocalData(db: PpxDatabase): Promise<void> {
  const transaction = db.transaction(
    ["contacts", "vaults", "settings"],
    "readwrite",
  );
  await Promise.all([
    transaction.objectStore("contacts").clear(),
    transaction.objectStore("vaults").clear(),
    transaction.objectStore("settings").clear(),
  ]);
  await transaction.done;
}
