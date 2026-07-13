import { classifyScannedText } from "./scan-runner";

export interface ScanWorkerRequest {
  kind: "classify-scan";
  requestId: string;
  raw: string;
}

export type ScanWorkerResponse =
  | {
      kind: "classified-scan";
      requestId: string;
      classification: ReturnType<typeof classifyScannedText>;
    }
  | { kind: "scan-error"; requestId: string };

self.addEventListener("message", (event: MessageEvent<ScanWorkerRequest>) => {
  const request = event.data;
  if (request.kind !== "classify-scan") return;
  let response: ScanWorkerResponse;
  try {
    response = {
      kind: "classified-scan",
      requestId: request.requestId,
      classification: classifyScannedText(request.raw),
    };
  } catch {
    response = { kind: "scan-error", requestId: request.requestId };
  }
  self.postMessage(response);
});
