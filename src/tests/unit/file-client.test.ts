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
    const posted = workers[0]?.requests[0];
    if (posted?.kind !== "decrypt-file") {
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
});
