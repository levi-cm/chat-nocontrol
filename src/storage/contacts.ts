import type { PublicContact } from "../protocol/types";
import type { PpxDatabase, StoredContact } from "./db";

export function contactStorageId(fingerprint: Uint8Array): string {
  return [...fingerprint]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function putContact(
  db: PpxDatabase,
  contact: PublicContact,
  nickname?: string,
): Promise<StoredContact> {
  const id = contactStorageId(contact.fingerprint);
  const transaction = db.transaction("contacts", "readwrite");
  const existing = await transaction.store.get(id);
  const record = {
    id,
    contact,
    nickname: nickname ?? existing?.nickname ?? "",
  };
  await transaction.store.put(record);
  await transaction.done;
  return record;
}

export function listContacts(db: PpxDatabase): Promise<StoredContact[]> {
  return db.getAll("contacts");
}

export function deleteContact(db: PpxDatabase, id: string): Promise<void> {
  return db.delete("contacts", id);
}

export async function replaceContacts(
  db: PpxDatabase,
  contacts: ReadonlyArray<Pick<StoredContact, "contact" | "nickname">>,
): Promise<void> {
  const transaction = db.transaction("contacts", "readwrite");
  await transaction.store.clear();
  for (const item of contacts) {
    await transaction.store.put({
      id: contactStorageId(item.contact.fingerprint),
      contact: item.contact,
      nickname: item.nickname,
    });
  }
  await transaction.done;
}
