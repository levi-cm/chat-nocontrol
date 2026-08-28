// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { PlaywrightTestConfig } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../../..");

function testSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return testSources(path);
    return /\.(?:spec|test)\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}

const requiredProfiles = [
  { name: "desktop-chromium", browser: "chromium", isMobile: false },
  { name: "mobile-chromium", browser: "chromium", isMobile: true },
  { name: "desktop-firefox", browser: "firefox", isMobile: false },
  { name: "desktop-webkit", browser: "webkit", isMobile: false },
  { name: "mobile-webkit", browser: "webkit", isMobile: true },
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("release Playwright profile matrix", () => {
  it("budgets slow CI page fixtures without weakening local feedback", async () => {
    vi.stubEnv("CI", "");
    vi.resetModules();
    const localConfig = (await import("../../../playwright.config"))
      .default as PlaywrightTestConfig;

    vi.stubEnv("CI", "true");
    vi.resetModules();
    const ciConfig = (await import("../../../playwright.config"))
      .default as PlaywrightTestConfig;

    expect(localConfig.timeout).toBe(30_000);
    expect(ciConfig.timeout).toBe(60_000);
    expect(localConfig.expect?.timeout).toBeUndefined();
    expect(ciConfig.expect?.timeout).toBeUndefined();
  });

  it("exports and configures exactly the five required browser profiles", async () => {
    const configModule = await import("../../../playwright.config");
    const config = configModule.default as PlaywrightTestConfig;
    const projects = config.projects ?? [];

    expect(configModule).toHaveProperty(
      "REQUIRED_RELEASE_PROJECT_NAMES",
      requiredProfiles.map(({ name }) => name),
    );
    expect(
      projects.map(({ name, use }) => ({
        name,
        browser: use?.defaultBrowserType,
        isMobile: use?.isMobile,
      })),
    ).toEqual(requiredProfiles);
  });

  it("disables automatic browser artifacts and allowlists synthetic screenshots", async () => {
    const configModule = await import("../../../playwright.config");
    const config = configModule.default as PlaywrightTestConfig;

    expect(config.use).toMatchObject({
      trace: "off",
      screenshot: "off",
      video: "off",
    });

    const explicitScreenshots = testSources(resolve(projectRoot, "src/tests"))
      .flatMap((path) => {
        const count = readFileSync(path, "utf8").match(
          /\bpage\.screenshot\s*\(/gu,
        )?.length;
        return Array.from({ length: count ?? 0 }, () =>
          relative(projectRoot, path),
        );
      })
      .sort();
    expect(explicitScreenshots).toEqual(
      Array.from({ length: 5 }, () => "src/tests/release/final-qa.spec.ts"),
    );
  });
});
