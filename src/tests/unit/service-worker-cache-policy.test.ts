import { describe, expect, it } from "vitest";
import { isAllowedShellCachePath } from "../../sw/cache-policy";

describe("service worker cache allowlist", () => {
  it.each([
    "index.html",
    "manifest.webmanifest",
    "icons/app-logo-512.png",
    "icons/app-logo-192.png",
    "icons/favicon-32.png",
    "assets/index-BPj7msQ2.js",
    "assets/index-CWc9m2Pb.css",
  ])("allows versioned shell asset %s", (path) => {
    expect(isAllowedShellCachePath(path)).toBe(true);
  });

  it.each([
    "private.ppxvault",
    "recovery.ppxrecovery",
    "contact.ppxcontact",
    "encrypted.ppxmessage",
    "diagnostics.json",
    "icons/app-icon.svg",
    "assets/unversioned.js",
    "api/import",
    "index.html?message=UFBYVAECAwQ",
    "index.html#/m/UFBYVAECAwQ",
  ])("denies user or unversioned path %s", (path) => {
    expect(isAllowedShellCachePath(path)).toBe(false);
  });

  it("cannot turn a fragment message payload into a cache key", () => {
    const link = new URL(
      "https://levi-cm.github.io/chat-nocontrol/#/m/UFBYVAECAwQ",
    );

    expect(link.pathname).toBe("/chat-nocontrol/");
    expect(link.search).toBe("");
    expect(isAllowedShellCachePath(`${link.pathname}${link.hash}`)).toBe(false);
  });
});
