/// <reference lib="webworker" />

import type { PPXFileWorkerRequest, PPXWorkerEvent } from "../crypto/contracts";
import { createFileRunner } from "./file-runner";

const scope = self as DedicatedWorkerGlobalScope;
const runner = createFileRunner((event: PPXWorkerEvent) => {
  scope.postMessage(event);
});

scope.addEventListener(
  "message",
  (event: MessageEvent<PPXFileWorkerRequest>) => {
    void runner.handle(event.data);
  },
);
