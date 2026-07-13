import { afterEach, describe, expect, it, vi } from "vitest";
import { copyWithBestEffortClear } from "../../flows/identity/clipboard";

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
    await copyWithBestEffortClear("secret", clipboard);
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
    await expect(copyWithBestEffortClear("secret", clipboard)).resolves.toBe(
      true,
    );
    await vi.advanceTimersByTimeAsync(60_000);
    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
  });
});
