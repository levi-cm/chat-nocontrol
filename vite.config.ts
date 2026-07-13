import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { isAllowedShellCachePath } from "./src/sw/cache-policy";
import manifest from "./package.json";

export default defineConfig(({ command }) => ({
  base: "./",
  define: {
    __CHAT_NOCONTROL_PRODUCTION_BUILD__: JSON.stringify(command === "build"),
    __CHAT_NOCONTROL_VERSION__: JSON.stringify(manifest.version),
  },
  plugins: [
    preact(),
    {
      name: "chat-nocontrol-development-csp",
      transformIndexHtml(html) {
        return command === "serve"
          ? html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
          : html;
      },
    },
    VitePWA({
      injectRegister: false,
      registerType: "prompt",
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{html,js,css,svg,webmanifest}"],
        manifestTransforms: [
          (entries) =>
            Promise.resolve({
              manifest: entries.filter((entry) =>
                isAllowedShellCachePath(entry.url),
              ),
              warnings: [],
            }),
        ],
        navigateFallback: "index.html",
        sourcemap: false,
      },
    }),
  ],
  build: { target: "es2023", sourcemap: true },
}));
