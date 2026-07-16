import type { ManagedContact } from "../components/cards/contact-management-card";
import { contactStorageId } from "../storage/contacts";

interface ContactPatch {
  id: string;
  next: ManagedContact;
  addition: boolean;
  replaceContact: boolean;
  replaceNickname: boolean;
  replaceLinkPreference: boolean;
}

interface ContactMutation {
  removals: Set<string>;
  patches: ContactPatch[];
}

interface ContactSaveRequest {
  base: ReadonlyArray<ManagedContact>;
  next: ReadonlyArray<ManagedContact>;
  getCurrent: () => ReadonlyArray<ManagedContact>;
  persist: (
    contacts: ReadonlyArray<ManagedContact>,
    destructive: boolean,
  ) => Promise<boolean>;
  commit: (contacts: ManagedContact[]) => void;
}

function deriveMutation(
  base: ReadonlyArray<ManagedContact>,
  next: ReadonlyArray<ManagedContact>,
): ContactMutation {
  const baseById = new Map(
    base.map((item) => [contactStorageId(item.contact.fingerprint), item]),
  );
  const nextIds = new Set(
    next.map((item) => contactStorageId(item.contact.fingerprint)),
  );
  const removals = new Set(
    [...baseById.keys()].filter((id) => !nextIds.has(id)),
  );
  const patches: ContactPatch[] = [];

  for (const item of next) {
    const id = contactStorageId(item.contact.fingerprint);
    const previous = baseById.get(id);
    const addition = previous === undefined;
    const replaceContact = !previous || previous.contact !== item.contact;
    const replaceNickname = !previous || previous.nickname !== item.nickname;
    const replaceLinkPreference =
      !previous ||
      previous.includeSenderContactInLinks !== item.includeSenderContactInLinks;
    if (replaceContact || replaceNickname || replaceLinkPreference) {
      patches.push({
        id,
        next: item,
        addition,
        replaceContact,
        replaceNickname,
        replaceLinkPreference,
      });
    }
  }

  return { removals, patches };
}

function applyMutation(
  current: ReadonlyArray<ManagedContact>,
  mutation: ContactMutation,
): { contacts: ManagedContact[]; destructive: boolean } {
  const patches = new Map(mutation.patches.map((patch) => [patch.id, patch]));
  const applied = new Set<string>();
  let destructive = false;
  const contacts: ManagedContact[] = [];

  for (const item of current) {
    const id = contactStorageId(item.contact.fingerprint);
    if (mutation.removals.has(id)) {
      destructive = true;
      continue;
    }
    const patch = patches.get(id);
    if (!patch) {
      contacts.push(item);
      continue;
    }
    applied.add(id);
    contacts.push({
      contact: patch.replaceContact ? patch.next.contact : item.contact,
      nickname: patch.replaceNickname ? patch.next.nickname : item.nickname,
      includeSenderContactInLinks: patch.replaceLinkPreference
        ? patch.next.includeSenderContactInLinks
        : item.includeSenderContactInLinks,
    });
  }

  for (const patch of mutation.patches) {
    if (!applied.has(patch.id) && patch.addition) contacts.push(patch.next);
  }

  return { contacts, destructive };
}

export function createSerializedContactSaveQueue() {
  let tail = Promise.resolve();

  return {
    enqueue(request: ContactSaveRequest): Promise<boolean> {
      const mutation = deriveMutation(request.base, request.next);
      const write = tail.then(async () => {
        const result = applyMutation(request.getCurrent(), mutation);
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
