import { afterEach, describe, expect, it, vi } from "vitest";
import type { PPXCryptoWorkerRequest } from "../../crypto/contracts";
import type {
  DecapsulationCapabilityV2,
  DecryptTextInputV2,
  DerivedIdentityV2,
  EncryptedTextObjectV2,
  EncryptTextInputV2,
  LockedVaultObjectV2,
  PublicContactV2,
} from "../../protocol/types-v2";
import {
  startDecryptTextJob,
  startEncryptTextJob,
  startLockVaultJob,
  startUnlockVaultJob,
} from "../../workers/crypto-client";

const fill = (length: number, value: number) =>
  new Uint8Array(length).fill(value);

function decapsulationCapability(value = 7): DecapsulationCapabilityV2 {
  return {
    suite: 0x02,
    fingerprint: fill(32, 1),
    identityId: fill(20, 2),
    kemSecretKey: fill(3168, value),
  };
}

function contact(value: number): PublicContactV2 {
  return {
    magic: "PPXC",
    formatVersion: 2,
    suite: 2,
    creationTime: 1n,
    pseudonym: `Contact ${value}`,
    kemPublicKey: fill(1568, value),
    signingPublicKey: fill(2592, value + 1),
    selfSignature: fill(4627, value + 2),
    checksum: fill(16, value + 3),
    fingerprint: fill(32, value + 4),
    identityId: fill(20, value + 5),
  };
}

function encryptedText(value = 10): EncryptedTextObjectV2 {
  return {
    magic: "PPXT",
    formatVersion: 2,
    suite: 2,
    flags: 0,
    mlKemCiphertext: fill(1568, value),
    salt: fill(32, value + 1),
    nonce: fill(12, value + 2),
    ciphertextLength: 32,
    ciphertext: fill(32, value + 3),
    checksum: fill(16, value + 4),
  };
}

function vault(value = 20): LockedVaultObjectV2 {
  return {
    magic: "PPXV",
    formatVersion: 2,
    suite: 2,
    flags: 1,
    kdfId: 1,
    scryptN: 65_536,
    scryptR: 8,
    scryptP: 2,
    salt: fill(16, value),
    nonce: fill(12, value + 1),
    ciphertextLength: 64,
    ciphertext: fill(64, value + 2),
    checksum: fill(16, value + 3),
  };
}

function decryptInput(
  activeIdentity: DecapsulationCapabilityV2,
): DecryptTextInputV2 {
  return {
    object: encryptedText(),
    activeIdentity,
    knownSenders: [contact(30)],
  };
}

class TrackedCryptoWorker extends EventTarget {
  readonly requests: PPXCryptoWorkerRequest[] = [];
  readonly requestCopies: PPXCryptoWorkerRequest[] = [];
  readonly transferLists: Transferable[][] = [];
  terminated = false;

