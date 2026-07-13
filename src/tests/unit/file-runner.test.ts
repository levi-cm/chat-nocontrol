import { describe, expect, it } from "vitest";
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
