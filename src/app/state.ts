import type { Locale } from "../i18n";
import type { RouteName } from "./routes";

export interface AppState {
  locale: Locale;
  route: RouteName;
  activeIdentityId: Uint8Array | null;
  storageMode: "persistent" | "session-only";
}

export function createInitialAppState(locale: Locale = "en"): AppState {
  return {
    locale,
    route: "identity",
    activeIdentityId: null,
    storageMode: "persistent",
  };
}
