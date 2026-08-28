import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export const LEGACY_DEPLOY_COMMIT = "1a3a5b4d5e55ab78d2bf4692eed2d3545856e291";
export const LEGACY_DEPLOY_TREE = "f58cbb1e46f3e046139788a62bf0333d13c1c1a5";
export const LEGACY_DEPLOY_SHA256: Readonly<Record<string, string>> = {
  "index.html":
    "41e18bc83251854ef195221ca5aebca9dfcc5796989d11f287f278a5e20f3cf1",
  "sw.js": "ce35e1a513c74d9e49d84e320c999e1d0024ea0eaa4465a6645ebd512de71c78",
  "assets/index-CZw01I_i.js":
    "f27e8834c19d996089627c33b68e61e95024b3fc65b8c47b412d3957fa2ecf29",
};

const MAXIMUM_FILE_BYTES = 64 * 1024 * 1024;
const MAXIMUM_TREE_BYTES = 512 * 1024 * 1024;
const MAXIMUM_FILES = 10_000;

function gitText(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}

function gitBytes(cwd: string, path: string): Buffer {
  return execFileSync("git", ["show", `${LEGACY_DEPLOY_COMMIT}:${path}`], {
    cwd,
    maxBuffer: MAXIMUM_FILE_BYTES,
  });
}

function safeGitPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.includes("\0") &&
    !path.includes("\\") &&
    !path.startsWith("/") &&
    !path.split("/").some((segment) => segment === "" || segment === "..")
  );
}

export function loadVerifiedLegacyPages(
  cwd = process.cwd(),
): ReadonlyMap<string, Buffer> {
  const actualCommit = gitText(
    cwd,
    "rev-parse",
    `${LEGACY_DEPLOY_COMMIT}^{commit}`,
  );
  const actualTree = gitText(
    cwd,
    "show",
    "-s",
    "--format=%T",
    LEGACY_DEPLOY_COMMIT,
  );
  if (
    actualCommit !== LEGACY_DEPLOY_COMMIT ||
    actualTree !== LEGACY_DEPLOY_TREE
  ) {
    throw new Error("legacy deployment Git identity mismatch");
  }
  const paths = gitText(
    cwd,
    "ls-tree",
    "-r",
    "--name-only",
    LEGACY_DEPLOY_COMMIT,
  ).split("\n");
  if (
    paths.length === 0 ||
    paths.length > MAXIMUM_FILES ||
    paths.some((path) => !safeGitPath(path))
  ) {
    throw new Error("legacy deployment tree inventory is unsafe");
  }
  const files = new Map<string, Buffer>();
  let totalBytes = 0;
  for (const path of paths) {
    const bytes = gitBytes(cwd, path);
    totalBytes += bytes.byteLength;
    if (totalBytes > MAXIMUM_TREE_BYTES) {
      throw new Error("legacy deployment tree exceeds size cap");
    }
    files.set(path, bytes);
  }
  for (const [path, expected] of Object.entries(LEGACY_DEPLOY_SHA256)) {
    const bytes = files.get(path);
    if (!bytes) throw new Error(`legacy deployment missing ${path}`);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== expected) {
      throw new Error(`legacy deployment SHA-256 mismatch for ${path}`);
    }
  }
  return files;
}
