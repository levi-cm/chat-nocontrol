import { describe, expect, it } from "vitest";
import { isAllowedShellCachePath } from "../../sw/cache-policy";

describe("service worker cache allowlist", () => {
  it.each([
    "index.html",
    "manifest.webmanifest",
    "icons/app-icon.svg",
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
    "assets/unversioned.js",
    "api/import",
  ])("denies user or unversioned path %s", (path) => {
    expect(isAllowedShellCachePath(path)).toBe(false);
  });
});