  postMessage(
    request: PPXCryptoWorkerRequest,
    transferList: Transferable[] = [],
  ): void {
    this.requests.push(request);
    this.transferLists.push(transferList);
    this.requestCopies.push(
      structuredClone(request, { transfer: transferList }),
    );
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Cat-5 V2 crypto worker client", () => {
  it("transfers a minimal decrypt request and consumes caller authority", () => {
    const workers: TrackedCryptoWorker[] = [];
    vi.stubGlobal(
      "Worker",
      class extends TrackedCryptoWorker {
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
    const input = decryptInput(activeIdentity);

    const job = startDecryptTextJob(input);
    const posted = workers[0]?.requestCopies[0];
    const released = workers[0]?.requests[0];
    if (posted?.kind !== "decrypt-text" || released?.kind !== "decrypt-text") {
      throw new Error("expected decrypt request");
    }

    expect(Object.keys(posted.input.activeIdentity).sort()).toEqual([
      "fingerprint",
      "identityId",
      "kemSecretKey",
      "suite",
    ]);
    expect(posted.input.activeIdentity).not.toHaveProperty("masterEntropy");
    expect(posted.input.activeIdentity).not.toHaveProperty("signingSecretKey");
    expect(released.input.activeIdentity.kemSecretKey.byteLength).toBe(0);
    expect(released.input.object.ciphertext.byteLength).toBe(0);
    expect([...posted.input.activeIdentity.kemSecretKey]).toEqual(
      Array(3168).fill(7),
    );
    expect(activeIdentity.kemSecretKey.byteLength).toBe(0);
    expect(input.object.ciphertext).toEqual(fill(32, 13));
    expect(workers[0]?.transferLists[0]?.length ?? 0).toBeGreaterThan(8);
    job.cancel();
    void job.promise.catch(() => undefined);
  });

  it("transfers an encrypt request and consumes signing authority", () => {
    const workers: TrackedCryptoWorker[] = [];
    vi.stubGlobal(
      "Worker",
      class extends TrackedCryptoWorker {
        constructor() {
          super();
          workers.push(this);
        }
      },
    );
    const senderSigningCapability = {
      suite: 2 as const,
      fingerprint: fill(32, 41),
      signingPublicKey: fill(2592, 42),
      signingSecretKey: fill(4896, 43),
      masterEntropy: fill(32, 44),
    };
    const input: EncryptTextInputV2 = {
      compact: false,
      sender: contact(40),
      senderSigningCapability,
      recipient: contact(50),
      plaintext: "secret text",
      messageId: fill(16, 51),
      sentAt: 2n,
      createdAt: 3n,
    };

    const job = startEncryptTextJob(input);
    const posted = workers[0]?.requestCopies[0];
    const released = workers[0]?.requests[0];
    if (posted?.kind !== "encrypt-text" || released?.kind !== "encrypt-text") {
      throw new Error("expected encrypt request");
    }

    expect(posted.input.senderSigningCapability).not.toHaveProperty(
      "masterEntropy",
    );
    expect(
      released.input.senderSigningCapability.signingSecretKey.byteLength,
    ).toBe(0);
    expect([...posted.input.senderSigningCapability.signingSecretKey]).toEqual(
      Array(4896).fill(43),
    );
    expect(senderSigningCapability.signingSecretKey.byteLength).toBe(0);
    expect(input.messageId).toEqual(fill(16, 51));
    job.cancel();
    void job.promise.catch(() => undefined);
  });

  it("sends only the minimal vault-lock capability", () => {
    const workers: TrackedCryptoWorker[] = [];
    vi.stubGlobal(
      "Worker",
      class extends TrackedCryptoWorker {
        constructor() {
          super();
          workers.push(this);
        }
      },
    );
    const identity = {
      masterEntropy: fill(32, 61),
      creationTime: 4n,
      pseudonym: "Alice",
      kemSecretKey: fill(3168, 62),
      signingSecretKey: fill(4896, 63),
    } as DerivedIdentityV2;

    const job = startLockVaultJob({ identity, passphrase: "passphrase" });
    const posted = workers[0]?.requestCopies[0];
    const released = workers[0]?.requests[0];
    if (posted?.kind !== "lock-vault" || released?.kind !== "lock-vault") {
      throw new Error("expected lock request");
    }

    expect(Object.keys(posted.input.identity).sort()).toEqual([
      "creationTime",
      "masterEntropy",
      "pseudonym",
    ]);
    expect(posted.input.identity).not.toHaveProperty("kemSecretKey");
    expect(posted.input.identity).not.toHaveProperty("signingSecretKey");
    expect(released.input.identity.masterEntropy.byteLength).toBe(0);
    expect(identity.masterEntropy).toEqual(fill(32, 61));
    expect(identity.kemSecretKey).toEqual(fill(3168, 62));
    job.cancel();
    void job.promise.catch(() => undefined);
  });

  it("transfers a cloned vault into unlock without detaching the caller", () => {
    const workers: TrackedCryptoWorker[] = [];
    vi.stubGlobal(
      "Worker",
      class extends TrackedCryptoWorker {
        constructor() {
          super();
          workers.push(this);
        }
      },
    );
    const callerVault = vault();

    const job = startUnlockVaultJob({
      vault: callerVault,
      passphrase: "passphrase",
    });
    const posted = workers[0]?.requestCopies[0];
    const released = workers[0]?.requests[0];
    if (posted?.kind !== "unlock-vault" || released?.kind !== "unlock-vault") {
      throw new Error("expected unlock request");
    }

    expect(released.input.vault.ciphertext.byteLength).toBe(0);
    expect([...posted.input.vault.ciphertext]).toEqual(Array(64).fill(22));
    expect(callerVault.ciphertext).toEqual(fill(64, 22));
    job.cancel();
    void job.promise.catch(() => undefined);
  });

  it("zeroizes every request-owned buffer when postMessage fails", async () => {
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
    const input = decryptInput(decapsulationCapability());

    const job = startDecryptTextJob(input);
    await expect(job.promise).rejects.toThrow("wrong-identity-or-corruption");
    if (captured?.kind !== "decrypt-text") throw new Error("missing request");
    expect(captured.input.activeIdentity.kemSecretKey).toEqual(fill(3168, 0));
    expect(captured.input.object.ciphertext).toEqual(fill(32, 0));
    expect(captured.input.knownSenders[0]?.kemPublicKey).toEqual(fill(1568, 0));
    expect(input.activeIdentity.kemSecretKey).toEqual(fill(3168, 0));
    expect(input.object.ciphertext).toEqual(fill(32, 13));
  });

  it("waits for cancellation acknowledgement and wipes a late identity", async () => {
    const lateIdentity = {
      suite: 2,
      masterEntropy: fill(32, 71),
      kemSecretKey: fill(3168, 72),
      signingSecretKey: fill(4896, 73),
    } as DerivedIdentityV2;
    const workers: TrackedCryptoWorker[] = [];
    vi.stubGlobal(
      "Worker",
      class extends TrackedCryptoWorker {
        constructor() {
          super();
          workers.push(this);
        }
        override postMessage(
          request: PPXCryptoWorkerRequest,
          transferList: Transferable[] = [],
        ): void {
          if (request.kind !== "cancel") {
            super.postMessage(request, transferList);
            return;
          }
          this.requests.push(request);
          queueMicrotask(() => {
            this.dispatchEvent(
              new MessageEvent("message", {
                data: {
                  kind: "completed",
                  requestId: request.requestId,
                  result: lateIdentity,
                },
              }),
            );
          });
        }
      },
    );
    const job = startUnlockVaultJob({
      vault: vault(),
      passphrase: "passphrase",
    });

    job.cancel();

    await expect(job.promise).rejects.toThrow("cancelled");
    expect(lateIdentity.masterEntropy).toEqual(fill(32, 0));
    expect(lateIdentity.kemSecretKey).toEqual(fill(3168, 0));
    expect(lateIdentity.signingSecretKey).toEqual(fill(4896, 0));
    expect(workers[0]?.terminated).toBe(true);
    expect(workers[0]?.requests.map((request) => request.kind)).toEqual([
      "unlock-vault",
      "cancel",
    ]);
  });
});
