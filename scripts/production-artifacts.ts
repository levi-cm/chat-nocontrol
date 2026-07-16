import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const EXPECTED_SHELL_FILES = ["index.html", "sw.js"] as const;
const JAVASCRIPT_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);

function normalizedRelative(root: string, path: string): string {
  return relative(root, path).split("\\").join("/");
}

function extension(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot);
}

function filesUnder(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  visit(root);
  return files.sort((left, right) =>
    normalizedRelative(root, left).localeCompare(
      normalizedRelative(root, right),
    ),
  );
}

export function inspectProductionArtifacts(root: string): string[] {
  const absoluteRoot = resolve(root);
  const issues: string[] = [];
  if (!existsSync(absoluteRoot)) {
    return [`missing production artifact directory: ${absoluteRoot}`];
  }
  for (const expected of EXPECTED_SHELL_FILES) {
    if (!existsSync(resolve(absoluteRoot, expected))) {
      issues.push(`missing production shell file: ${expected}`);
    }
  }
  const serviceWorkerPath = resolve(absoluteRoot, "sw.js");
  if (existsSync(serviceWorkerPath)) {
    const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
    if (!/\bself\.skipWaiting\(\)/u.test(serviceWorker)) {
      issues.push("service worker does not activate updates automatically");
    }
    if (!/\.clientsClaim\(\)/u.test(serviceWorker)) {
      issues.push("service worker does not claim clients automatically");
    }
    if (/SKIP_WAITING/u.test(serviceWorker)) {
      issues.push("service worker waits for update approval");
    }
  }
  for (const path of filesUnder(absoluteRoot)) {
    const relativePath = normalizedRelative(absoluteRoot, path);
    if (relativePath.endsWith(".map")) {
      issues.push(`source map file: ${relativePath}`);
    }
    if (
      JAVASCRIPT_EXTENSIONS.has(extension(relativePath)) &&
      /sourceMappingURL/u.test(readFileSync(path, "utf8"))
    ) {
      issues.push(`sourceMappingURL reference: ${relativePath}`);
    }
  }
  return issues.sort();
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const issues = inspectProductionArtifacts(process.argv[2] ?? "dist");
  if (issues.length > 0) {
    console.error(issues.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      "Production artifacts contain no source maps or source map references.",
    );
  }
}
