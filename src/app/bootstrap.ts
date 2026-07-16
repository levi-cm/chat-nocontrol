import type { Locale } from "../i18n";

const LOCALE_KEY = "ppx-locale";
type CanvasTheme = "system" | "light" | "dark";

const LIGHT_CANVAS = "#f5f7fb";
const DARK_CANVAS = "#0e1118";

export function readStoredLocale(storage: Storage = localStorage): Locale {
  try {
    return storage.getItem(LOCALE_KEY) === "de" ? "de" : "en";
  } catch {
    return "en";
  }
}

export function storeLocale(
  locale: Locale,
  storage: Storage = localStorage,
): boolean {
  try {
    storage.setItem(LOCALE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}

export function clearStoredLocale(storage: Storage = localStorage): boolean {
  try {
    storage.removeItem(LOCALE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function syncThemeColor(
  theme: CanvasTheme,
  targetDocument: Document = document,
  prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches,
): string {
  const color =
    theme === "dark" || (theme === "system" && prefersDark)
      ? DARK_CANVAS
      : LIGHT_CANVAS;
  let meta = targetDocument.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (!meta) {
    meta = targetDocument.createElement("meta");
    meta.name = "theme-color";
    targetDocument.head.append(meta);
  }
  meta.content = color;
  return color;
}

export async function registerServiceWorker(
  scriptUrl = "./sw.js",
): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register(scriptUrl, {
      scope: "./",
    });
    return true;
  } catch {
    return false;
  }
}
