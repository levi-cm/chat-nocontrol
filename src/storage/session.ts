import type { LockedVaultObject, PublicContact } from "../protocol/types";
import { contactStorageId } from "./contacts";
import type { StoredContact } from "./db";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  normalizeSettings,
} from "./settings";

export class SessionStorage {
  readonly #contacts = new Map<string, StoredContact>();
  #vault: LockedVaultObject | undefined;
  #settings: AppSettings = { ...DEFAULT_SETTINGS };

  putContact(contact: PublicContact, nickname?: string): StoredContact {
    const id = contactStorageId(contact.fingerprint);
    const existing = this.#contacts.get(id);
    const record = {
      id,
      contact,
      nickname: nickname ?? existing?.nickname ?? "",
    };
    this.#contacts.set(id, record);
    return record;
  }

  listContacts(): StoredContact[] {
    return [...this.#contacts.values()];
  }

  replaceContacts(
    contacts: ReadonlyArray<Pick<StoredContact, "contact" | "nickname">>,
  ): void {
    this.#contacts.clear();
    for (const item of contacts) this.putContact(item.contact, item.nickname);
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
