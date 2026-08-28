import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeBase45Upper } from "../../protocol/base45";
import { encodeRecoveryObjectV2 } from "../../protocol/ppxr-v2";
import {
  classifyScannedQrInWorker,
  SCAN_WORKER_TIMEOUT_MS,
} from "../../workers/scan-client";
import { classifyScannedText } from "../../workers/scan-runner";

afterEach(() => {
  vi.unstubAllGlobals();
});

function recoveryQr(): string {
  const bytes = encodeRecoveryObjectV2({
    magic: "PPXR",
    formatVersion: 2,
    suite: 2,
    flags: 0,
    masterEntropy: new Uint8Array(32),
    creationTime: 1n,
    pseudonym: "Worker Alice",
    checksum: new Uint8Array(16),
  });
  return `PPX2:RECOVERY:${encodeBase45Upper(bytes)}`;
}

describe("scan worker runner", () => {
  it("strictly classifies private V2 recovery and rejects damaged input", () => {
    const qr = recoveryQr();
    expect(classifyScannedText(qr)).toBe("recovery");
    expect(() => classifyScannedText(`${qr.slice(0, -1)}!`)).toThrow();
  });

  it(
    "terminates a silent worker and falls back to bounded local classification",
    async () => {
      const terminate = vi.fn();
      class SilentWorker {
        addEventListener() {}
        postMessage() {}
        terminate = terminate;
      }
      vi.stubGlobal("Worker", SilentWorker);

      const classification = classifyScannedQrInWorker(recoveryQr());

      await expect(classification).resolves.toBe("recovery");
      expect(terminate).toHaveBeenCalledOnce();
    },
    SCAN_WORKER_TIMEOUT_MS + 3_000,
  );
});
