import { afterEach, describe, expect, it, vi } from "vitest";
import type { LegacyV1WorkerRequest } from "../../workers/legacy-v1-contracts";
import {
  LegacyV1WorkerCancelled,
  startLegacyCompactTextDecryptJob,
  startLegacyRecoveryMigrationJob,
  startLegacyTextDecryptJob,
} from "../../workers/legacy-v1-client";

class FakeLegacyWorker extends EventTarget {
  readonly requests: LegacyV1WorkerRequest[] = [];
  readonly copies: LegacyV1WorkerRequest[] = [];
  readonly transferLists: Transferable[][] = [];
  terminated = false;

  postMessage(
    request: LegacyV1WorkerRequest,
    transferList: Transferable[] = [],
  ): void {
    this.requests.push(request);
    this.transferLists.push(transferList);
    this.copies.push(structuredClone(request, { transfer: transferList }));
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("legacy V1 worker client", () => {
  it("zeroizes request-owned buffers when postMessage fails before transfer", async () => {
    let captured: LegacyV1WorkerRequest | undefined;
    vi.stubGlobal(
      "Worker",
      class extends FakeLegacyWorker {
        override postMessage(request: LegacyV1WorkerRequest): void {
          captured = request;
          throw new Error("post failed");
        }
      },
    );
    const ppxqBytes = new Uint8Array(64).fill(21);
    const senderContactBytes = new Uint8Array(64).fill(22);
    const masterEntropy = new Uint8Array(32).fill(23);

    const job = startLegacyCompactTextDecryptJob({
      ppxqBytes,
      senderContactBytes,
      masterEntropy,
    });

    await expect(job.promise).rejects.toThrow("wrong-identity-or-corruption");
    if (captured?.kind !== "decrypt-compact-v1") {
      throw new Error("missing failed compact request");
    }
    expect(captured.input.ppxqBytes).toEqual(new Uint8Array(64));
    expect(captured.input.senderContactBytes).toEqual(new Uint8Array(64));
    expect(captured.input.masterEntropy).toEqual(new Uint8Array(32));
    expect(ppxqBytes).toEqual(new Uint8Array(64).fill(21));
    expect(senderContactBytes).toEqual(new Uint8Array(64).fill(22));
    expect(masterEntropy).toEqual(new Uint8Array(32).fill(23));
  });

  it("transfers cloned compact inputs without detaching caller-owned buffers", () => {
    const workers: FakeLegacyWorker[] = [];
    vi.stubGlobal(
      "Worker",
      class extends FakeLegacyWorker {
        constructor() {
          super();
          workers.push(this);
        }
      },
    );
    const ppxqBytes = new Uint8Array(64).fill(2);
    const senderContactBytes = new Uint8Array(64).fill(3);
    const masterEntropy = new Uint8Array(32).fill(4);

    const job = startLegacyCompactTextDecryptJob({
      ppxqBytes,
      senderContactBytes,
      masterEntropy,
    });

    const posted = workers[0]?.copies[0];
    const released = workers[0]?.requests[0];
    if (
      posted?.kind !== "decrypt-compact-v1" ||
      released?.kind !== "decrypt-compact-v1"
    ) {
      throw new Error("missing legacy compact request");
    }
    expect([...posted.input.ppxqBytes]).toEqual(Array(64).fill(2));
    expect([...posted.input.senderContactBytes]).toEqual(Array(64).fill(3));
    expect([...posted.input.masterEntropy]).toEqual(Array(32).fill(4));
    expect(released.input.ppxqBytes.byteLength).toBe(0);
    expect(released.input.senderContactBytes.byteLength).toBe(0);
    expect(released.input.masterEntropy.byteLength).toBe(0);
    expect(workers[0]?.transferLists[0]).toHaveLength(3);
    expect(ppxqBytes).toEqual(new Uint8Array(64).fill(2));
    expect(senderContactBytes).toEqual(new Uint8Array(64).fill(3));
    expect(masterEntropy).toEqual(new Uint8Array(32).fill(4));
    job.cancel();
    void job.promise.catch(() => undefined);
  });

  it("transfers only the cloned entropy seed", () => {
    const workers: FakeLegacyWorker[] = [];
    vi.stubGlobal(
      "Worker",
      class extends FakeLegacyWorker {
        constructor() {
          super();
          workers.push(this);
        }
      },
    );
    const masterEntropy = new Uint8Array(32).fill(5);

    const job = startLegacyTextDecryptJob({
      object: { magic: "PPXT" } as never,
      masterEntropy,
    });

    const posted = workers[0]?.copies[0];
    const released = workers[0]?.requests[0];
    if (
      posted?.kind !== "decrypt-text-v1" ||
      released?.kind !== "decrypt-text-v1"
    ) {
      throw new Error("missing legacy text request");
    }
    expect([...posted.input.masterEntropy]).toEqual(Array(32).fill(5));
    expect(released.input.masterEntropy.byteLength).toBe(0);
    expect(workers[0]?.transferLists[0]).toHaveLength(1);
    expect(masterEntropy).toEqual(new Uint8Array(32).fill(5));
    job.cancel();
    void job.promise.catch(() => undefined);
  });

  it("consumes private recovery bytes after copying them into the worker", () => {
    const workers: FakeLegacyWorker[] = [];
    vi.stubGlobal(
      "Worker",
      class extends FakeLegacyWorker {
        constructor() {
          super();
          workers.push(this);
        }
      },
    );
    const bytes = new Uint8Array(64).fill(6);

    const job = startLegacyRecoveryMigrationJob(bytes);

    const posted = workers[0]?.copies[0];
    if (posted?.kind !== "migrate-recovery-v1") {
      throw new Error("missing recovery request");
    }
    expect([...posted.input.bytes]).toEqual(Array(64).fill(6));
    expect(workers[0]?.requests[0]?.kind).toBe("migrate-recovery-v1");
    const released = workers[0]?.requests[0];
    if (released?.kind !== "migrate-recovery-v1") {
      throw new Error("missing released recovery request");
    }
    expect(released.input.bytes.byteLength).toBe(0);
    expect(workers[0]?.transferLists[0]).toHaveLength(1);
    expect(bytes).toEqual(new Uint8Array(64));
    job.cancel();
    void job.promise.catch(() => undefined);
  });

  it("waits for worker cancellation before terminating", async () => {
    const workers: FakeLegacyWorker[] = [];
    vi.stubGlobal(
      "Worker",
      class extends FakeLegacyWorker {
        constructor() {
          super();
          workers.push(this);
        }
      },
    );
    const job = startLegacyTextDecryptJob({
      object: { magic: "PPXT" } as never,
      masterEntropy: new Uint8Array(32).fill(7),
    });

    job.cancel();

    await expect(job.promise).rejects.toBeInstanceOf(LegacyV1WorkerCancelled);
    expect(workers[0]?.terminated).toBe(true);
    expect(workers[0]?.copies.map((request) => request.kind)).toEqual([
      "decrypt-text-v1",
      "cancel",
    ]);
  });

  it("zeroizes a migrated identity received after client cancellation", async () => {
    const completed = {
      suite: 2,
      masterEntropy: new Uint8Array(32).fill(8),
      kemSecretKey: new Uint8Array(32).fill(9),
      signingSecretKey: new Uint8Array(32).fill(10),
    };
    vi.stubGlobal(
      "Worker",
      class extends FakeLegacyWorker {
        override postMessage(
          request: LegacyV1WorkerRequest,
          transferList: Transferable[] = [],
        ): void {
          this.requests.push(request);
          this.transferLists.push(transferList);
          this.copies.push(
            structuredClone(request, { transfer: transferList }),
          );
          if (request.kind === "cancel") {
            queueMicrotask(() => {
              this.dispatchEvent(
                new MessageEvent("message", {
                  data: {
                    kind: "completed",
                    requestId: request.requestId,
                    result: completed,
                  },
                }),
              );
            });
          }
        }
      },
    );
    const job = startLegacyRecoveryMigrationJob(new Uint8Array(64).fill(11));

    job.cancel();

    await expect(job.promise).rejects.toBeInstanceOf(LegacyV1WorkerCancelled);
    expect(completed.masterEntropy).toEqual(new Uint8Array(32));
    expect(completed.kemSecretKey).toEqual(new Uint8Array(32));
    expect(completed.signingSecretKey).toEqual(new Uint8Array(32));
  });
});
