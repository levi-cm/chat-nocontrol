import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";
import manifest from "./package.json";

export default defineConfig({
  define: {
    __CHAT_NOCONTROL_PRODUCTION_BUILD__: JSON.stringify(false),
    __CHAT_NOCONTROL_VERSION__: JSON.stringify(manifest.version),
  },
  plugins: [preact()],
  test: {
    environment: "jsdom",
    maxWorkers: 4,
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
