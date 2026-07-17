import { render } from "preact";
import { registerServiceWorker } from "./app/bootstrap";
import { AppRoot } from "./app/root";
import { runtimeSupportForBuild } from "./app/runtime-support";
import { captureIncomingMessageIntentV2 } from "./protocol/message-link-v2";
import "./styles.css";

const initialIncomingIntent = (() => {
  const url = new URL(window.location.href);
  return captureIncomingMessageIntentV2(
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
