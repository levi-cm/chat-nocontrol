export type RouteName =
  "encrypt" | "decrypt" | "contacts" | "identity" | "help";

export const ROUTES: Record<RouteName, string> = {
  encrypt: "#/encrypt",
  decrypt: "#/decrypt",
  contacts: "#/contacts",
  identity: "#/identity",
  help: "#/help",
};

export function routeFromHash(hash: string): RouteName {
  const match = (Object.entries(ROUTES) as [RouteName, string][]).find(
    ([, value]) => value === hash,
  );
  return match?.[0] ?? "identity";
}
