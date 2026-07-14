import { afterEach, describe, expect, it, vi } from "vitest";
import { copyWithBestEffortClear } from "../../flows/identity/clipboard";

const copy = copyWithBestEffortClear;

function textarea(value = "secret"): HTMLTextAreaElement {
  const target = document.createElement("textarea");
  target.value = value;
  document.body.append(target);
  return target;
}

describe("clipboard best-effort clearing", () => {
  afterEach(() => vi.useRealTimers());

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

  it("reports selected when automatic and legacy copy are unavailable", async () => {
    const target = textarea("manual selection fallback");

    await expect(
      copy("manual selection fallback", target, undefined, () => false),
    ).resolves.toBe("selected");
    expect(target.selectionStart).toBe(0);
    expect(target.selectionEnd).toBe(target.value.length);
  });
});
