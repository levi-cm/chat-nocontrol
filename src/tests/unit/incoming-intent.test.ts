import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessageIntent } from "../../protocol/message-link";
import {
  consumeExpectedIncomingIntent,
  incomingIntentIsExpired,
  remainingIncomingIntentLifetime,
  scheduleIncomingIntentExpiry,
} from "../../app/incoming-intent";

const intent: IncomingMessageIntent = {
  kind: "ppxq",
  object: {} as IncomingMessageIntent extends { object: infer T } ? T : never,
  capturedAt: 1_000,
};

describe("incoming message intent lifetime", () => {
  afterEach(() => vi.useRealTimers());
  it("expires typed intents after exactly fifteen minutes", () => {
    expect(incomingIntentIsExpired(intent, 900_999)).toBe(false);
    expect(incomingIntentIsExpired(intent, 901_000)).toBe(true);
    expect(remainingIncomingIntentLifetime(intent, 900_999)).toBe(1);
  });

  it("treats malformed intents as immediately consumable rather than timed payloads", () => {
    const invalid: IncomingMessageIntent = { kind: "invalid" };
    expect(incomingIntentIsExpired(invalid, Number.MAX_SAFE_INTEGER)).toBe(
      false,
    );
    expect(remainingIncomingIntentLifetime(invalid, 0)).toBeNull();
  });

  it("does not let an old decrypt completion consume a replacement", () => {
    const replacement = { ...intent, capturedAt: 2_000 };
    expect(consumeExpectedIncomingIntent(replacement, intent)).toBe(
      replacement,
    );
    expect(consumeExpectedIncomingIntent(intent, intent)).toBeNull();
  });

  it("fires the real expiry callback at the fifteen-minute boundary", () => {
    vi.useFakeTimers();
    const expired = vi.fn();
    scheduleIncomingIntentExpiry(intent, 1_000, expired);

    vi.advanceTimersByTime(899_999);
    expect(expired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expired).toHaveBeenCalledOnce();
  });
});
