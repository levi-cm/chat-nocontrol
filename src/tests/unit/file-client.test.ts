import { afterEach, describe, expect, it, vi } from "vitest";
import type { PPXWorkerRequest } from "../../crypto/contracts";
import type { DecryptFileInput } from "../../protocol/types";
import {
  FileWorkerCancelled,
  startDecryptFileJob,
} from "../../workers/file-client";

class AuthoritativeCancelWorker extends EventTarget {
  readonly requests: PPXWorkerRequest[] = [];
  terminated = false;

  postMessage(request: PPXWorkerRequest): void {
    this.requests.push(request);
    if (request.kind === "cancel") {
      queueMicrotask(() => {
        this.dispatchEvent(
          new MessageEvent("message", {
            data: { kind: "cancelled", requestId: request.requestId },
          }),
        );
      });
    }
  }

  terminate(): void {
    this.terminated = true;
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("file worker client cancellation", () => {
  it("waits for the authoritative cancelled event before termination", async () => {
    const workers: AuthoritativeCancelWorker[] = [];
    vi.stubGlobal(
      "Worker",
      class extends AuthoritativeCancelWorker {
        constructor() {
          super();
          workers.push(this);
        }
      },
    );
    const job = startDecryptFileJob({} as DecryptFileInput);
    const worker = workers[0];
    expect(worker).toBeDefined();

    job.cancel();
    expect(worker?.terminated).toBe(false);
    await expect(job.promise).rejects.toBeInstanceOf(FileWorkerCancelled);
    expect(worker?.requests.map((request) => request.kind)).toEqual([
      "decrypt-file",
      "cancel",
    ]);
    expect(worker?.terminated).toBe(true);
  });
});
