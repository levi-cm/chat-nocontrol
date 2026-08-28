import { sha256 } from "@noble/hashes/sha2.js";
import { zeroize } from "../../crypto/zeroize";

interface ClipboardPort {
  writeText(value: string): Promise<void>;
  readText(): Promise<string>;
}

export type CopyResult = "copied" | "selected" | "failed";

export interface ClipboardCleanupOptions {
  signal?: AbortSignal;
}

interface ClipboardFingerprint {
  byteLength: number;
  digest: Uint8Array;
}

const CLIPBOARD_CLEAR_DELAY_MS = 60_000;
const CLIPBOARD_OPERATION_TIMEOUT_MS = 5_000;

function fingerprintClipboardText(value: string): ClipboardFingerprint {
  const bytes = new TextEncoder().encode(value);
  try {
    return { byteLength: bytes.byteLength, digest: sha256(bytes) };
  } finally {
    zeroize(bytes);
  }
}

function equalDigest(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left[index] as number) ^ (right[index] as number);
  }
  return difference === 0;
}

async function clipboardMatches(
  copiedFingerprint: ClipboardFingerprint,
  clipboard: ClipboardPort,
  cancelled: () => boolean,
): Promise<boolean> {
  const currentValue = await clipboard.readText();
  if (cancelled()) return false;
  const currentFingerprint = fingerprintClipboardText(currentValue);
  try {
    return (
      currentFingerprint.byteLength === copiedFingerprint.byteLength &&
      equalDigest(currentFingerprint.digest, copiedFingerprint.digest)
    );
  } finally {
    zeroize(currentFingerprint.digest);
  }
}

async function clearIfUnchanged(
  copiedFingerprint: ClipboardFingerprint,
  clipboard: ClipboardPort,
  cancelled: () => boolean,
): Promise<void> {
  try {
    const unchanged = await clipboardMatches(
      copiedFingerprint,
      clipboard,
      cancelled,
    );
    if (unchanged && !cancelled()) {
      await clipboard.writeText("");
    }
  } catch {
    // Best effort only. Browser permission and later clipboard changes win.
  }
}

function scheduleClipboardCleanup(
  copiedFingerprint: ClipboardFingerprint,
  clipboard: ClipboardPort,
  signal: AbortSignal | undefined,
): void {
  let cancelled = false;
  let started = false;
  let finished = false;
  let delayTimer: ReturnType<typeof setTimeout> | undefined;
  let operationTimer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  const finish = () => {
    if (finished) return;
    finished = true;
    try {
      if (delayTimer !== undefined) clearTimeout(delayTimer);
    } catch {
      // Continue releasing the remaining cleanup state.
    }
    try {
      if (operationTimer !== undefined) clearTimeout(operationTimer);
    } catch {
      // Continue releasing the remaining cleanup state.
    }
    try {
      signal?.removeEventListener("abort", abort);
    } catch {
      // The digest still has to be destroyed if listener cleanup is refused.
    }
    zeroize(copiedFingerprint.digest);
  };
  const run = () => {
    if (started || finished) return;
    started = true;
    if (delayTimer !== undefined) clearTimeout(delayTimer);
    try {
      operationTimer = setTimeout(() => {
        cancelled = true;
        finish();
      }, CLIPBOARD_OPERATION_TIMEOUT_MS);
      void clearIfUnchanged(
        copiedFingerprint,
        clipboard,
        () => cancelled,
      ).finally(finish);
    } catch (error) {
      cancelled = true;
      finish();
      throw error;
    }
  };
  abort = () => {
    if (!started) {
      run();
      return;
    }
    cancelled = true;
    finish();
  };

  if (signal?.aborted) {
    run();
    return;
  }

  try {
    delayTimer = setTimeout(run, CLIPBOARD_CLEAR_DELAY_MS);
    signal?.addEventListener("abort", abort, { once: true });
  } catch (error) {
    cancelled = true;
    finish();
    throw error;
  }
}

export async function copyWithBestEffortClear(
  value: string,
  target: HTMLTextAreaElement,
  clipboard: ClipboardPort | undefined = navigator.clipboard,
  legacyCopy: () => boolean = () => document.execCommand("copy"),
  cleanup: ClipboardCleanupOptions = {},
): Promise<CopyResult> {
  try {
    target.focus();
    target.select();
    target.setSelectionRange(0, target.value.length);
  } catch {
    return "failed";
  }

  let clipboardWrite = Promise.resolve(false);
  if (clipboard) {
    try {
      clipboardWrite = clipboard.writeText(value).then(
        () => true,
        () => false,
      );
    } catch {
      clipboardWrite = Promise.resolve(false);
    }
  }
  let legacyCopied = false;
  try {
    legacyCopied = legacyCopy();
  } catch {
    legacyCopied = false;
  }
  const clipboardCopied = await clipboardWrite;
  if (!clipboardCopied && !legacyCopied) return "selected";
  if (clipboard) {
    try {
      scheduleClipboardCleanup(
        fingerprintClipboardText(value),
        clipboard,
        cleanup.signal,
      );
    } catch {
      // Copy succeeded. Cleanup setup is best effort and must not change UX.
    }
  }
  return "copied";
}
