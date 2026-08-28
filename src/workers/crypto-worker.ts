/// <reference lib="webworker" />

import type {
  PPXCryptoWorkerRequest,
  PPXWorkerEvent,
} from "../crypto/contracts";
import {
  createCryptoRunner,
  cryptoEventTransferList,
  zeroizeCryptoTransferList,
} from "./crypto-runner";

const scope = self as DedicatedWorkerGlobalScope;
const runner = createCryptoRunner((event: PPXWorkerEvent) => {
  const transferList = cryptoEventTransferList(event);
  try {
    scope.postMessage(event, transferList);
  } catch (error) {
    zeroizeCryptoTransferList(transferList);
    throw error;
  }
});

scope.addEventListener(
  "message",
  (event: MessageEvent<PPXCryptoWorkerRequest>) => {
    void runner.handle(event.data).catch(() => undefined);
  },
);
