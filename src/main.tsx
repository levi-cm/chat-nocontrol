import { render } from "preact";
import { registerServiceWorker } from "./app/bootstrap";
import { AppRoot } from "./app/root";
import { runtimeSupportForBuild } from "./app/runtime-support";
import { captureIncomingMessageIntent } from "./protocol/message-link";
import "./styles.css";

const initialIncomingIntent = (() => {
  const url = new URL(window.location.href);
  return captureIncomingMessageIntent(
    {
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      username: url.username,
      password: url.password,
    },
    window.history,
    Date.now(),
  );
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
