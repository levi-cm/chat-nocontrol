import { describe, expect, it } from "vitest";
import {
  createIdentitySessionState,
  lockIdentity,
  scheduleAutoLock,
  shouldAutoLock,
  unlockIdentity,
} from "../../flows/identity/session";

describe("identity session state", () => {
  it("unlocks, schedules, and explicitly locks without hidden state", () => {
    const id = new Uint8Array(20).fill(7);
    const initial = createIdentitySessionState();
    const unlocked = unlockIdentity(initial, id);
    const scheduled = scheduleAutoLock(unlocked, 1_000n, 5_000n);
    expect(scheduled.unlocked).toBe(true);
    expect(scheduled.lockScheduledAt).toBe(6_000n);
    expect(shouldAutoLock(scheduled, 5_999n)).toBe(false);
    expect(shouldAutoLock(scheduled, 6_000n)).toBe(true);
    expect(lockIdentity(scheduled)).toEqual(initial);
  });
});
