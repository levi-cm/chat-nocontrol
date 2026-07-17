import { beforeAll, describe, expect, it } from "vitest";
import type {
  PPXFileWorkerRequest,
  PPXWorkerEvent,
} from "../../crypto/contracts";
import {
  createDecapsulationCapabilityV2,
  createSenderSigningCapabilityV2,
  deriveIdentityV2FromEntropy,
} from "../../crypto/identity-v2";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import type {
  DerivedIdentityV2,
  PublicContactV2,
} from "../../protocol/types-v2";
import { createFileRunner } from "../../workers/file-runner";

const fill = (length: number, value: number) =>
  new Uint8Array(length).fill(value);

describe("Cat-5 V2 PPXF file-only runner", () => {
  let aliceIdentity: DerivedIdentityV2;
  let bobIdentity: DerivedIdentityV2;
  let alice: PublicContactV2;
  let bob: PublicContactV2;

  beforeAll(async () => {
    aliceIdentity = await deriveIdentityV2FromEntropy(fill(32, 61), "Alice");
    bobIdentity = await deriveIdentityV2FromEntropy(fill(32, 62), "Bob");
    alice = createPublicContactV2(aliceIdentity, "Alice", 1n, fill(32, 63));
    bob = createPublicContactV2(bobIdentity, "Bob", 2n, fill(32, 64));
  });

  function encryptRequest(size: number): PPXFileWorkerRequest {
    return {
      kind: "encrypt-file",
      requestId: `encrypt-${size}`,
      input: {
        sender: alice,
        senderSigningCapability: createSenderSigningCapabilityV2(aliceIdentity),
        recipient: bob,
        file: new Blob([new Uint8Array(size)]),
        filename: "worker.bin",
        mimeHint: "application/octet-stream",
        caption: "",
        fileLength: BigInt(size),
      },
    };
  }

  it("wipes worker-owned ML-KEM-1024 authority after PPXF decrypt failure", async () => {
    const capability = createDecapsulationCapabilityV2(bobIdentity);
    const runner = createFileRunner(() => undefined);

    await runner.handle({
      kind: "decrypt-file",
      requestId: "wipe-decrypt-file",
      input: { object: new Blob(), activeIdentity: capability },
    });

    expect(capability.kemSecretKey).toEqual(new Uint8Array(3168));
  });

  it("rejects and wipes a non-Cat-5 suite at the worker boundary", async () => {
    const events: PPXWorkerEvent[] = [];
    const capability = {
      suite: 1,
      fingerprint: fill(32, 1),
      identityId: fill(20, 2),
      kemSecretKey: fill(3168, 7),
    };
    const runner = createFileRunner((event) => events.push(event));

    await runner.handle({
      kind: "decrypt-file",
      requestId: "unsupported-file-suite",
      input: {
        object: new Blob(),
        activeIdentity: capability as never,
      },
    });

    expect(events).toContainEqual({
      kind: "error",
      requestId: "unsupported-file-suite",
      code: "unknown-suite",
    });
    expect(capability.kemSecretKey).toEqual(new Uint8Array(3168));
  });

  it("emits progress and one canonical PPXF completion", async () => {
    const events: PPXWorkerEvent[] = [];
    const runner = createFileRunner((event) => events.push(event));
    await runner.handle(encryptRequest(1));

    expect(events.some((event) => event.kind === "progress")).toBe(true);
    const completed = events.filter((event) => event.kind === "completed");
    expect(completed).toHaveLength(1);
    const result = completed[0]?.result;
    if (!result || !("blob" in result) || !("encodedLength" in result)) {
      throw new Error("missing encrypted PPXF Blob result");
    }
    expect(
      new TextDecoder().decode(await result.blob.slice(0, 4).arrayBuffer()),
    ).toBe("PPXF");
    expect(events.some((event) => event.kind === "error")).toBe(false);
  }, 30_000);

  it("cancels an active PPXF request without completed output", async () => {
    const events: PPXWorkerEvent[] = [];
    const runner = createFileRunner((event) => events.push(event));
    const request = encryptRequest(2_097_152);
    const running = runner.handle(request);
    await runner.handle({ kind: "cancel", requestId: request.requestId });
    await running;

    expect(events.filter((event) => event.kind === "cancelled")).toHaveLength(
      1,
    );
    expect(events.some((event) => event.kind === "completed")).toBe(false);
  }, 30_000);
});
