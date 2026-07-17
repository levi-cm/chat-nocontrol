import { afterEach, describe, expect, it, vi } from "vitest";
import type { PPXWorkerRequest } from "../../crypto/contracts";
import type { DecryptFileInput } from "../../protocol/types";
import {
  FileWorkerCancelled,
  startDecryptFileJob,
} from "../../workers/file-client";
import * as capabilityModule from "../../crypto/decapsulation-capability";

class AuthoritativeCancelWorker extends EventTarget {
  readonly requests: PPXWorkerRequest[] = [];
  readonly requestCopies: PPXWorkerRequest[] = [];
  terminated = false;

  postMessage(request: PPXWorkerRequest): void {
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

describe("file worker client cancellation", () => {
  it("sends only decapsulation authority to the decrypt worker", () => {
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
      suite: 1,
      masterEntropy: new Uint8Array([1]),
      signingSecretKey: new Uint8Array([2]),
      kemSecretKey: new Uint8Array([3]),
      x25519SecretKey: new Uint8Array([4]),
      fingerprint: new Uint8Array([5]),
      identityId: new Uint8Array([6]),
    };

    const job = startDecryptFileJob({
      object: {},
      activeIdentity,
    } as unknown as DecryptFileInput);
    const posted = workers[0]?.requestCopies[0];
    if (posted?.kind !== "decrypt-file") {
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
    if (requestOwned?.kind !== "decrypt-file") {
      throw new Error("expected request-owned decrypt authority");
    }
    expect(requestOwned.input.activeIdentity.kemSecretKey).toEqual(
      new Uint8Array([0]),
    );
    expect([...posted.input.activeIdentity.kemSecretKey]).toEqual([3]);
    job.cancel();
    void job.promise.catch(() => undefined);
  });

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
    const job = startDecryptFileJob({
      object: {},
      activeIdentity: {
        suite: 1,
        fingerprint: new Uint8Array(32),
        identityId: new Uint8Array(20),
        kemSecretKey: new Uint8Array(1632),
        x25519SecretKey: new Uint8Array(32),
      },
    } as DecryptFileInput);
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

    const job = startDecryptFileJob({
      object: {},
      activeIdentity: {
        suite: 1,
        fingerprint: new Uint8Array([1]),
        identityId: new Uint8Array([2]),
        kemSecretKey: new Uint8Array([3]),
        x25519SecretKey: new Uint8Array([4]),
      },
    } as DecryptFileInput);
    await expect(job.promise).rejects.toThrow("wrong-identity-or-corruption");
    if (captured?.kind !== "decrypt-file") throw new Error("missing request");
    expect(captured.input.activeIdentity.kemSecretKey).toEqual(
      new Uint8Array([0]),
    );
    expect(captured.input.activeIdentity.x25519SecretKey).toEqual(
      new Uint8Array([0]),
    );
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
      startDecryptFileJob({ object: {}, activeIdentity } as DecryptFileInput),
    ).toThrow("constructor failed");
    expect(wipe).toHaveBeenCalledOnce();
    expect(wipe.mock.calls[0]?.[0].kemSecretKey).toEqual(new Uint8Array([0]));
    expect(activeIdentity.kemSecretKey).toEqual(new Uint8Array([3]));
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
                  result: { filename: "done" },
                },
              }),
            );
          });
        }
        terminate(): void {}
      },
    );

    const job = startDecryptFileJob({
      object: {},
      activeIdentity: {
        suite: 1,
        fingerprint: new Uint8Array([1]),
        identityId: new Uint8Array([2]),
        kemSecretKey: new Uint8Array([3]),
        x25519SecretKey: new Uint8Array([4]),
      },
    } as DecryptFileInput);
    await expect(job.promise).resolves.toMatchObject({ filename: "done" });
    if (captured?.kind !== "decrypt-file") throw new Error("missing request");
    expect(captured.input.activeIdentity.kemSecretKey).toEqual(
      new Uint8Array([0]),
    );
    expect(captured.input.activeIdentity.x25519SecretKey).toEqual(
      new Uint8Array([0]),
    );
  });
});
