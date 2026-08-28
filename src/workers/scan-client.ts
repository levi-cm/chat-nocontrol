import { classifyScannedText, type ScannedQrKind } from "./scan-runner";
import type { ScanWorkerRequest, ScanWorkerResponse } from "./scan-worker";

let requestSequence = 0;
export const SCAN_WORKER_TIMEOUT_MS = 2_000;

function makeRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  requestSequence += 1;
  return `scan-${Date.now()}-${requestSequence}`;
}

export function classifyScannedQrInWorker(raw: string): Promise<ScannedQrKind> {
  if (typeof Worker !== "function") {
    return Promise.resolve().then(() => classifyScannedText(raw));
  }
  return new Promise<ScannedQrKind>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./scan-worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      void Promise.resolve()
        .then(() => classifyScannedText(raw))
        .then(resolve, reject);
      return;
    }
    const requestId = makeRequestId();
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      worker.terminate();
    };
    const finishLocally = () => {
      if (settled) return;
      settled = true;
      cleanup();
      void Promise.resolve()
        .then(() => classifyScannedText(raw))
        .then(resolve, reject);
    };
    const finishFromWorker = (classification: ScannedQrKind) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(classification);
    };
    const timeout = window.setTimeout(finishLocally, SCAN_WORKER_TIMEOUT_MS);
    worker.addEventListener(
      "message",
      (event: MessageEvent<ScanWorkerResponse>) => {
        if (event.data.requestId !== requestId) return;
        if (event.data.kind === "classified-scan") {
          finishFromWorker(event.data.classification);
        } else {
          finishLocally();
        }
      },
    );
    worker.addEventListener("error", finishLocally);
    worker.addEventListener("messageerror", finishLocally);
    const request: ScanWorkerRequest = {
      kind: "classify-scan",
      requestId,
      raw,
    };
    try {
      worker.postMessage(request);
    } catch {
      finishLocally();
    }
  });
}
