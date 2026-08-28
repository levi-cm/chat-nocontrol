import { describe, expect, it, vi } from "vitest";
import { createSerializedContactSaveQueue } from "../../app/contact-save-queue";
import type { ManagedContact } from "../../components/cards/contact-management-card";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";

function deferred() {
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("serialized contact save queue", () => {
  it("does not resurrect a concurrently deleted contact from a stale update", async () => {
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(33),
      "Deleted",
    );
    const original: ManagedContact = {
      contact: createPublicContactV2(
        identity,
        "Deleted",
        33n,
        new Uint8Array(32).fill(33),
      ),
      nickname: "Before",
      includeSenderContactInLinks: true,
    };
    let current: ManagedContact[] = [];
    const persist = vi.fn(() => Promise.resolve(true));
    const queue = createSerializedContactSaveQueue();

    await queue.enqueue({
      mutation: {
        kind: "update",
        fingerprint: original.contact.fingerprint,
        patch: { nickname: "Stale edit" },
      },
      getCurrent: () => current,
      persist,
      commit: (contacts) => {
        current = contacts;
      },
    });

    expect(persist).toHaveBeenCalledWith([], false);
    expect(current).toEqual([]);
  });

  it("applies an explicit same-field reversion queued from the same stale base", async () => {
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(34),
      "Recipient",
    );
    const original: ManagedContact = {
      contact: createPublicContactV2(
        identity,
        "Recipient",
        34n,
        new Uint8Array(32).fill(34),
      ),
      nickname: "Recipient",
      includeSenderContactInLinks: true,
    };
    let current = [original];
    const firstWrite = deferred();
    const persisted: ManagedContact[][] = [];
    const persist = vi
      .fn<(contacts: ReadonlyArray<ManagedContact>) => Promise<boolean>>()
      .mockImplementationOnce((contacts) => {
        persisted.push([...contacts]);
        return firstWrite.promise;
      })
      .mockImplementation((contacts) => {
        persisted.push([...contacts]);
        return Promise.resolve(true);
      });
    const queue = createSerializedContactSaveQueue();
    const commit = (contacts: ManagedContact[]) => {
      current = contacts;
    };

    const optOut = queue.enqueue({
      mutation: {
        kind: "update",
        fingerprint: original.contact.fingerprint,
        patch: { includeSenderContactInLinks: false },
      },
      getCurrent: () => current,
      persist,
      commit,
    });
    const restoreDefault = queue.enqueue({
      mutation: {
        kind: "update",
        fingerprint: original.contact.fingerprint,
        patch: { includeSenderContactInLinks: true },
      },
      getCurrent: () => current,
      persist,
      commit,
    });

    firstWrite.resolve(true);
    await expect(optOut).resolves.toBe(true);
    await expect(restoreDefault).resolves.toBe(true);

    expect(persisted[1]?.[0]?.includeSenderContactInLinks).toBe(true);
    expect(current[0]?.includeSenderContactInLinks).toBe(true);
  });

  it("treats a stale same-fingerprint add as already satisfied", async () => {
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(35),
      "Known",
    );
    const contact = createPublicContactV2(
      identity,
      "Known",
      35n,
      new Uint8Array(32).fill(35),
    );
    const authoritative: ManagedContact = {
      contact,
      nickname: "Authoritative nickname",
      includeSenderContactInLinks: false,
    };
    let current = [authoritative];
    const persist = vi.fn(() => Promise.resolve(true));

    await createSerializedContactSaveQueue().enqueue({
      mutation: {
        kind: "add",
        item: {
          contact,
          nickname: "Stale nickname",
          includeSenderContactInLinks: true,
        },
      },
      getCurrent: () => current,
      persist,
      commit: (contacts) => {
        current = contacts;
      },
    });

    expect(persist).toHaveBeenCalledWith([authoritative], false);
    expect(current).toEqual([authoritative]);
  });
});
