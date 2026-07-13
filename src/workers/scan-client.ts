import { classifyScannedText, type ScannedQrKind } from "./scan-runner";
import type { ScanWorkerRequest, ScanWorkerResponse } from "./scan-worker";

let requestSequence = 0;

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
    const worker = new Worker(new URL("./scan-worker.ts", import.meta.url), {
      type: "module",
    });
    const requestId = makeRequestId();
    const finish = () => worker.terminate();
    worker.addEventListener(
      "message",
      (event: MessageEvent<ScanWorkerResponse>) => {
        if (event.data.requestId !== requestId) return;
        finish();
        if (event.data.kind === "classified-scan") {
          resolve(event.data.classification);
        } else {
          reject(new Error("QR classification failed"));
        }
      },
    );
    worker.addEventListener("error", () => {
      finish();
      reject(new Error("QR classification worker failed"));
    });
    const request: ScanWorkerRequest = {
      kind: "classify-scan",
      requestId,
      raw,
    };
    worker.postMessage(request);
  });
}
