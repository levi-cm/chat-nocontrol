import type { LockedVaultObject } from "../protocol/types";
import type { PpxDatabase } from "./db";

export function putVault(
  db: PpxDatabase,
  vault: LockedVaultObject,
): Promise<"active"> {
  return db.put("vaults", vault, "active");
}

export function getVault(
  db: PpxDatabase,
): Promise<LockedVaultObject | undefined> {
  return db.get("vaults", "active");
}

export function deleteVault(db: PpxDatabase): Promise<void> {
  return db.delete("vaults", "active");
}
