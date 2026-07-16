import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedContact } from "../../components/cards/contact-management-card";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { createPublicContact } from "../../protocol/ppxc";
import type * as ContactStorage from "../../storage/contacts";
import type * as SettingsStorage from "../../storage/settings";

const harness = vi.hoisted(() => ({
  initialContacts: [] as ManagedContact[],
  latestContacts: [] as ManagedContact[],
  onContactsChange: null as
    ((contacts: ManagedContact[]) => Promise<boolean>) | null,
  replaceContacts: vi.fn(),
}));

vi.mock("../../storage/db", () => ({
  createStorageContext: vi.fn(() =>
    Promise.resolve({
      mode: "persistent" as const,
      db: { close: vi.fn() },
    }),
  ),
}));

vi.mock("../../storage/contacts", async (importOriginal) => {
  const actual = await importOriginal<typeof ContactStorage>();
  return {
    ...actual,
    listContacts: vi.fn(() => Promise.resolve(harness.initialContacts)),
    replaceContacts: harness.replaceContacts,
  };
});

vi.mock("../../storage/vault", () => ({
  deleteVault: vi.fn(() => Promise.resolve(undefined)),
  getVault: vi.fn(() => Promise.resolve(undefined)),
  putVault: vi.fn(() => Promise.resolve("active")),
}));

vi.mock("../../storage/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof SettingsStorage>();
  return {
    ...actual,
    deleteSettings: vi.fn(() => Promise.resolve(undefined)),
    getSettings: vi.fn(() => Promise.resolve(undefined)),
    putSettings: vi.fn(() => Promise.resolve("preferences")),
  };
});

vi.mock("../../flows/encrypt/text", () => ({
  EncryptTextFlow: (props: {
    contacts: ManagedContact[];
    onContactsChange: (contacts: ManagedContact[]) => Promise<boolean>;
  }) => {
    harness.latestContacts = props.contacts;
    harness.onContactsChange = props.onContactsChange;
    return <p>Encrypt harness ready</p>;
  },
}));

import { App } from "../../app/App";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(cleanup);

describe("app contact persistence", () => {
  beforeEach(async () => {
    window.location.hash = "#/encrypt";
    harness.replaceContacts.mockReset();
    harness.latestContacts = [];
    harness.onContactsChange = null;

    const existingIdentity = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(31),
      "Existing",
    );
    harness.initialContacts = [
      {
        contact: createPublicContact(existingIdentity, "Existing", 31n),
        nickname: "Old nickname",
        includeSenderContactInLinks: true,
      },
    ];
  });

  it("preserves a pending preference toggle through a concurrent contact edit and import", async () => {
    const importedIdentity = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(32),
      "Imported",
    );
    const imported: ManagedContact = {
      contact: createPublicContact(importedIdentity, "Imported", 32n),
      nickname: "New contact",
      includeSenderContactInLinks: true,
    };
    const firstWrite = deferred();
    harness.replaceContacts
      .mockImplementationOnce(() => firstWrite.promise)
      .mockResolvedValue(undefined);

    render(<App />);
    await screen.findByText("Encrypt harness ready");
    await waitFor(() => expect(harness.latestContacts).toHaveLength(1));

    const staleSnapshot = harness.latestContacts;
    const toggleSave = harness.onContactsChange?.([
      { ...staleSnapshot[0]!, includeSenderContactInLinks: false },
    ]);
    await waitFor(() => expect(harness.replaceContacts).toHaveBeenCalledOnce());

    const importSave = harness.onContactsChange?.([
      { ...staleSnapshot[0]!, nickname: "Edited nickname" },
      imported,
    ]);

    expect(harness.replaceContacts).toHaveBeenCalledOnce();
    firstWrite.resolve();
    await expect(toggleSave).resolves.toBe(true);
    await expect(importSave).resolves.toBe(true);

    expect(harness.replaceContacts).toHaveBeenCalledTimes(2);
    expect(harness.replaceContacts.mock.calls[1]?.[1]).toEqual([
      expect.objectContaining({
        nickname: "Edited nickname",
        includeSenderContactInLinks: false,
      }),
      imported,
    ]);
    await waitFor(() =>
      expect(harness.latestContacts).toEqual([
        expect.objectContaining({
          nickname: "Edited nickname",
          includeSenderContactInLinks: false,
        }),
        imported,
      ]),
    );
  });
});
