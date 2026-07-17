import { afterEach, describe, expect, it, vi } from "vitest";
import * as capabilityModule from "../../crypto/capability-v2";
import type { PPXFileWorkerRequest } from "../../crypto/contracts";
import type { DecryptFileSourceInputV2 } from "../../crypto/file-v2";
import type { DecapsulationCapabilityV2 } from "../../protocol/types-v2";
import {
  FileWorkerCancelled,
  startDecryptFileJob,
} from "../../workers/file-client";

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
): DecryptFileSourceInputV2 {
  return { object: new Blob(), activeIdentity };
}

class AuthoritativeCancelWorker extends EventTarget {
  readonly requests: PPXFileWorkerRequest[] = [];
  readonly requestCopies: PPXFileWorkerRequest[] = [];
  terminated = false;

  postMessage(request: PPXFileWorkerRequest): void {
    this.requests.push(request);
    this.requestCopies.push(structuredClone(request));
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

describe("Cat-5 V2 file worker client", () => {
  it("clones only ML-KEM decapsulation authority into a PPXF request", () => {
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
    const activeIdentity = {
      ...decapsulationCapability(),
      masterEntropy: new Uint8Array([3]),
      signingSecretKey: new Uint8Array([4]),
    };

    const job = startDecryptFileJob(decryptInput(activeIdentity));
    const posted = workers[0]?.requestCopies[0];
    if (posted?.kind !== "decrypt-file") {
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
    if (requestOwned?.kind !== "decrypt-file") {
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

  it("waits for authoritative cancelled event before termination", async () => {
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
    const job = startDecryptFileJob(decryptInput(decapsulationCapability()));
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

  it("wipes request-owned authority when postMessage fails", async () => {
    let captured: PPXFileWorkerRequest | undefined;
    vi.stubGlobal(
      "Worker",
      class extends EventTarget {
        postMessage(request: PPXFileWorkerRequest): void {
          captured = request;
          throw new Error("post failed");
        }
        terminate(): void {}
      },
    );

    const job = startDecryptFileJob(decryptInput(decapsulationCapability()));
    await expect(job.promise).rejects.toThrow("wrong-identity-or-corruption");
    if (captured?.kind !== "decrypt-file") throw new Error("missing request");
    expect(captured.input.activeIdentity.kemSecretKey).toEqual(
      new Uint8Array(3168),
    );
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

    expect(() => startDecryptFileJob(decryptInput(activeIdentity))).toThrow(
      "constructor failed",
    );
    expect(wipe).toHaveBeenCalledOnce();
    expect(wipe.mock.calls[0]?.[0].kemSecretKey).toEqual(new Uint8Array(3168));
    expect(activeIdentity.kemSecretKey).toEqual(new Uint8Array(3168).fill(7));
  });

  it("wipes request-owned authority immediately after a successful post", async () => {
    let captured: PPXFileWorkerRequest | undefined;
    vi.stubGlobal(
      "Worker",
      class extends EventTarget {
        postMessage(request: PPXFileWorkerRequest): void {
          captured = request;
          queueMicrotask(() => {
            this.dispatchEvent(
              new MessageEvent("message", {
                data: {
                  kind: "completed",
                  requestId: request.requestId,
                  result: { filename: "done" },
                },
              }),
            );
          });
        }
        terminate(): void {}
      },
    );

    const job = startDecryptFileJob(decryptInput(decapsulationCapability()));
    await expect(job.promise).resolves.toMatchObject({ filename: "done" });
    if (captured?.kind !== "decrypt-file") throw new Error("missing request");
    expect(captured.input.activeIdentity.kemSecretKey).toEqual(
      new Uint8Array(3168),
    );
  });
});
