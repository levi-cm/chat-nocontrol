import { afterEach, describe, expect, it, vi } from "vitest";
import type { PPXWorkerRequest } from "../../crypto/contracts";
import type {
  DecryptQrTextInput,
  DecryptTextInput,
} from "../../protocol/types";
import {
  startDecryptQrTextJob,
  startDecryptTextJob,
} from "../../workers/crypto-client";

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
  it.each([
    ["text", startDecryptTextJob, { object: {} }],
    ["QR text", startDecryptQrTextJob, { object: {}, knownSenders: [] }],
  ] as const)(
    "sends only decapsulation authority to the %s decrypt worker",
    (_label, startJob, requestFields) => {
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
        masterEntropy: new Uint8Array([1]),
        signingSecretKey: new Uint8Array([2]),
        kemSecretKey: new Uint8Array([3]),
        x25519SecretKey: new Uint8Array([4]),
        fingerprint: new Uint8Array([5]),
        identityId: new Uint8Array([6]),
      };

      const job = startJob({
        ...requestFields,
        activeIdentity,
      } as unknown as DecryptTextInput & DecryptQrTextInput);
      const posted = workers[0]?.requests[0];
      if (
        posted?.kind !== "decrypt-text" &&
        posted?.kind !== "decrypt-qr-text"
      ) {
        throw new Error("expected decrypt request");
      }

      expect(Object.keys(posted.input.activeIdentity).sort()).toEqual([
        "fingerprint",
        "identityId",
        "kemSecretKey",
        "x25519SecretKey",
      ]);
      expect(posted.input.activeIdentity).not.toBe(activeIdentity);
      job.cancel();
      void job.promise.catch(() => undefined);
    },
  );

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

    const decryptInput = {
      object: {},
      activeIdentity: {
        fingerprint: new Uint8Array(32),
        identityId: new Uint8Array(20),
        kemSecretKey: new Uint8Array(1632),
        x25519SecretKey: new Uint8Array(32),
      },
    } as DecryptTextInput;
    const first = startDecryptTextJob(decryptInput);
    const firstResult = first.promise.catch((error: unknown) => error);
    first.cancel();
    const liveWorkersAfterCancel = liveWorkers;
    const replacement = startDecryptTextJob(decryptInput);
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
