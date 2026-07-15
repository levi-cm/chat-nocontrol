import { render } from "preact";
import { registerServiceWorker } from "./app/bootstrap";
import { AppRoot } from "./app/root";
import { runtimeSupportForBuild } from "./app/runtime-support";
import "./styles.css";

const root = document.querySelector("#app");
if (!root) throw new Error("App root not found");
render(
  <AppRoot
    runtimeSupport={runtimeSupportForBuild(__CHAT_NOCONTROL_PRODUCTION_BUILD__)}
  />,
  root,
);

if (__CHAT_NOCONTROL_PRODUCTION_BUILD__) void registerServiceWorker();
