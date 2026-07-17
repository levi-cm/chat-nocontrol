/// <reference lib="webworker" />

import type {
  PPXCryptoWorkerRequest,
  PPXWorkerEvent,
} from "../crypto/contracts";
import { createCryptoRunner } from "./crypto-runner";

const scope = self as DedicatedWorkerGlobalScope;
const runner = createCryptoRunner((event: PPXWorkerEvent) => {
  scope.postMessage(event);
});

scope.addEventListener(
  "message",
  (event: MessageEvent<PPXCryptoWorkerRequest>) => {
    void runner.handle(event.data);
  },
);
