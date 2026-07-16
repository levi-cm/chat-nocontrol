const EXPLICIT_SHELL_PATHS = new Set([
  "index.html",
  "manifest.webmanifest",
  "icons/app-logo-512.png",
  "icons/app-logo-192.png",
  "icons/favicon-32.png",
]);

const VERSIONED_ASSET =
  /^assets\/[a-z0-9_.-]+-[a-z0-9_-]{8,}\.(?:css|js|svg)$/iu;

export function isAllowedShellCachePath(input: string): boolean {
  const path = input.replace(/^\.\//u, "").replace(/^\//u, "");
  if (path.includes("?") || path.includes("#")) return false;
  return EXPLICIT_SHELL_PATHS.has(path) || VERSIONED_ASSET.test(path);
}
