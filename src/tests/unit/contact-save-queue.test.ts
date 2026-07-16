import { describe, expect, it, vi } from "vitest";
import { createSerializedContactSaveQueue } from "../../app/contact-save-queue";
import type { ManagedContact } from "../../components/cards/contact-management-card";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { createPublicContact } from "../../protocol/ppxc";

describe("serialized contact save queue", () => {
  it("does not resurrect a concurrently deleted contact from a stale update", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(33),
      "Deleted",
    );
    const original: ManagedContact = {
      contact: createPublicContact(identity, "Deleted", 33n),
      nickname: "Before",
      includeSenderContactInLinks: true,
    };
    let current: ManagedContact[] = [];
    const persist = vi.fn(() => Promise.resolve(true));
    const queue = createSerializedContactSaveQueue();

    await queue.enqueue({
      base: [original],
      next: [{ ...original, nickname: "Stale edit" }],
      getCurrent: () => current,
      persist,
      commit: (contacts) => {
        current = contacts;
      },
    });

    expect(persist).toHaveBeenCalledWith([], false);
    expect(current).toEqual([]);
  });
});
