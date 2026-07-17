import type { LockedVaultObject } from "../protocol/types";
import type { PpxDatabase } from "./db";

export async function putVault(
  db: PpxDatabase,
  vault: LockedVaultObject,
): Promise<"active"> {
  await db.put("vaults", vault, "active");
  return "active";
}

export function getVault(
  db: PpxDatabase,
): Promise<LockedVaultObject | undefined> {
  // Runtime remains V1 until Cat-5 UI cutover. V2 reads use dedicated APIs.
  return db.get("vaults", "active") as Promise<LockedVaultObject | undefined>;
}

export function deleteVault(db: PpxDatabase): Promise<void> {
  return db.delete("vaults", "active");
}
