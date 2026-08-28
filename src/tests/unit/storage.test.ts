import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { lockVaultV2 } from "../../crypto/vault-v2";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import { deleteAllLocalData } from "../../storage/erase";
import {
  createStorageContext,
  deletePpxDatabase,
  openPpxDatabase,
} from "../../storage/db";
import {
  contactStorageId,
  listContacts,
  putContact,
  replaceContacts,
} from "../../storage/contacts";
import { getVault, putVault } from "../../storage/vault";
import { SessionStorage } from "../../storage/session";
import {
  DEFAULT_SETTINGS,
  getSettings,
  normalizeSettings,
  putSettings,
} from "../../storage/settings";

describe("minimal PPX storage", () => {
  afterEach(async () => {
    await deletePpxDatabase();
  });

  it("merges repeat keys but keeps same-pseudonym different keys separate", async () => {
    const db = await openPpxDatabase();
    const first = await deriveIdentityV2FromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const second = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(1),
      "Alice",
    );
    await putContact(
      db,
      createPublicContactV2(first, "Alice", 1n, new Uint8Array(32).fill(1)),
      "Friend",
    );
    await putContact(
      db,
      createPublicContactV2(first, "Alice", 2n, new Uint8Array(32).fill(2)),
      "Updated",
    );
    await putContact(
      db,
      createPublicContactV2(second, "Alice", 3n, new Uint8Array(32).fill(3)),
    );
    const contacts = await listContacts(db);
    expect(contacts).toHaveLength(2);
    expect(contacts.find((item) => item.nickname === "Updated")).toBeDefined();
    db.close();
  });

  it("stores only encrypted vaults and supports erase-all", async () => {
    const db = await openPpxDatabase();
    expect([...db.objectStoreNames].sort()).toEqual([
      "contacts",
      "settings",
      "vaults",
    ]);
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const vault = await lockVaultV2({
      identity,
      passphrase: "five random words make safer vaults",
    });
    await putVault(db, vault);
    await putSettings(db, {
      locale: "de",
      messageOutputMode: "text",
    });
    expect((await getVault(db))?.magic).toBe("PPXV");
    expect(await getSettings(db)).toEqual({
      locale: "de",
      messageOutputMode: "text",
    });
    await deleteAllLocalData(db);
    expect(await getVault(db)).toBeUndefined();
    expect(await listContacts(db)).toEqual([]);
    expect(await getSettings(db)).toBeUndefined();
    db.close();
  });

  it("falls back to session-only when persistent storage is denied", async () => {
    const context = await createStorageContext(() =>
      Promise.reject(new DOMException("denied", "SecurityError")),
    );
    expect(context.mode).toBe("session-only");
  });

  it("falls back when opening persistent storage never settles", async () => {
    const context = await createStorageContext(
      () => new Promise(() => undefined),
      5,
    );
    expect(context.mode).toBe("session-only");
  });

  it("normalizes incoming-message settings and migrates legacy auto-decrypt", () => {
    expect(normalizeSettings(undefined)).toMatchObject({
      messageOutputMode: "both",
      autoDecryptIncomingMessages: true,
    });
    expect(
      normalizeSettings({
        locale: "en",
        messageOutputMode: "invalid" as never,
        qrAutoDecrypt: false,
      }),
    ).toMatchObject({
      messageOutputMode: DEFAULT_SETTINGS.messageOutputMode,
      autoDecryptIncomingMessages: false,
    });
    expect(
      normalizeSettings({
        locale: "en",
        autoDecryptIncomingMessages: true,
        qrAutoDecrypt: false,
      }).autoDecryptIncomingMessages,
    ).toBe(true);
  });

  it("writes only the new incoming-message settings shape", async () => {
    const db = await openPpxDatabase();
    await putSettings(db, {
      locale: "en",
      messageOutputMode: "link",
      autoDecryptIncomingMessages: false,
      qrAutoDecrypt: true,
    });
    expect(await getSettings(db)).toEqual({
      locale: "en",
      messageOutputMode: "link",
      autoDecryptIncomingMessages: false,
    });
    db.close();
  });

  it("strips obsolete message QR settings when rewriting a legacy record", async () => {
    const db = await openPpxDatabase();
    const legacyRecord = {
      locale: "de" as const,
      theme: "dark" as const,
      messageQrCreationEnabled: true,
      qrExportMode: "both",
      qrImportControls: "camera",
      qrAutoDecrypt: false,
    } as Parameters<typeof putSettings>[1];
    await db.put("settings", legacyRecord, "preferences");

    const normalized = normalizeSettings(await getSettings(db));
    expect(normalized.autoDecryptIncomingMessages).toBe(false);

    await putSettings(db, normalized);

    expect(await getSettings(db)).toEqual({
      locale: "de",
      theme: "dark",
      accent: "blue",
      translucent: true,
      messageOutputMode: "both",
      autoDecryptIncomingMessages: false,
    });
    db.close();
  });

  it("resets incoming-message settings when session data is erased", () => {
    const session = new SessionStorage();
    session.setSettings({
      ...DEFAULT_SETTINGS,
      messageOutputMode: "link",
      autoDecryptIncomingMessages: false,
    });

    session.eraseAll();

    expect(session.getSettings()).toMatchObject({
      messageOutputMode: "both",
      autoDecryptIncomingMessages: true,
    });
  });

  it("normalizes legacy IndexedDB contacts to include sender contact", async () => {
    const db = await openPpxDatabase();
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const contact = createPublicContactV2(
      identity,
      "Alice",
      1n,
      new Uint8Array(32).fill(4),
    );
    await db.put("contacts", {
      id: contactStorageId(contact.fingerprint),
      contact,
      nickname: "Legacy",
    });

    expect((await listContacts(db))[0]).toMatchObject({
      nickname: "Legacy",
      includeSenderContactInLinks: true,
    });
    db.close();
  });

  it("defaults contact link inclusion on and persists an explicit opt-out", async () => {
    const db = await openPpxDatabase();
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const contact = createPublicContactV2(
      identity,
      "Alice",
      1n,
      new Uint8Array(32).fill(5),
    );

    const initial = await putContact(db, contact);
    expect(initial.includeSenderContactInLinks).toBe(true);
    expect((await listContacts(db))[0]?.includeSenderContactInLinks).toBe(true);

    const optedOut = await putContact(db, contact, undefined, false);
    expect(optedOut.includeSenderContactInLinks).toBe(false);
    expect(
      (await db.get("contacts", optedOut.id))?.includeSenderContactInLinks,
    ).toBe(false);

    await replaceContacts(db, [
      {
        contact,
        nickname: "Friend",
      },
    ]);
    expect((await listContacts(db))[0]).toMatchObject({
      nickname: "Friend",
      includeSenderContactInLinks: false,
    });
    db.close();

    const session = new SessionStorage();
    expect(session.putContact(contact).includeSenderContactInLinks).toBe(true);
    expect(
      session.putContact(contact, "Friend", false).includeSenderContactInLinks,
    ).toBe(false);
    session.replaceContacts([
      {
        contact,
        nickname: "Renamed",
      },
    ]);
    expect(session.listContacts()[0]).toMatchObject({
      nickname: "Renamed",
      includeSenderContactInLinks: false,
    });
  });
});
