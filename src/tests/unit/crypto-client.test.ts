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
import * as capabilityModule from "../../crypto/decapsulation-capability";

class TrackedCryptoWorker extends EventTarget {
  readonly requests: PPXWorkerRequest[] = [];
  readonly requestCopies: PPXWorkerRequest[] = [];
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
        suite: 1,
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
      const posted = workers[0]?.requestCopies[0];
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
        "suite",
        "x25519SecretKey",
      ]);
      expect(posted.input.activeIdentity).not.toBe(activeIdentity);
      const requestOwned = workers[0]?.requests[0];
      if (
        requestOwned?.kind !== "decrypt-text" &&
        requestOwned?.kind !== "decrypt-qr-text"
      ) {
        throw new Error("expected request-owned decrypt authority");
      }
      expect(requestOwned.input.activeIdentity.kemSecretKey).toEqual(
        new Uint8Array([0]),
      );
      expect(requestOwned.input.activeIdentity.x25519SecretKey).toEqual(
        new Uint8Array([0]),
      );
      expect([...posted.input.activeIdentity.kemSecretKey]).toEqual([3]);
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
        suite: 1,
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

  it("wipes request-owned authority when Worker construction fails", () => {
    const wipe = vi.spyOn(capabilityModule, "zeroizeDecapsulationCapability");
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("constructor failed");
        }
      },
    );
    const activeIdentity = {
      suite: 1 as const,
      fingerprint: new Uint8Array([1]),
      identityId: new Uint8Array([2]),
      kemSecretKey: new Uint8Array([3]),
      x25519SecretKey: new Uint8Array([4]),
    };

    expect(() =>
      startDecryptTextJob({ object: {}, activeIdentity } as DecryptTextInput),
    ).toThrow("constructor failed");
    expect(wipe).toHaveBeenCalledOnce();
    expect(wipe.mock.calls[0]?.[0].kemSecretKey).toEqual(new Uint8Array([0]));
    expect(activeIdentity.kemSecretKey).toEqual(new Uint8Array([3]));
  });

  it("wipes request-owned authority when postMessage fails", async () => {
    let captured: PPXWorkerRequest | undefined;
    vi.stubGlobal(
      "Worker",
      class extends EventTarget {
        postMessage(request: PPXWorkerRequest): void {
          captured = request;
          throw new Error("post failed");
        }
        terminate(): void {}
      },
    );

    const job = startDecryptTextJob({
      object: {},
      activeIdentity: {
        suite: 1,
        fingerprint: new Uint8Array([1]),
        identityId: new Uint8Array([2]),
        kemSecretKey: new Uint8Array([3]),
        x25519SecretKey: new Uint8Array([4]),
      },
    } as DecryptTextInput);
    await expect(job.promise).rejects.toThrow("wrong-identity-or-corruption");
    if (captured?.kind !== "decrypt-text") throw new Error("missing request");
    expect(captured.input.activeIdentity.kemSecretKey).toEqual(
      new Uint8Array([0]),
    );
    expect(captured.input.activeIdentity.x25519SecretKey).toEqual(
      new Uint8Array([0]),
    );
  });

  it("wipes request-owned authority after a successful decrypt", async () => {
    let captured: PPXWorkerRequest | undefined;
    vi.stubGlobal(
      "Worker",
      class extends EventTarget {
        postMessage(request: PPXWorkerRequest): void {
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

    const job = startDecryptTextJob({
      object: {},
      activeIdentity: {
        suite: 1,
        fingerprint: new Uint8Array([1]),
        identityId: new Uint8Array([2]),
        kemSecretKey: new Uint8Array([3]),
        x25519SecretKey: new Uint8Array([4]),
      },
    } as DecryptTextInput);
    await expect(job.promise).resolves.toMatchObject({ plaintext: "done" });
    if (captured?.kind !== "decrypt-text") throw new Error("missing request");
    expect(captured.input.activeIdentity.kemSecretKey).toEqual(
      new Uint8Array([0]),
    );
    expect(captured.input.activeIdentity.x25519SecretKey).toEqual(
      new Uint8Array([0]),
    );
  });
});
