import { isReservedMessageLinkHash } from "../protocol/message-link";

export type RouteName =
  "encrypt" | "decrypt" | "contacts" | "identity" | "help" | "settings";

export const ROUTES: Record<RouteName, string> = {
  encrypt: "#/encrypt",
  decrypt: "#/decrypt",
  contacts: "#/contacts",
  identity: "#/identity",
  help: "#/help",
  settings: "#/settings",
};

const LAST_UNLOCKED_ROUTE_KEY = "ppx-last-unlocked-route";
const routeNames = new Set<RouteName>(Object.keys(ROUTES) as RouteName[]);

function isRouteName(value: string): value is RouteName {
  return routeNames.has(value as RouteName);
}

export function readLastUnlockedRoute(
  storage: Storage = localStorage,
): RouteName | null {
  try {
    const value = storage.getItem(LAST_UNLOCKED_ROUTE_KEY);
    return value !== null && isRouteName(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLastUnlockedRoute(
  route: RouteName,
  storage: Storage = localStorage,
): boolean {
  try {
    storage.setItem(LAST_UNLOCKED_ROUTE_KEY, route);
    return true;
  } catch {
    return false;
  }
}

export function clearLastUnlockedRoute(
  storage: Storage = localStorage,
): boolean {
  try {
    storage.removeItem(LAST_UNLOCKED_ROUTE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function routeAfterUnlock(
  hasPendingQrIntent: boolean,
  rememberedRoute: RouteName | null,
): RouteName {
  if (hasPendingQrIntent) return "decrypt";
  return rememberedRoute ?? "encrypt";
}

export function routeFromHash(hash: string): RouteName {
  if (isReservedMessageLinkHash(hash)) return "decrypt";
  const match = (Object.entries(ROUTES) as [RouteName, string][]).find(
    ([, value]) => value === hash,
  );
  return match?.[0] ?? "identity";
}

export function captureQrMessageLink(location: Location): string | null {
  if (!location.hash.startsWith("#/decrypt/qr/")) return null;
  const encoded = location.hash.slice("#/decrypt/qr/".length);
  if (!encoded || encoded.length > 120_000 || !/^[0-9A-Z-]+$/.test(encoded)) {
    return null;
  }
  return `${location.origin}${location.pathname}${location.search}#/decrypt/qr/${encoded}`;
}
