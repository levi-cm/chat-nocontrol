import type { Locale } from "../i18n";

const LOCALE_KEY = "ppx-locale";
const UPDATE_FLAG = "__PPX_UPDATE_AVAILABLE__";

type UpdateWindow = Window & Partial<Record<typeof UPDATE_FLAG, boolean>>;
type CanvasTheme = "system" | "light" | "dark";

const LIGHT_CANVAS = "#f5f7fb";
const DARK_CANVAS = "#0e1118";

export function isUpdateAvailable(): boolean {
  return Boolean((window as UpdateWindow)[UPDATE_FLAG]);
}

export function notifyUpdateAvailable(): void {
  (window as UpdateWindow)[UPDATE_FLAG] = true;
  window.dispatchEvent(new Event("ppx-update-available"));
}

export function dismissUpdateAvailable(): void {
  (window as UpdateWindow)[UPDATE_FLAG] = false;
}

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
    const registration = await navigator.serviceWorker.register(scriptUrl, {
      scope: "./",
    });
    if (registration.waiting) notifyUpdateAvailable();
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (
          worker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          notifyUpdateAvailable();
        }
      });
    });
    return true;
  } catch {
    return false;
  }
}
