import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { LockedVaultObject } from "../protocol/types";
import type {
  LockedVaultObjectV2,
  PublicContactV2,
} from "../protocol/types-v2";
import { SessionStorage } from "./session";

export const DATABASE_NAME = "chat-nocontrol-ppx";

export interface StoredContact {
  id: string;
  contact: PublicContactV2;
  nickname: string;
  includeSenderContactInLinks?: boolean;
}

export interface StoredSettings {
  locale: "en" | "de";
  theme?: "system" | "light" | "dark";
  accent?:
    "blue" | "indigo" | "purple" | "teal" | "pink" | "orange" | "graphite";
  translucent?: boolean;
  messageQrCreationEnabled?: boolean;
  qrExportMode?: "app" | "link" | "both";
  qrImportControls?: "camera" | "image" | "both";
  messageOutputMode?: "link" | "text" | "both";
  autoDecryptIncomingMessages?: boolean;
  /** Legacy read-only migration source. New writes omit this field. */
  qrAutoDecrypt?: boolean;
}

export type StoredVaultObject = LockedVaultObject | LockedVaultObjectV2;

export interface PpxDatabaseSchema extends DBSchema {
  contacts: {
    key: string;
    value: StoredContact;
    indexes: { "by-pseudonym": string };
  };
  vaults: {
    key: "active" | "migration-v2";
    value: StoredVaultObject;
  };
  settings: { key: "preferences"; value: StoredSettings };
}

export type PpxDatabase = IDBPDatabase<PpxDatabaseSchema>;

export function openPpxDatabase(): Promise<PpxDatabase> {
  return openDB<PpxDatabaseSchema>(DATABASE_NAME, 1, {
    upgrade(database) {
      const contacts = database.createObjectStore("contacts", {
        keyPath: "id",
      });
      contacts.createIndex("by-pseudonym", "contact.pseudonym");
      database.createObjectStore("vaults");
      database.createObjectStore("settings");
    },
  });
}

export function deletePpxDatabase(): Promise<void> {
  return deleteDB(DATABASE_NAME);
}

export type StorageContext =
  | { mode: "persistent"; db: PpxDatabase }
  | { mode: "session-only"; session: SessionStorage };

export async function createStorageContext(
  open: () => Promise<PpxDatabase> = openPpxDatabase,
  timeoutMs = 3_000,
): Promise<StorageContext> {
  let timedOut = false;
  let timer = 0;
  let opening: Promise<PpxDatabase>;
  try {
    opening = open();
  } catch {
    return { mode: "session-only", session: new SessionStorage() };
  }
  try {
    const db = await Promise.race([
      opening,
      new Promise<never>((_resolve, reject) => {
        timer = window.setTimeout(() => {
          timedOut = true;
          reject(new DOMException("storage open timed out", "TimeoutError"));
        }, timeoutMs);
      }),
    ]);
    return { mode: "persistent", db };
  } catch {
    if (timedOut) {
      void opening.then((db) => db.close()).catch(() => undefined);
    }
    return { mode: "session-only", session: new SessionStorage() };
  } finally {
    window.clearTimeout(timer);
  }
}
