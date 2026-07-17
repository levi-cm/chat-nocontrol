import { afterEach, describe, expect, it, vi } from "vitest";
import type { PPXCryptoWorkerRequest } from "../../crypto/contracts";
import * as capabilityModule from "../../crypto/capability-v2";
import type {
  DecapsulationCapabilityV2,
  DecryptTextInputV2,
} from "../../protocol/types-v2";
import { startDecryptTextJob } from "../../workers/crypto-client";

function decapsulationCapability(value = 7): DecapsulationCapabilityV2 {
  return {
    suite: 0x02,
    fingerprint: new Uint8Array(32).fill(1),
    identityId: new Uint8Array(20).fill(2),
    kemSecretKey: new Uint8Array(3168).fill(value),
  };
}

function decryptInput(
  activeIdentity: DecapsulationCapabilityV2,
): DecryptTextInputV2 {
  return {
    object: { magic: "PPXT" } as never,
    activeIdentity,
    knownSenders: [],
  };
}

class TrackedCryptoWorker extends EventTarget {
  readonly requests: PPXCryptoWorkerRequest[] = [];
  readonly requestCopies: PPXCryptoWorkerRequest[] = [];
  terminated = false;

  constructor(
    private readonly onStart: () => void,
    private readonly onTerminate: () => void,
  ) {
    super();
    this.onStart();
  }

  postMessage(request: PPXCryptoWorkerRequest): void {
    this.requests.push(request);
    this.requestCopies.push(structuredClone(request));
  }

  terminate(): void {
    if (this.terminated) return;
    this.terminated = true;
    this.onTerminate();
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Cat-5 V2 crypto worker client", () => {
  it("clones only ML-KEM decapsulation authority into a decrypt request", () => {
    const workers: TrackedCryptoWorker[] = [];
    vi.stubGlobal(
      "Worker",
      class extends TrackedCryptoWorker {
        constructor() {
          super(
            () => undefined,
            () => undefined,
          );
          workers.push(this);
        }
      },
    );
    const activeIdentity = {
      ...decapsulationCapability(),
      masterEntropy: new Uint8Array([3]),
      signingSecretKey: new Uint8Array([4]),
    };

    const job = startDecryptTextJob(decryptInput(activeIdentity));
    const posted = workers[0]?.requestCopies[0];
    if (posted?.kind !== "decrypt-text") {
      throw new Error("expected decrypt request");
    }

    expect(Object.keys(posted.input.activeIdentity).sort()).toEqual([
      "fingerprint",
      "identityId",
      "kemSecretKey",
      "suite",
    ]);
    expect(posted.input.activeIdentity).not.toBe(activeIdentity);
    expect(posted.input.activeIdentity).not.toHaveProperty("masterEntropy");
    expect(posted.input.activeIdentity).not.toHaveProperty("signingSecretKey");
    const requestOwned = workers[0]?.requests[0];
    if (requestOwned?.kind !== "decrypt-text") {
      throw new Error("expected request-owned decrypt authority");
    }
    expect(requestOwned.input.activeIdentity.kemSecretKey).toEqual(
      new Uint8Array(3168),
    );
    expect([...posted.input.activeIdentity.kemSecretKey]).toEqual(
      Array(3168).fill(7),
    );
    expect(activeIdentity.kemSecretKey).toEqual(new Uint8Array(3168).fill(7));
    job.cancel();
    void job.promise.catch(() => undefined);
  });

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

    const input = decryptInput(decapsulationCapability());
    const first = startDecryptTextJob(input);
    const firstResult = first.promise.catch((error: unknown) => error);
    first.cancel();
    const liveWorkersAfterCancel = liveWorkers;
    const replacement = startDecryptTextJob(input);
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

  it("wipes request-owned authority when Worker construction fails", () => {
    const wipe = vi.spyOn(capabilityModule, "zeroizeDecapsulationCapabilityV2");
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("constructor failed");
        }
      },
    );
    const activeIdentity = decapsulationCapability();

    expect(() => startDecryptTextJob(decryptInput(activeIdentity))).toThrow(
      "constructor failed",
    );
    expect(wipe).toHaveBeenCalledOnce();
    expect(wipe.mock.calls[0]?.[0].kemSecretKey).toEqual(new Uint8Array(3168));
    expect(activeIdentity.kemSecretKey).toEqual(new Uint8Array(3168).fill(7));
  });

  it("wipes request-owned authority when postMessage fails", async () => {
    let captured: PPXCryptoWorkerRequest | undefined;
    vi.stubGlobal(
      "Worker",
      class extends EventTarget {
        postMessage(request: PPXCryptoWorkerRequest): void {
          captured = request;
          throw new Error("post failed");
        }
        terminate(): void {}
      },
    );

    const job = startDecryptTextJob(decryptInput(decapsulationCapability()));
    await expect(job.promise).rejects.toThrow("wrong-identity-or-corruption");
    if (captured?.kind !== "decrypt-text") throw new Error("missing request");
    expect(captured.input.activeIdentity.kemSecretKey).toEqual(
      new Uint8Array(3168),
    );
  });

  it("wipes request-owned authority immediately after a successful post", async () => {
    let captured: PPXCryptoWorkerRequest | undefined;
    vi.stubGlobal(
      "Worker",
      class extends EventTarget {
        postMessage(request: PPXCryptoWorkerRequest): void {
          captured = request;
          queueMicrotask(() => {
            this.dispatchEvent(
              new MessageEvent("message", {
                data: {
                  kind: "completed",
                  requestId: request.requestId,
                  result: { plaintext: "done" },
                },
              }),
            );
          });
        }
        terminate(): void {}
      },
    );

    const job = startDecryptTextJob(decryptInput(decapsulationCapability()));
    await expect(job.promise).resolves.toMatchObject({ plaintext: "done" });
    if (captured?.kind !== "decrypt-text") throw new Error("missing request");
    expect(captured.input.activeIdentity.kemSecretKey).toEqual(
      new Uint8Array(3168),
    );
  });
});
