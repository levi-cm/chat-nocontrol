/// <reference lib="webworker" />

import type { PPXWorkerEvent, PPXWorkerRequest } from "../crypto/contracts";
import { createFileRunner } from "./file-runner";

const scope = self as DedicatedWorkerGlobalScope;
const runner = createFileRunner((event: PPXWorkerEvent) => {
  scope.postMessage(event);
});

scope.addEventListener("message", (event: MessageEvent<PPXWorkerRequest>) => {
  void runner.handle(event.data);
});
