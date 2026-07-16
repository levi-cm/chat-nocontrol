import type { IncomingMessageIntent } from "../protocol/message-link";

export const INCOMING_MESSAGE_INTENT_TTL_MS = 15 * 60 * 1_000;

export function consumeExpectedIncomingIntent(
  current: IncomingMessageIntent | null,
  expected?: IncomingMessageIntent,
): IncomingMessageIntent | null {
  return expected && current !== expected ? current : null;
}

function capturedAt(intent: IncomingMessageIntent): number | null {
  return intent.kind === "invalid" ? null : intent.capturedAt;
}

export function incomingIntentIsExpired(
  intent: IncomingMessageIntent,
  now: number,
): boolean {
  const captured = capturedAt(intent);
  return captured !== null && now - captured >= INCOMING_MESSAGE_INTENT_TTL_MS;
}

export function remainingIncomingIntentLifetime(
  intent: IncomingMessageIntent,
  now: number,
): number | null {
  const captured = capturedAt(intent);
  if (captured === null) return null;
  return Math.max(0, captured + INCOMING_MESSAGE_INTENT_TTL_MS - now);
}

export function scheduleIncomingIntentExpiry(
  intent: IncomingMessageIntent,
  now: number,
  onExpire: () => void,
): () => void {
  const remaining = remainingIncomingIntentLifetime(intent, now);
  if (remaining === null) return () => undefined;
  const timer = window.setTimeout(onExpire, remaining);
  return () => window.clearTimeout(timer);
}
