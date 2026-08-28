import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";
import manifest from "./package.json" with { type: "json" };
import { validateCanonicalAppBase } from "./src/app/canonical-app-base.ts";

const canonicalAppBase = validateCanonicalAppBase(manifest.homepage);

export default defineConfig({
  define: {
    __CHAT_NOCONTROL_PRODUCTION_BUILD__: JSON.stringify(false),
    __CHAT_NOCONTROL_VERSION__: JSON.stringify(manifest.version),
    __CHAT_NOCONTROL_CANONICAL_APP_BASE__: JSON.stringify(canonicalAppBase),
  },
  plugins: [preact()],
  test: {
    environment: "jsdom",
    // Vault tests deliberately exercise production-strength scrypt. Running
    // several of them concurrently makes individual wall time depend on CI
    // runner contention and can exceed the real test timeout without a logic
    // failure. One worker keeps coverage deterministic and fail-closed.
    maxWorkers: 1,
    testTimeout: 30_000,
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/tests/**/*.{test,property}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
    },
  },
});
