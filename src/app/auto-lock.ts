export const AUTO_LOCK_MS = 15 * 60 * 1000;

export const AUTO_LOCK_ACTIVITY_EVENTS: readonly (keyof WindowEventMap)[] = [
  "keydown",
  "pointerdown",
  "touchstart",
];
