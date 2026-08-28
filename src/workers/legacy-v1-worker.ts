/// <reference lib="webworker" />

import type {
  LegacyV1WorkerEvent,
  LegacyV1WorkerRequest,
} from "./legacy-v1-contracts";
import {
  legacyV1EventTransferList,
  zeroizeLegacyV1TransferList,
} from "./legacy-v1-contracts";
import { createLegacyV1Runner } from "./legacy-v1-runner";

const scope = self as DedicatedWorkerGlobalScope;
const runner = createLegacyV1Runner((event: LegacyV1WorkerEvent) => {
  const transferList = legacyV1EventTransferList(event);
  try {
    scope.postMessage(event, transferList);
  } catch (error) {
    zeroizeLegacyV1TransferList(transferList);
    throw error;
  }
});

scope.addEventListener(
  "message",
  (message: MessageEvent<LegacyV1WorkerRequest>) => {
    void runner.handle(message.data);
  },
);
