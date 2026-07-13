import { describe, expect, it } from "vitest";
import { readStoredLocale, storeLocale } from "../../app/bootstrap";
import { createInitialAppState } from "../../app/state";

describe("app state bootstrap", () => {
  it("creates the exact new-user state", () => {
    expect(createInitialAppState("de")).toEqual({
      locale: "de",
      route: "identity",
      activeIdentityId: null,
      storageMode: "persistent",
    });
  });

  it("falls back safely when locale storage is unavailable", () => {
    const denied = {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    } as unknown as Storage;

    expect(readStoredLocale(denied)).toBe("en");
    expect(storeLocale("de", denied)).toBe(false);
  });
});
