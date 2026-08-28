import { render } from "preact";
import {
  installClientVersionResponder,
  isExpectedCat5CutoverSearch,
  isSafeLegacyCutoverPredecessor,
  registerServiceWorker,
} from "./app/bootstrap";
import { AppRoot } from "./app/root";
import { runtimeSupportForBuild } from "./app/runtime-support";
import { captureIncomingEncryptedIntent } from "./protocol/message-link";
import "./styles.css";

interface NavigationHistoryApi {
  readonly currentEntry?: { readonly index?: unknown } | null;
  entries?(): ReadonlyArray<{
    readonly index?: unknown;
    readonly url?: unknown;
  }>;
}

function safeCutoverPredecessorUrl(): string | null {
  const navigation = (
    window as unknown as { readonly navigation?: NavigationHistoryApi }
  ).navigation;
  const currentIndex = navigation?.currentEntry?.index;
  if (typeof currentIndex !== "number" || !navigation?.entries) return null;
  try {
    const previous = navigation
      .entries()
      .find((entry) => entry.index === currentIndex - 1);
    return typeof previous?.url === "string" ? previous.url : null;
  } catch {
    return null;
  }
}

if ("serviceWorker" in navigator) {
  installClientVersionResponder(
    __CHAT_NOCONTROL_VERSION__,
    navigator.serviceWorker,
  );
}

const initialIncomingIntent = (() => {
  const url = new URL(window.location.href);
  const expectedCutover = isExpectedCat5CutoverSearch(
    url.search,
    __CHAT_NOCONTROL_VERSION__,
  );
  const captured = captureIncomingEncryptedIntent(
    {
      protocol: url.protocol,
      hostname: url.hostname,
      pathname: url.pathname,
      search: expectedCutover ? "" : url.search,
      hash: url.hash,
      username: url.username,
      password: url.password,
    },
    window.history,
    Date.now(),
  );
  if (expectedCutover && captured === null)
    window.history.replaceState(null, "", `${url.pathname}#/decrypt`);
  const predecessor = expectedCutover ? safeCutoverPredecessorUrl() : null;
  if (
    predecessor !== null &&
    isSafeLegacyCutoverPredecessor(url.toString(), predecessor)
  ) {
    window.setTimeout(() => window.history.back(), 0);
  }
  return expectedCutover && captured === null
    ? ({ kind: "invalid" } as const)
    : captured;
})();
const root = document.querySelector("#app");
if (!root) throw new Error("App root not found");
render(
  <AppRoot
    runtimeSupport={runtimeSupportForBuild(__CHAT_NOCONTROL_PRODUCTION_BUILD__)}
    initialIncomingIntent={initialIncomingIntent}
  />,
  root,
);

if (__CHAT_NOCONTROL_PRODUCTION_BUILD__) void registerServiceWorker();
