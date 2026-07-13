export interface IdentitySessionState {
  unlocked: boolean;
  activeIdentityId: Uint8Array | null;
  lockScheduledAt: bigint | null;
  clipboardClearAt: bigint | null;
}

export function createIdentitySessionState(): IdentitySessionState {
  return {
    unlocked: false,
    activeIdentityId: null,
    lockScheduledAt: null,
    clipboardClearAt: null,
  };
}

export function unlockIdentity(
  state: IdentitySessionState,
  activeIdentityId: Uint8Array,
): IdentitySessionState {
  if (activeIdentityId.byteLength !== 20) {
    throw new Error("active identity ID must be 20 bytes");
  }
  return {
    ...state,
    unlocked: true,
    activeIdentityId: Uint8Array.from(activeIdentityId),
  };
}

export function scheduleAutoLock(
  state: IdentitySessionState,
  now: bigint,
  idleDuration: bigint,
): IdentitySessionState {
  if (!state.unlocked || idleDuration <= 0n) return state;
  return { ...state, lockScheduledAt: now + idleDuration };
}

export function shouldAutoLock(
  state: IdentitySessionState,
  now: bigint,
): boolean {
  return (
    state.unlocked &&
    state.lockScheduledAt !== null &&
    now >= state.lockScheduledAt
  );
}

export function lockIdentity(
  state: IdentitySessionState,
): IdentitySessionState {
  if (!state.unlocked) return state;
  return createIdentitySessionState();
}

export function scheduleClipboardClear(
  state: IdentitySessionState,
  now: bigint,
): IdentitySessionState {
  return { ...state, clipboardClearAt: now + 60_000n };
}
