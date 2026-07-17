import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCryptoProvider } from "../../crypto/default-provider";
import type { PPXWorkerEvent, PPXWorkerRequest } from "../../crypto/contracts";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { createPublicContact } from "../../protocol/ppxc";
import { createFileRunner } from "../../workers/file-runner";

async function encryptRequest(size: number): Promise<PPXWorkerRequest> {
  const alice = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(61),
    "Alice",
  );
  const bob = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(62),
    "Bob",
  );
  return {
    kind: "encrypt-file",
    requestId: `encrypt-${size}`,
    input: {
      sender: createPublicContact(alice, "Alice", 1n),
      senderSigningCapability: createSenderSigningCapability(alice),
      recipient: createPublicContact(bob, "Bob", 2n),
      file: new Blob([new Uint8Array(size)]),
      filename: "worker.bin",
      mimeHint: "application/octet-stream",
      caption: "",
      fileLength: BigInt(size),
    },
  };
}

describe("typed PPXF file runner", () => {
  afterEach(() => vi.restoreAllMocks());

  it("wipes worker-owned decapsulation secrets after file decrypt failure", async () => {
    const capability = {
      suite: 1 as const,
      fingerprint: new Uint8Array(32),
      identityId: new Uint8Array(20),
      kemSecretKey: new Uint8Array(1632).fill(7),
      x25519SecretKey: new Uint8Array(32).fill(8),
    };
    vi.spyOn(defaultCryptoProvider, "decryptFile").mockRejectedValue(
      new Error("injected failure"),
    );
    const runner = createFileRunner(() => undefined);

    await runner.handle({
      kind: "decrypt-file",
      requestId: "wipe-decrypt-file",
      input: { object: {} as never, activeIdentity: capability },
    });

    expect(capability.kemSecretKey).toEqual(new Uint8Array(1632));
    expect(capability.x25519SecretKey).toEqual(new Uint8Array(32));
  });

  it("rejects and wipes an unsupported decapsulation suite at the worker boundary", async () => {
    const events: PPXWorkerEvent[] = [];
    const capability = {
      suite: 2,
      fingerprint: new Uint8Array(32),
      identityId: new Uint8Array(20),
      kemSecretKey: new Uint8Array(1632).fill(7),
      x25519SecretKey: new Uint8Array(32).fill(8),
    };
    const decrypt = vi.spyOn(defaultCryptoProvider, "decryptFile");
    const runner = createFileRunner((event) => events.push(event));

    await runner.handle({
      kind: "decrypt-file",
      requestId: "unsupported-file-suite",
      input: { object: {} as never, activeIdentity: capability as never },
    });

    expect(decrypt).not.toHaveBeenCalled();
    expect(events).toContainEqual({
      kind: "error",
      requestId: "unsupported-file-suite",
      code: "unknown-suite",
    });
    expect(capability.kemSecretKey).toEqual(new Uint8Array(1632));
    expect(capability.x25519SecretKey).toEqual(new Uint8Array(32));
  });

  it("emits progress and exactly one completed event", async () => {
    const events: PPXWorkerEvent[] = [];
    const runner = createFileRunner((event) => events.push(event));
    await runner.handle(await encryptRequest(1));

    expect(events.some((event) => event.kind === "progress")).toBe(true);
    expect(events.filter((event) => event.kind === "completed")).toHaveLength(
      1,
    );
    expect(events.some((event) => event.kind === "error")).toBe(false);
  });

  it("cancels an active request without completed output", async () => {
    const events: PPXWorkerEvent[] = [];
    const runner = createFileRunner((event) => events.push(event));
    const request = await encryptRequest(2_097_152);
    const running = runner.handle(request);
    await runner.handle({ kind: "cancel", requestId: request.requestId });
    await running;

    expect(events.filter((event) => event.kind === "cancelled")).toHaveLength(
      1,
    );
    expect(events.some((event) => event.kind === "completed")).toBe(false);
  });
});
