import { describe, expect, it } from "vitest";
import manifest from "../../../package.json";
import {
  CHAT_NOCONTROL_CANONICAL_APP_BASE,
  CHAT_NOCONTROL_VERSION,
} from "../../app/build-info";
import { validateCanonicalAppBase } from "../../app/canonical-app-base";

describe("build metadata", () => {
  it("injects the package version into user-visible diagnostics", () => {
    expect(CHAT_NOCONTROL_VERSION).toBe(manifest.version);
  });

  it("injects the exact validated package homepage as canonical app base", () => {
    expect(CHAT_NOCONTROL_CANONICAL_APP_BASE).toBe(manifest.homepage);
    expect(validateCanonicalAppBase(manifest.homepage)).toBe(manifest.homepage);
  });

  it.each([
    "http://example.test/app/",
    "https://user@example.test/app/",
    "https://example.test/app/?destination=elsewhere",
    "https://example.test/app/#/m/payload",
  ])("rejects unsafe canonical app base %s", (value) => {
    expect(() => validateCanonicalAppBase(value)).toThrow(
      "Canonical app base must be an HTTPS URL without credentials, query, or fragment",
    );
  });

  it("preserves a canonical base path", () => {
    expect(validateCanonicalAppBase("https://example.test/safe/app/")).toBe(
      "https://example.test/safe/app/",
    );
  });
});
