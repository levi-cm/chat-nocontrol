import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import type { PPXWorkerEvent } from "../src/crypto/contracts";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../src/crypto/identity";
import { gzipBytes, gunzipBytesBounded } from "../src/crypto/text-compression";
import { createPublicContact } from "../src/protocol/ppxc";
import type { EncryptedTextObject } from "../src/protocol/types";
import { createCryptoRunner } from "../src/workers/crypto-runner";

const encoder = new TextEncoder();

function deterministicNoise(length: number): string {
  let state = 0x1357_9bdf;
  return Array.from({ length }, () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return String.fromCharCode(0x4e00 + (state % 20_000));
  }).join("");
}

function deterministicBase64(length: number): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let state = 0x2468_ace1;
  return Array.from({ length }, () => {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
    return alphabet[state % alphabet.length];
  }).join("");
}

function percentile95(values: number[]): number {
  return (
    [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] ?? 0
  );
}

async function workerRoundTrip(plaintext: string, iteration: number) {
  const alice = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(71),
    "Alice",
  );
  const bob = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(72),
    "Bob",
  );
  const events: PPXWorkerEvent[] = [];
  const runner = createCryptoRunner((event) => events.push(event));
  const encryptStarted = performance.now();
  await runner.handle({
    kind: "encrypt-text",
    requestId: `encrypt-${iteration}`,
    input: {
      sender: createPublicContact(alice, "Alice", 1n),
      senderSigningCapability: createSenderSigningCapability(alice),
      recipient: createPublicContact(bob, "Bob", 2n),
      plaintext,
      messageId: new Uint8Array(16).fill(iteration),
      sentAt: 3n,
      createdAt: 3n,
    },
  });
  const encryptMs = performance.now() - encryptStarted;
  const encryptedEvent = events.find(
    (event) =>
      event.kind === "completed" && event.requestId === `encrypt-${iteration}`,
  );
  if (
    encryptedEvent?.kind !== "completed" ||
    !("ciphertext" in encryptedEvent.result)
  ) {
    throw new Error("worker encryption did not complete");
  }
  const object = encryptedEvent.result as EncryptedTextObject;
  const decryptStarted = performance.now();
  await runner.handle({
    kind: "decrypt-text",
    requestId: `decrypt-${iteration}`,
    input: { object, activeIdentity: bob },
  });
  const decryptMs = performance.now() - decryptStarted;
  const decryptedEvent = events.find(
    (event) =>
      event.kind === "completed" && event.requestId === `decrypt-${iteration}`,
  );
  if (
    decryptedEvent?.kind !== "completed" ||
    !("plaintext" in decryptedEvent.result) ||
    decryptedEvent.result.plaintext !== plaintext
  ) {
    throw new Error("worker decryption did not round-trip");
  }
  return { version: object.formatVersion, encryptMs, decryptMs };
}

const realPlan = await readFile(
  new URL("../Chat_NoControl_full_plan.md", import.meta.url),
  "utf8",
);
const corpora = [
  ["short-conversation", "Can we meet at 18:30? Yes, see you there."],
  ["real-plan", realPlan],
  [
    "repeated-markdown-256k",
    "## Heading\n\n- repeated secure note\n".repeat(7_200).slice(0, 262_000),
  ],
  ["high-entropy-unicode", deterministicNoise(87_000)],
  ["base64-like", deterministicBase64(249_600)],
] as const;

for (const [corpusIndex, [name, plaintext]] of corpora.entries()) {
  const input = encoder.encode(plaintext);
  if (input.byteLength > 262_144)
    throw new Error(`${name} exceeds plaintext limit`);
  const compressionTimes: number[] = [];
  const decompressionTimes: number[] = [];
  let compressed: Uint8Array<ArrayBufferLike> = new Uint8Array();
  for (let index = 0; index < 5; index += 1) {
    const compressionStarted = performance.now();
    compressed = await gzipBytes(input);
    compressionTimes.push(performance.now() - compressionStarted);
    const decompressionStarted = performance.now();
    const output = await gunzipBytesBounded(compressed, 264_000);
    decompressionTimes.push(performance.now() - decompressionStarted);
    if (output.byteLength !== input.byteLength)
      throw new Error(`${name} gzip mismatch`);
  }
  const worker = await workerRoundTrip(plaintext, corpusIndex + 1);
  const savedPercent =
    input.byteLength === 0
      ? 0
      : ((input.byteLength - compressed.byteLength) / input.byteLength) * 100;
  process.stdout.write(
    `${JSON.stringify({
      corpus: name,
      inputBytes: input.byteLength,
      gzipBytes: compressed.byteLength,
      chosen: `v${worker.version}`,
      savedPercent: Number(savedPercent.toFixed(1)),
      compressionP95Ms: Number(percentile95(compressionTimes).toFixed(3)),
      decompressionP95Ms: Number(percentile95(decompressionTimes).toFixed(3)),
      fullEncryptMs: Number(worker.encryptMs.toFixed(3)),
      fullDecryptMs: Number(worker.decryptMs.toFixed(3)),
    })}\n`,
  );
}
