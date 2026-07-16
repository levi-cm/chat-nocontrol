import type { LockedVaultObject, PublicContact } from "../protocol/types";
import { contactStorageId, type NormalizedStoredContact } from "./contacts";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  normalizeSettings,
} from "./settings";

export class SessionStorage {
  readonly #contacts = new Map<string, NormalizedStoredContact>();
  #vault: LockedVaultObject | undefined;
  #settings: AppSettings = { ...DEFAULT_SETTINGS };

  putContact(
    contact: PublicContact,
    nickname?: string,
    includeSenderContactInLinks?: boolean,
  ): NormalizedStoredContact {
    const id = contactStorageId(contact.fingerprint);
    const existing = this.#contacts.get(id);
    const record = {
      id,
      contact,
      nickname: nickname ?? existing?.nickname ?? "",
      includeSenderContactInLinks:
        includeSenderContactInLinks ??
        existing?.includeSenderContactInLinks ??
        true,
    };
    this.#contacts.set(id, record);
    return record;
  }

  listContacts(): NormalizedStoredContact[] {
    return [...this.#contacts.values()];
  }

  replaceContacts(
    contacts: ReadonlyArray<{
      contact: PublicContact;
      nickname: string;
      includeSenderContactInLinks?: boolean;
    }>,
  ): void {
    const existing = new Map(this.#contacts);
    this.#contacts.clear();
    for (const item of contacts) {
      const id = contactStorageId(item.contact.fingerprint);
      this.putContact(
        item.contact,
        item.nickname,
        item.includeSenderContactInLinks ??
          existing.get(id)?.includeSenderContactInLinks ??
          true,
      );
    }
  }

  putVault(vault: LockedVaultObject): void {
    this.#vault = vault;
  }

  getVault(): LockedVaultObject | undefined {
    return this.#vault;
  }

  deleteVault(): void {
    this.#vault = undefined;
  }

  setLocale(locale: "en" | "de"): void {
    this.#settings = { ...this.#settings, locale };
  }

  getLocale(): "en" | "de" {
    return this.#settings.locale;
  }

  setSettings(settings: AppSettings): void {
    this.#settings = normalizeSettings(settings, settings.locale);
  }

  getSettings(): AppSettings {
    return { ...this.#settings };
  }

  eraseAll(): void {
    this.#contacts.clear();
    this.#vault = undefined;
    this.#settings = { ...DEFAULT_SETTINGS };
  }
}
