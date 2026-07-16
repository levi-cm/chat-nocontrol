import { afterEach, describe, expect, it, vi } from "vitest";
import type { PPXWorkerRequest } from "../../crypto/contracts";
import type { DecryptTextInput } from "../../protocol/types";
import { startDecryptTextJob } from "../../workers/crypto-client";

class TrackedCryptoWorker extends EventTarget {
  readonly requests: PPXWorkerRequest[] = [];
  terminated = false;

  constructor(
    private readonly onStart: () => void,
    private readonly onTerminate: () => void,
  ) {
    super();
    this.onStart();
  }

  postMessage(request: PPXWorkerRequest): void {
    this.requests.push(request);
  }

  terminate(): void {
    if (this.terminated) return;
    this.terminated = true;
    this.onTerminate();
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("crypto worker client cancellation", () => {
  it("terminates a cancelled decrypt worker before starting its replacement", async () => {
    vi.useFakeTimers();
    const workers: TrackedCryptoWorker[] = [];
    let liveWorkers = 0;
    let maximumLiveWorkers = 0;
    vi.stubGlobal(
      "Worker",
      class extends TrackedCryptoWorker {
        constructor() {
          super(
            () => {
              liveWorkers += 1;
              maximumLiveWorkers = Math.max(maximumLiveWorkers, liveWorkers);
            },
            () => {
              liveWorkers -= 1;
            },
          );
          workers.push(this);
        }
      },
    );

    const first = startDecryptTextJob({} as DecryptTextInput);
    const firstResult = first.promise.catch((error: unknown) => error);
    first.cancel();
    const liveWorkersAfterCancel = liveWorkers;
    const replacement = startDecryptTextJob({} as DecryptTextInput);
    const replacementResult = replacement.promise.catch(
      (error: unknown) => error,
    );
    replacement.cancel();

    await vi.runAllTimersAsync();

    expect(liveWorkersAfterCancel).toBe(0);
    expect(maximumLiveWorkers).toBe(1);
    expect(workers).toHaveLength(2);
    expect(workers.every((worker) => worker.terminated)).toBe(true);
    expect(workers[0]?.requests.map((request) => request.kind)).toEqual([
      "decrypt-text",
    ]);
    await expect(firstResult).resolves.toEqual(new Error("cancelled"));
    await expect(replacementResult).resolves.toEqual(new Error("cancelled"));
  });
});
