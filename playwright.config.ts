import { defineConfig, devices } from "@playwright/test";

// CachyOS is unsupported by Playwright's Ubuntu package-name preflight. Browser
// launch remains the hard gate and still fails if an actual shared library is missing.
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "1";

export const REQUIRED_RELEASE_PROJECT_NAMES = [
  "desktop-chromium",
  "mobile-chromium",
  "desktop-firefox",
  "desktop-webkit",
  "mobile-webkit",
] as const;

export default defineConfig({
  testDir: "./src/tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  // Recovery QR decoding is intentionally CPU-heavy. Serial execution keeps
  // browser image decoders responsive on constrained local and CI hosts.
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "https://127.0.0.1:4173",
    ignoreHTTPSErrors: true,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command:
      "npm run build && node ./node_modules/tsx/dist/cli.mjs scripts/preview-https.ts",
    url: "https://127.0.0.1:4173",
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: REQUIRED_RELEASE_PROJECT_NAMES[0],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
        launchOptions: { args: ["--ignore-certificate-errors"] },
      },
    },
    {
      name: REQUIRED_RELEASE_PROJECT_NAMES[1],
      use: {
        ...devices["Pixel 7"],
        launchOptions: { args: ["--ignore-certificate-errors"] },
      },
    },
    {
      name: REQUIRED_RELEASE_PROJECT_NAMES[2],
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: REQUIRED_RELEASE_PROJECT_NAMES[3],
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: REQUIRED_RELEASE_PROJECT_NAMES[4],
      use: { ...devices["iPhone 13"] },
    },
  ],
});
