import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
} from "node:fs";
import { basename, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const EXPECTED_SHELL_FILES = ["index.html", "sw.js"] as const;
const SOURCE_DIRECTIVE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".html",
  ".htm",
  ".json",
  ".webmanifest",
  ".worker",
  ".svg",
  ".xml",
  ".xhtml",
]);
const SOURCE_DIRECTIVES = [
  {
    pattern: /(?:\/\/[@#]|\/\*[@#])[\t ]*sourceMappingURL[\t ]*=/u,
    issue: "sourceMappingURL reference",
  },
  {
    pattern: /(?:\/\/[@#]|\/\*[@#])[\t ]*sourceURL[\t ]*=/u,
    issue: "sourceURL reference",
  },
] as const;
const SOURCE_SCAN_CHUNK_BYTES = 64 * 1024;
const SOURCE_SCAN_OVERLAP_BYTES = SOURCE_SCAN_CHUNK_BYTES;

function normalizedRelative(root: string, path: string): string {
  return relative(root, path).split("\\").join("/");
}

function extension(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

function shouldScanSourceDirectives(path: string): boolean {
  if (SOURCE_DIRECTIVE_EXTENSIONS.has(extension(path))) return true;
  return /^(?:manifest|service-worker|sw|worker)$/u.test(
    basename(path).toLowerCase(),
  );
}

function sourceDirectiveIssues(path: string): string[] {
  const found = new Set<string>();
  const readBuffer = Buffer.allocUnsafe(SOURCE_SCAN_CHUNK_BYTES);
  let overlap = Buffer.alloc(0);
  const descriptor = openSync(path, "r");
  try {
    let bytesRead = 0;
    while (
      (bytesRead = readSync(
        descriptor,
        readBuffer,
        0,
        SOURCE_SCAN_CHUNK_BYTES,
        null,
      )) > 0
    ) {
      const bytes =
        overlap.length === 0
          ? readBuffer.subarray(0, bytesRead)
          : Buffer.concat([overlap, readBuffer.subarray(0, bytesRead)]);
      const text = bytes.toString("latin1");
      for (const directive of SOURCE_DIRECTIVES) {
        if (directive.pattern.test(text)) {
          found.add(directive.issue);
        }
      }
      overlap = Buffer.from(
        bytes.subarray(Math.max(0, bytes.length - SOURCE_SCAN_OVERLAP_BYTES)),
      );
    }
  } finally {
    closeSync(descriptor);
  }
  return [...found];
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
    if (!/(?:\.clientsClaim|\.clients\.claim)\(\)/u.test(serviceWorker)) {
      issues.push("service worker does not claim clients automatically");
    }
    if (/SKIP_WAITING/u.test(serviceWorker)) {
      issues.push("service worker waits for update approval");
    }
  }
  for (const path of filesUnder(absoluteRoot)) {
    const relativePath = normalizedRelative(absoluteRoot, path);
    if (relativePath.toLowerCase().endsWith(".map")) {
      issues.push(`source map file: ${relativePath}`);
    }
    if (shouldScanSourceDirectives(relativePath)) {
      for (const issue of sourceDirectiveIssues(path)) {
        issues.push(`${issue}: ${relativePath}`);
      }
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
