import { render } from "preact";
import { App } from "./app/App";
import { registerServiceWorker } from "./app/bootstrap";
import "./styles.css";

const root = document.querySelector("#app");
if (!root) throw new Error("App root not found");
render(<App />, root);

if (__CHAT_NOCONTROL_PRODUCTION_BUILD__) void registerServiceWorker();
