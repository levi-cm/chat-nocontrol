import type { ManagedContact } from "../components/cards/contact-management-card";
import { contactStorageId } from "../storage/contacts";

export type ContactSaveMutation =
  | { kind: "add"; item: ManagedContact }
  | {
      kind: "update";
      fingerprint: Uint8Array;
      patch: Partial<ManagedContact>;
    }
  | { kind: "remove"; fingerprint: Uint8Array };

interface ContactSaveRequest {
  mutation: ContactSaveMutation;
  getCurrent: () => ReadonlyArray<ManagedContact>;
  persist: (
    contacts: ReadonlyArray<ManagedContact>,
    destructive: boolean,
  ) => Promise<boolean>;
  commit: (contacts: ManagedContact[]) => void;
}

function applyMutation(
  current: ReadonlyArray<ManagedContact>,
  mutation: ContactSaveMutation,
): { contacts: ManagedContact[]; destructive: boolean } {
  const targetId = contactStorageId(
    mutation.kind === "add"
      ? mutation.item.contact.fingerprint
      : mutation.fingerprint,
  );
  const index = current.findIndex(
    (item) => contactStorageId(item.contact.fingerprint) === targetId,
  );

  if (mutation.kind === "remove") {
    if (index < 0) return { contacts: [...current], destructive: false };
    return {
      contacts: current.filter((_, itemIndex) => itemIndex !== index),
      destructive: true,
    };
  }

  if (mutation.kind === "add") {
    if (index < 0) {
      return { contacts: [...current, mutation.item], destructive: false };
    }
    return { contacts: [...current], destructive: false };
  }

  if (index < 0) return { contacts: [...current], destructive: false };
  const contacts = [...current];
  contacts[index] = { ...current[index]!, ...mutation.patch };
  return { contacts, destructive: false };
}

export function createSerializedContactSaveQueue() {
  let tail = Promise.resolve();

  return {
    enqueue(request: ContactSaveRequest): Promise<boolean> {
      const write = tail.then(async () => {
        const result = applyMutation(request.getCurrent(), request.mutation);
        const saved = await request.persist(
          result.contacts,
          result.destructive,
        );
        if (saved) request.commit(result.contacts);
        return saved;
      });
      tail = write.then(
        () => undefined,
        () => undefined,
      );
      return write;
    },
  };
}
