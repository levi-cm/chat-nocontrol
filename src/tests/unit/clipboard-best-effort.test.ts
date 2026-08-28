import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyWithBestEffortClear } from "../../flows/identity/clipboard";

const copy = copyWithBestEffortClear;

function textarea(value = "secret"): HTMLTextAreaElement {
  const target = document.createElement("textarea");
  target.value = value;
  document.body.append(target);
  return target;
}

describe("clipboard best-effort clearing", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("attempts clear after 60 seconds only when copied value is unchanged", async () => {
    vi.useFakeTimers();
    let value = "";
    const clipboard = {
      writeText: vi.fn((next: string) => {
        value = next;
        return Promise.resolve();
      }),
      readText: vi.fn(() => Promise.resolve(value)),
    };
    const target = textarea();
    await expect(copy("secret", target, clipboard)).resolves.toBe("copied");
    expect(value).toBe("secret");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(value).toBe("");
  });

  it("preserves clipboard text changed by the user before cleanup", async () => {
    vi.useFakeTimers();
    let value = "";
    const clipboard = {
      writeText: vi.fn((next: string) => {
        value = next;
        return Promise.resolve();
      }),
      readText: vi.fn(() => Promise.resolve(value)),
    };

    await expect(copy("secret", textarea(), clipboard)).resolves.toBe("copied");
    value = "new clipboard text";
    await vi.advanceTimersByTimeAsync(60_000);

    expect(value).toBe("new clipboard text");
    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it("does not claim failure when clipboard read permission is denied", async () => {
    vi.useFakeTimers();
    const clipboard = {
      writeText: vi.fn(() => Promise.resolve()),
      readText: vi.fn(() => Promise.reject(new DOMException("denied"))),
    };
    const target = textarea();
    await expect(copy("secret", target, clipboard)).resolves.toBe("copied");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it("zeroizes transient encoded clipboard text after fingerprinting", async () => {
    vi.useFakeTimers();
    const encodedBuffers: Uint8Array[] = [];
    class CapturingTextEncoder {
      encode(value: string): Uint8Array {
        const bytes = Uint8Array.from(
          [...value].map((character) => character.charCodeAt(0)),
        );
        encodedBuffers.push(bytes);
        return bytes;
      }
    }
    vi.stubGlobal("TextEncoder", CapturingTextEncoder);
    let value = "";
    const clipboard = {
      writeText: vi.fn((next: string) => {
        value = next;
        return Promise.resolve();
      }),
      readText: vi.fn(() => Promise.resolve(value)),
    };

    await expect(copy("secret", textarea(), clipboard)).resolves.toBe("copied");
    expect(encodedBuffers).toHaveLength(1);
    expect(encodedBuffers[0]).toEqual(new Uint8Array(6));

    await vi.advanceTimersByTimeAsync(60_000);
    expect(encodedBuffers).toHaveLength(2);
    expect(encodedBuffers[1]).toEqual(new Uint8Array(6));
  });

  it("cancels the delay and clears unchanged text when its owner aborts", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let value = "";
    const clipboard = {
      writeText: vi.fn((next: string) => {
        value = next;
        return Promise.resolve();
      }),
      readText: vi.fn(() => Promise.resolve(value)),
    };

    await expect(
      copy("secret", textarea(), clipboard, () => true, {
        signal: controller.signal,
      }),
    ).resolves.toBe("copied");
    controller.abort();
    await vi.runAllTimersAsync();

    expect(value).toBe("");
    expect(clipboard.readText).toHaveBeenCalledOnce();
    expect(clipboard.writeText).toHaveBeenCalledTimes(2);
  });

  it("supports component unmount cleanup without retaining a live timer", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const target = textarea();
    const clipboard = {
      writeText: vi.fn(() => Promise.resolve()),
      readText: vi.fn(() => Promise.resolve("secret")),
    };

    await expect(
      copy("secret", target, clipboard, () => true, {
        signal: controller.signal,
      }),
    ).resolves.toBe("copied");
    target.remove();
    controller.abort();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(clipboard.readText).toHaveBeenCalledOnce();
    expect(clipboard.writeText).toHaveBeenCalledTimes(2);
  });

  it("clears unchanged text when unmount wins the asynchronous copy race", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let finishWrite = () => {};
    let value = "";
    const clipboard = {
      writeText: vi.fn((next: string) => {
        value = next;
        if (next === "") return Promise.resolve();
        return new Promise<void>((resolve) => {
          finishWrite = resolve;
        });
      }),
      readText: vi.fn(() => Promise.resolve(value)),
    };

    const pending = copy("secret", textarea(), clipboard, () => true, {
      signal: controller.signal,
    });
    controller.abort();
    finishWrite();
    await expect(pending).resolves.toBe("copied");
    await vi.runAllTimersAsync();

    expect(value).toBe("");
    expect(clipboard.readText).toHaveBeenCalledOnce();
  });

  it("cancels an in-flight clipboard read when its owner aborts", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let finishRead: (value: string) => void = () => {};
    const clipboard = {
      writeText: vi.fn(() => Promise.resolve()),
      readText: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            finishRead = resolve;
          }),
      ),
    };

    await expect(
      copy("secret", textarea(), clipboard, () => true, {
        signal: controller.signal,
      }),
    ).resolves.toBe("copied");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(clipboard.readText).toHaveBeenCalledOnce();
    controller.abort();
    finishRead("secret");
    await vi.runAllTimersAsync();

    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it("releases its timer when AbortSignal listener setup throws", async () => {
    vi.useFakeTimers();
    const signal = {
      aborted: false,
      addEventListener: vi.fn(() => {
        throw new Error("listener setup failed");
      }),
      removeEventListener: vi.fn(),
    } as unknown as AbortSignal;
    const clipboard = {
      writeText: vi.fn(() => Promise.resolve()),
      readText: vi.fn(() => Promise.resolve("secret")),
    };

    await expect(
      copy("secret", textarea(), clipboard, () => true, { signal }),
    ).resolves.toBe("copied");
    await vi.advanceTimersByTimeAsync(60_000);

    expect(clipboard.readText).not.toHaveBeenCalled();
    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it("uses synchronous legacy copy when Async Clipboard is missing", async () => {
    const target = textarea("complete encrypted output");
    const legacyCopy = vi.fn(() => true);

    await expect(
      copy("complete encrypted output", target, undefined, legacyCopy),
    ).resolves.toBe("copied");
    expect(legacyCopy).toHaveBeenCalledOnce();
    expect(target.selectionStart).toBe(0);
    expect(target.selectionEnd).toBe(target.value.length);
  });

  it("falls back after rejected Async Clipboard", async () => {
    const target = textarea("complete decrypted output");
    const clipboard = {
      writeText: vi.fn(() => Promise.reject(new DOMException("denied"))),
      readText: vi.fn(() => Promise.reject(new DOMException("denied"))),
    };

    await expect(
      copy("complete decrypted output", target, clipboard, () => true),
    ).resolves.toBe("copied");
  });

  it("runs legacy copy before the asynchronous Clipboard write settles", async () => {
    const target = textarea("mobile encrypted output");
    let rejectWrite: (reason: DOMException) => void = vi.fn();
    const clipboard = {
      writeText: vi.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectWrite = reject;
          }),
      ),
      readText: vi.fn(() => Promise.reject(new DOMException("denied"))),
    };
    const legacyCopy = vi.fn(() => true);

    const pendingCopy = copy(
      "mobile encrypted output",
      target,
      clipboard,
      legacyCopy,
    );
    const legacyCallsBeforeSettlement = legacyCopy.mock.calls.length;
    rejectWrite(new DOMException("denied"));

    await expect(pendingCopy).resolves.toBe("copied");
    expect(legacyCallsBeforeSettlement).toBe(1);
  });

  it("falls back when Clipboard write throws synchronously", async () => {
    const target = textarea("mobile decrypted output");
    const clipboard = {
      writeText: vi.fn(() => {
        throw new DOMException("denied");
      }),
      readText: vi.fn(() => Promise.reject(new DOMException("denied"))),
    };
    const legacyCopy = vi.fn(() => true);

    await expect(
      copy("mobile decrypted output", target, clipboard, legacyCopy),
    ).resolves.toBe("copied");
    expect(legacyCopy).toHaveBeenCalledOnce();
  });

  it("reports selected when automatic and legacy copy are unavailable", async () => {
    const target = textarea("manual selection fallback");

    await expect(
      copy("manual selection fallback", target, undefined, () => false),
    ).resolves.toBe("selected");
    expect(target.selectionStart).toBe(0);
    expect(target.selectionEnd).toBe(target.value.length);
  });
});
