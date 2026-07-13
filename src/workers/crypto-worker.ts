/// <reference lib="webworker" />

import type { PPXWorkerEvent, PPXWorkerRequest } from "../crypto/contracts";
import { createCryptoRunner } from "./crypto-runner";

const scope = self as DedicatedWorkerGlobalScope;
const runner = createCryptoRunner((event: PPXWorkerEvent) => {
  scope.postMessage(event);
});

scope.addEventListener("message", (event: MessageEvent<PPXWorkerRequest>) => {
  void runner.handle(event.data);
});
