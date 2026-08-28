import type { Locale } from "../i18n";

const LOCALE_KEY = "ppx-locale";
type CanvasTheme = "system" | "light" | "dark";

const LIGHT_CANVAS = "#f5f7fb";
const DARK_CANVAS = "#0e1118";
const MESSAGE_LINK_HASH_PREFIX = "#/m/";
const LEGACY_QR_LINK_HASH_PREFIX = "#/decrypt/qr/";
const MESSAGE_LINK_MAX_ENCODED_CHARS = 400_000;
const LEGACY_QR_LINK_MAX_ENCODED_CHARS = 101_975;
const CAT5_CUTOVER_QUERY_PARAMETER = "cat5-cutover";

export const CLIENT_VERSION_PROBE = "chat-nocontrol-client-version-probe";
export const CLIENT_VERSION_RESPONSE = "chat-nocontrol-client-version-response";

export interface LegacyCutoverClient {
  readonly url: string;
  navigate(url: string): Promise<unknown>;
  postMessage?(message: unknown, transfer?: Transferable[]): void;
}

export interface ClientVersionMessageTarget {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
}

type ClientVersionProbe = (
  client: LegacyCutoverClient,
  expectedVersion: string,
) => Promise<string | null>;

function supportedIncomingHash(hash: string): boolean {
  if (hash.startsWith(MESSAGE_LINK_HASH_PREFIX)) {
    const encoded = hash.slice(MESSAGE_LINK_HASH_PREFIX.length);
    return (
      encoded.length > 0 &&
      encoded.length <= MESSAGE_LINK_MAX_ENCODED_CHARS &&
      /^[A-Za-z0-9_-]+$/u.test(encoded)
    );
  }
  if (hash.startsWith(LEGACY_QR_LINK_HASH_PREFIX)) {
    const encoded = hash.slice(LEGACY_QR_LINK_HASH_PREFIX.length);
    return (
      encoded.length > 0 &&
      encoded.length <= LEGACY_QR_LINK_MAX_ENCODED_CHARS &&
      /^[0-9A-Z-]+$/u.test(encoded)
    );
  }
  return false;
}

export function isSafeLegacyCutoverPredecessor(
  currentUrl: string,
  previousUrl: string,
): boolean {
  try {
    const current = new URL(currentUrl);
    const previous = new URL(previousUrl);
    return (
      current.protocol === "https:" &&
      previous.origin === current.origin &&
      previous.pathname === current.pathname &&
      previous.username === "" &&
      previous.password === "" &&
      previous.search === "" &&
      supportedIncomingHash(previous.hash)
    );
  } catch {
    return false;
  }
}

export function createLegacyCutoverTarget(
  clientUrl: string,
  scopeUrl: string,
  currentVersion: string,
): string | null {
  try {
    const client = new URL(clientUrl);
    const scope = new URL(scopeUrl);
    if (
      scope.protocol !== "https:" ||
      client.origin !== scope.origin ||
      client.username !== "" ||
      client.password !== "" ||
      scope.username !== "" ||
      scope.password !== "" ||
      scope.search !== "" ||
      scope.hash !== "" ||
      !client.pathname.startsWith(scope.pathname)
    ) {
      return null;
    }
    if (
      !/^[0-9A-Za-z.-]{1,64}$/u.test(currentVersion) ||
      isExpectedCat5CutoverSearch(client.search, currentVersion)
    ) {
      return null;
    }
    scope.search = "";
    scope.searchParams.set(CAT5_CUTOVER_QUERY_PARAMETER, currentVersion);
    scope.hash = supportedIncomingHash(client.hash) ? client.hash : "#/decrypt";
    return scope.toString();
  } catch {
    return null;
  }
}

export function isExpectedCat5CutoverSearch(
  search: string,
  currentVersion: string,
): boolean {
  if (!/^[0-9A-Za-z.-]{1,64}$/u.test(currentVersion)) return false;
  const expected = new URLSearchParams({
    [CAT5_CUTOVER_QUERY_PARAMETER]: currentVersion,
  });
  return search === `?${expected.toString()}`;
}

export async function probeClientVersion(
  client: LegacyCutoverClient,
  _expectedVersion: string,
  timeoutMs = 750,
): Promise<string | null> {
  const postMessage = client.postMessage?.bind(client);
  if (!postMessage) return null;
  return new Promise<string | null>((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (version: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      channel.port1.close();
      resolve(version);
    };
    const timeout = setTimeout(() => finish(null), timeoutMs);
    channel.port1.addEventListener("message", (event) => {
      const data = event.data as { type?: unknown; version?: unknown } | null;
      if (
        data?.type === CLIENT_VERSION_RESPONSE &&
        typeof data.version === "string"
      ) {
        finish(data.version);
      }
    });
    channel.port1.start();
    try {
      postMessage({ type: CLIENT_VERSION_PROBE }, [
        channel.port2,
      ] as Transferable[]);
    } catch {
      finish(null);
    }
  });
}

export async function forceLegacyClientCutover(
  client: LegacyCutoverClient,
  currentVersion: string,
  scopeUrl: string,
  probe: ClientVersionProbe = probeClientVersion,
): Promise<"current" | "ignored" | "navigation-started" | "navigation-failed"> {
  let reportedVersion: string | null = null;
  try {
    reportedVersion = await probe(client, currentVersion);
  } catch {
    // A failed bounded probe is treated as a legacy client.
  }
  if (reportedVersion === currentVersion) return "current";
  const target = createLegacyCutoverTarget(
    client.url,
    scopeUrl,
    currentVersion,
  );
  if (!target) return "ignored";
  try {
    void client.navigate(target).catch(() => undefined);
    return "navigation-started";
  } catch {
    return "navigation-failed";
  }
}

export function installClientVersionResponder(
  currentVersion: string,
  target: ClientVersionMessageTarget,
): () => void {
  const respond = (event: MessageEvent) => {
    const data = event.data as { type?: unknown } | null;
    const port = event.ports[0];
    if (data?.type !== CLIENT_VERSION_PROBE || !port) return;
    port.postMessage({
      type: CLIENT_VERSION_RESPONSE,
      version: currentVersion,
    });
  };
  target.addEventListener("message", respond);
  return () => target.removeEventListener("message", respond);
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
    await navigator.serviceWorker.register(scriptUrl, {
      scope: "./",
    });
    return true;
  } catch {
    return false;
  }
}
