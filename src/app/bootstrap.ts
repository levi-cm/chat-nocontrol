import type { Locale } from "../i18n";

const LOCALE_KEY = "ppx-locale";
const UPDATE_FLAG = "__PPX_UPDATE_AVAILABLE__";

type UpdateWindow = Window & Partial<Record<typeof UPDATE_FLAG, boolean>>;

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
