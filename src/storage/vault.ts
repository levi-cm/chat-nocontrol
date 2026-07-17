import type { LockedVaultObjectV2 } from "../protocol/types-v2";
import type { PpxDatabase, StoredVaultObject } from "./db";

export async function putVault(
  db: PpxDatabase,
  vault: LockedVaultObjectV2,
): Promise<"active"> {
  await db.put("vaults", vault, "active");
  return "active";
}

export function getVault(
  db: PpxDatabase,
): Promise<StoredVaultObject | undefined> {
  return db.get("vaults", "active");
}

export function deleteVault(db: PpxDatabase): Promise<void> {
  return db.delete("vaults", "active");
}
