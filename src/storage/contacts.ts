import type { PublicContact } from "../protocol/types";
import type { PpxDatabase, StoredContact } from "./db";

export type NormalizedStoredContact = StoredContact & {
  includeSenderContactInLinks: boolean;
};

type ContactStorageInput = Pick<StoredContact, "contact" | "nickname"> & {
  includeSenderContactInLinks?: boolean;
};

function normalizeContact(record: StoredContact): NormalizedStoredContact {
  return {
    ...record,
    includeSenderContactInLinks: record.includeSenderContactInLinks !== false,
  };
}

export function contactStorageId(fingerprint: Uint8Array): string {
  return [...fingerprint]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function putContact(
  db: PpxDatabase,
  contact: PublicContact,
  nickname?: string,
  includeSenderContactInLinks?: boolean,
): Promise<NormalizedStoredContact> {
  const id = contactStorageId(contact.fingerprint);
  const transaction = db.transaction("contacts", "readwrite");
  const existing = await transaction.store.get(id);
  const record = {
    id,
    contact,
    nickname: nickname ?? existing?.nickname ?? "",
    includeSenderContactInLinks:
      includeSenderContactInLinks ??
      existing?.includeSenderContactInLinks ??
      true,
  };
  await transaction.store.put(record);
  await transaction.done;
  return normalizeContact(record);
}

export async function listContacts(
  db: PpxDatabase,
): Promise<NormalizedStoredContact[]> {
  return (await db.getAll("contacts")).map(normalizeContact);
}

export function deleteContact(db: PpxDatabase, id: string): Promise<void> {
  return db.delete("contacts", id);
}

export async function replaceContacts(
  db: PpxDatabase,
  contacts: ReadonlyArray<ContactStorageInput>,
): Promise<void> {
  const transaction = db.transaction("contacts", "readwrite");
  const existing = new Map(
    (await transaction.store.getAll()).map((item) => [item.id, item]),
  );
  await transaction.store.clear();
  for (const item of contacts) {
    const id = contactStorageId(item.contact.fingerprint);
    await transaction.store.put({
      id,
      contact: item.contact,
      nickname: item.nickname,
      includeSenderContactInLinks:
        item.includeSenderContactInLinks ??
        existing.get(id)?.includeSenderContactInLinks ??
        true,
    });
  }
  await transaction.done;
}
