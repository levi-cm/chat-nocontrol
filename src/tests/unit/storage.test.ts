import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { lockVault } from "../../crypto/vault";
import { createPublicContact } from "../../protocol/ppxc";
import { deleteAllLocalData } from "../../storage/erase";
import {
  createStorageContext,
  deletePpxDatabase,
  openPpxDatabase,
} from "../../storage/db";
import { listContacts, putContact } from "../../storage/contacts";
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
    const first = await deriveIdentityFromEntropy(new Uint8Array(32), "Alice");
    const second = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(1),
      "Alice",
    );
    await putContact(db, createPublicContact(first, "Alice", 1n), "Friend");
    await putContact(db, createPublicContact(first, "Alice", 2n), "Updated");
    await putContact(db, createPublicContact(second, "Alice", 3n));
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
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32),
      "Alice",
    );
    const vault = await lockVault({
      identity,
      passphrase: "five random words make safer vaults",
    });
    await putVault(db, vault);
    await putSettings(db, {
      locale: "de",
      messageQrCreationEnabled: true,
    });
    expect((await getVault(db))?.magic).toBe("PPXV");
    expect(await getSettings(db)).toEqual({
      locale: "de",
      messageQrCreationEnabled: true,
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

  it("normalizes browser-local message QR preferences without migration", () => {
    expect(normalizeSettings(undefined)).toMatchObject({
      messageQrCreationEnabled: false,
      qrExportMode: "both",
      qrImportControls: "both",
      qrAutoDecrypt: true,
    });
    expect(
      normalizeSettings({
        locale: "en",
        messageQrCreationEnabled: "invalid" as never,
        qrExportMode: "invalid" as never,
        qrImportControls: "invalid" as never,
        qrAutoDecrypt: false,
      }),
    ).toMatchObject({
      messageQrCreationEnabled: false,
      qrExportMode: DEFAULT_SETTINGS.qrExportMode,
      qrImportControls: DEFAULT_SETTINGS.qrImportControls,
      qrAutoDecrypt: false,
    });
  });

  it("persists an explicit message QR creation opt-in in both storage modes", async () => {
    const db = await openPpxDatabase();
    await putSettings(db, {
      locale: "en",
      messageQrCreationEnabled: true,
    });
    expect(normalizeSettings(await getSettings(db))).toMatchObject({
      messageQrCreationEnabled: true,
    });
    db.close();

    const session = new SessionStorage();
    session.setSettings({
      ...DEFAULT_SETTINGS,
      messageQrCreationEnabled: true,
    });
    expect(session.getSettings().messageQrCreationEnabled).toBe(true);
    session.eraseAll();
    expect(session.getSettings().messageQrCreationEnabled).toBe(false);
  });
});
