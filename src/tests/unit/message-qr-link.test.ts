import { describe, expect, it } from "vitest";

import {
  captureQrMessageLink,
  clearLastUnlockedRoute,
  readLastUnlockedRoute,
  routeAfterUnlock,
  routeFromHash,
  writeLastUnlockedRoute,
} from "../../app/routes";
import { encodeBase37Upper } from "../../protocol/base37";
import { extractQrMessageBytes } from "../../protocol/ppxq";
import { canonicalQrTextBytes } from "../helpers/canonical-protocol";

describe("transient message QR links", () => {
  it("routes exact payload fragments to decrypt without query transport", () => {
    expect(routeFromHash("#/decrypt/qr/ABC-123")).toBe("decrypt");
    const location = {
      origin: "https://example.test",
      pathname: "/app/",
      search: "",
      hash: "#/decrypt/qr/ABC-123",
    } as Location;
    expect(captureQrMessageLink(location)).toBe(
      "https://example.test/app/#/decrypt/qr/ABC-123",
    );
  });

  it("rejects malformed and oversized fragments before retention", () => {
    for (const hash of [
      "#/decrypt/qr/",
      "#/decrypt/qr/lower",
      `#/decrypt/qr/${"A".repeat(120_001)}`,
    ]) {
      expect(captureQrMessageLink({ hash } as Location)).toBeNull();
    }
  });

  it("extracts canonical app text and cross-host HTTPS links without navigation", () => {
    const bytes = canonicalQrTextBytes();
    const encoded = encodeBase37Upper(bytes);
    expect(extractQrMessageBytes(`PPX1:MESSAGE:${encoded}`)).toEqual(bytes);
    expect(
      extractQrMessageBytes(
        `https://foreign.example/path/#/decrypt/qr/${encoded}`,
      ),
    ).toEqual(bytes);
    expect(() =>
      extractQrMessageBytes(`http://foreign.example/#/decrypt/qr/${encoded}`),
    ).toThrow();
  });
});

describe("last unlocked route", () => {
  it("persists only whitelisted route names and clears them", () => {
    const storage = new Map<string, string>();
    const local = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    } as unknown as Storage;

    expect(writeLastUnlockedRoute("contacts", local)).toBe(true);
    expect(readLastUnlockedRoute(local)).toBe("contacts");
    storage.set("ppx-last-unlocked-route", "#/decrypt/qr/SECRET");
    expect(readLastUnlockedRoute(local)).toBeNull();
    expect(clearLastUnlockedRoute(local)).toBe(true);
    expect(storage.size).toBe(0);
  });

  it("prefers pending QR intent, then remembered route, then Encrypt", () => {
    expect(routeAfterUnlock(true, "settings")).toBe("decrypt");
    expect(routeAfterUnlock(false, "settings")).toBe("settings");
    expect(routeAfterUnlock(false, null)).toBe("encrypt");
  });
});
