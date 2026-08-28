import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

import {
  LEGACY_DEPLOY_COMMIT,
  LEGACY_DEPLOY_SHA256,
  LEGACY_DEPLOY_TREE,
  loadVerifiedLegacyPages,
} from "./legacy-pages-baseline";

const ROLLBACK_SCHEMA = "chat-nocontrol-legacy-pages-rollback/v1";
const MAXIMUM_FILES = 10_000;
const MAXIMUM_TREE_BYTES = 512 * 1024 * 1024;

interface RollbackFile {
  path: string;
  sha256: string;
  size: number;
}

export interface LegacyPagesRollbackBinding {
  schema: typeof ROLLBACK_SCHEMA;
  commit: typeof LEGACY_DEPLOY_COMMIT;
  tree: typeof LEGACY_DEPLOY_TREE;
  tarSha256: string;
  fileCount: number;
  totalBytes: number;
  pinnedSha256: typeof LEGACY_DEPLOY_SHA256;
  files: RollbackFile[];
}

interface RollbackArtifactOptions {
  tarPath: string;
  bindingPath: string;
}

interface LegacyLiveAcceptanceOptions {
  deploymentUrl: string;
  expectedSha256?: Readonly<Record<string, string>>;
  attempts: number;
  intervalMs: number;
  requestTimeoutMs: number;
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface LegacyLiveAcceptanceResult {
  attempt: number;
  deploymentUrl: string;
  sha256: Record<string, string>;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizedRelative(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}

function safePath(path: string): boolean {
  const normalized = path.replace(/^\.\//u, "");
  return (
    normalized.length > 0 &&
    !normalized.startsWith("/") &&
    !normalized.includes("\0") &&
    !normalized.includes("\\") &&
    !normalized.split("/").some((part) => part === "" || part === "..")
  );
}

function safeTarPath(path: string): boolean {
  if (path === "." || path === "./") return true;
  return safePath(path.replace(/\/$/u, ""));
}

function inventoryDirectory(root: string): RollbackFile[] {
  const absoluteRoot = resolve(root);
  const pending = [absoluteRoot];
  const files: RollbackFile[] = [];
  let totalBytes = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    for (const name of readdirSync(current).sort().reverse()) {
      const path = join(current, name);
      const metadata = lstatSync(path);
      if (metadata.isSymbolicLink()) {
        throw new Error(`rollback artifact rejects symlink: ${path}`);
      }
      if (metadata.isDirectory()) {
        pending.push(path);
        continue;
      }
      if (!metadata.isFile()) {
        throw new Error(`rollback artifact rejects non-file: ${path}`);
      }
      const pathUnderRoot = normalizedRelative(absoluteRoot, path);
      if (!safePath(pathUnderRoot)) {
        throw new Error("rollback artifact contains unsafe path");
      }
      const bytes = readFileSync(path);
      totalBytes += bytes.byteLength;
      if (totalBytes > MAXIMUM_TREE_BYTES) {
        throw new Error("rollback artifact exceeds size cap");
      }
      files.push({
        path: pathUnderRoot,
        sha256: sha256(bytes),
        size: bytes.byteLength,
      });
      if (files.length > MAXIMUM_FILES) {
        throw new Error("rollback artifact exceeds file-count cap");
      }
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

function requireTarSuccess(args: string[], errorMessage: string): string {
  const result = spawnSync("tar", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${errorMessage}: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function inspectTarPaths(tarPath: string): void {
  const listing = requireTarSuccess(
    ["--list", "--file", tarPath],
    "could not list rollback artifact",
  )
    .split("\n")
    .filter(Boolean);
  if (listing.length === 0 || listing.some((path) => !safeTarPath(path))) {
    throw new Error("rollback artifact tar contains unsafe path");
  }
  const verbose = requireTarSuccess(
    ["--list", "--verbose", "--file", tarPath],
    "could not inspect rollback artifact",
  )
    .split("\n")
    .filter(Boolean);
  if (verbose.length !== listing.length) {
    throw new Error("rollback artifact tar inventory mismatch");
  }
  if (verbose.some((line) => line[0] !== "-" && line[0] !== "d")) {
    throw new Error("rollback artifact tar contains link or special entry");
  }
}

function canonicalBinding(
  binding: LegacyPagesRollbackBinding,
): LegacyPagesRollbackBinding {
  if (
    binding.schema !== ROLLBACK_SCHEMA ||
    binding.commit !== LEGACY_DEPLOY_COMMIT ||
    binding.tree !== LEGACY_DEPLOY_TREE ||
    !/^[0-9a-f]{64}$/u.test(binding.tarSha256) ||
    binding.fileCount !== binding.files.length ||
    !Number.isSafeInteger(binding.totalBytes) ||
    binding.totalBytes < 1 ||
    JSON.stringify(binding.pinnedSha256) !==
      JSON.stringify(LEGACY_DEPLOY_SHA256)
  ) {
    throw new Error("rollback artifact binding is invalid");
  }
  const files = [...binding.files].sort((left, right) =>
    left.path.localeCompare(right.path, "en"),
  );
  if (
    files.length === 0 ||
    files.length > MAXIMUM_FILES ||
    files.some(
      (file) =>
        !safePath(file.path) ||
        !/^[0-9a-f]{64}$/u.test(file.sha256) ||
        !Number.isSafeInteger(file.size) ||
        file.size < 0,
    ) ||
    new Set(files.map((file) => file.path)).size !== files.length ||
    files.reduce((sum, file) => sum + file.size, 0) !== binding.totalBytes
  ) {
    throw new Error("rollback artifact binding file inventory is invalid");
  }
  for (const [path, expected] of Object.entries(LEGACY_DEPLOY_SHA256)) {
    if (files.find((file) => file.path === path)?.sha256 !== expected) {
      throw new Error(`rollback artifact binding does not pin ${path}`);
    }
  }
  return { ...binding, files };
}

export function createLegacyPagesRollbackArtifact(
  options: RollbackArtifactOptions,
): LegacyPagesRollbackBinding {
  const tarPath = resolve(options.tarPath);
  const bindingPath = resolve(options.bindingPath);
  mkdirSync(dirname(tarPath), { recursive: true });
  mkdirSync(dirname(bindingPath), { recursive: true });
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "cat5-legacy-pages-create-"),
  );
  const treeDirectory = join(temporaryDirectory, "tree");
  mkdirSync(treeDirectory, { mode: 0o700 });
  try {
    for (const [path, bytes] of loadVerifiedLegacyPages()) {
      const target = join(treeDirectory, path);
      mkdirSync(dirname(target), { recursive: true, mode: 0o755 });
      writeFileSync(target, bytes, { mode: 0o644 });
      chmodSync(target, 0o644);
    }
    const files = inventoryDirectory(treeDirectory);
    rmSync(tarPath, { force: true });
    requireTarSuccess(
      [
        "--sort=name",
        "--mtime=UTC 1970-01-01",
        "--owner=0",
        "--group=0",
        "--numeric-owner",
        "--format=ustar",
        "--directory",
        treeDirectory,
        "--create",
        "--file",
        tarPath,
        ".",
      ],
      "could not create rollback artifact",
    );
    inspectTarPaths(tarPath);
    const binding = canonicalBinding({
      schema: ROLLBACK_SCHEMA,
      commit: LEGACY_DEPLOY_COMMIT,
      tree: LEGACY_DEPLOY_TREE,
      tarSha256: sha256(readFileSync(tarPath)),
      fileCount: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      pinnedSha256: LEGACY_DEPLOY_SHA256,
      files,
    });
    writeFileSync(bindingPath, `${JSON.stringify(binding, null, 2)}\n`, {
      mode: 0o600,
    });
    return binding;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

export function verifyLegacyPagesRollbackArtifact(
  options: RollbackArtifactOptions,
): LegacyPagesRollbackBinding {
  const tarPath = resolve(options.tarPath);
  const binding = canonicalBinding(
    JSON.parse(
      readFileSync(resolve(options.bindingPath), "utf8"),
    ) as LegacyPagesRollbackBinding,
  );
  if (sha256(readFileSync(tarPath)) !== binding.tarSha256) {
    throw new Error("rollback artifact tar SHA-256 mismatch");
  }
  inspectTarPaths(tarPath);
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "cat5-legacy-pages-verify-"),
  );
  try {
    requireTarSuccess(
      [
        "--extract",
        "--file",
        tarPath,
        "--directory",
        temporaryDirectory,
        "--no-same-owner",
        "--no-same-permissions",
      ],
      "could not extract rollback artifact",
    );
    const extractedFiles = inventoryDirectory(temporaryDirectory);
    if (JSON.stringify(extractedFiles) !== JSON.stringify(binding.files)) {
      throw new Error("rollback artifact extracted inventory mismatch");
    }
    return binding;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function boundedInteger(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} is invalid`);
  }
}

function validatedDeploymentUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    !url.pathname.endsWith("/")
  ) {
    throw new Error("legacy rollback deployment URL is invalid");
  }
  return url;
}

export async function pollLegacyPagesLiveAcceptance(
  options: LegacyLiveAcceptanceOptions,
): Promise<LegacyLiveAcceptanceResult> {
  boundedInteger(options.attempts, 1, 100, "legacy rollback attempt count");
  boundedInteger(options.intervalMs, 0, 60_000, "legacy rollback interval");
  boundedInteger(
    options.requestTimeoutMs,
    1,
    60_000,
    "legacy rollback request timeout",
  );
  const deploymentUrl = validatedDeploymentUrl(options.deploymentUrl);
  const expected = options.expectedSha256 ?? LEGACY_DEPLOY_SHA256;
  const entries = Object.entries(expected).sort(([left], [right]) =>
    left.localeCompare(right, "en"),
  );
  if (
    entries.length === 0 ||
    entries.some(
      ([path, digest]) => !safePath(path) || !/^[0-9a-f]{64}$/u.test(digest),
    )
  ) {
    throw new Error("legacy rollback live hash set is invalid");
  }
  const fetcher = options.fetcher ?? fetch;
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolveSleep) =>
        setTimeout(resolveSleep, milliseconds),
      ));
  let lastFailure = "unknown failure";
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      const observed: Record<string, string> = {};
      for (const [path, expectedDigest] of entries) {
        const target = new URL(path, deploymentUrl);
        target.searchParams.set("rollback-check", String(attempt));
        const response = await fetcher(target, {
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(options.requestTimeoutMs),
        });
        if (!response.ok) {
          throw new Error(`${path} returned HTTP ${response.status}`);
        }
        const declaredLength = Number(response.headers.get("content-length"));
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > MAXIMUM_TREE_BYTES
        ) {
          throw new Error(`${path} exceeds response size cap`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > MAXIMUM_TREE_BYTES) {
          throw new Error(`${path} exceeds response size cap`);
        }
        const actualDigest = sha256(bytes);
        if (actualDigest !== expectedDigest) {
          throw new Error(`${path} SHA-256 mismatch`);
        }
        observed[path] = actualDigest;
      }
      return {
        attempt,
        deploymentUrl: deploymentUrl.toString(),
        sha256: observed,
      };
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
      if (attempt < options.attempts) await sleep(options.intervalMs);
    }
  }
  throw new Error(
    `Pinned V1 live acceptance failed after ${options.attempts} attempts: ${lastFailure}`,
  );
}

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`missing required ${name}`);
  }
  return value;
}

function numberArgument(name: string): number {
  const value = Number(requiredArgument(name));
  if (!Number.isSafeInteger(value))
    throw new Error(`${name} must be an integer`);
  return value;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "accept") {
    const result = await pollLegacyPagesLiveAcceptance({
      deploymentUrl: requiredArgument("--url"),
      attempts: numberArgument("--attempts"),
      intervalMs: numberArgument("--interval-ms"),
      requestTimeoutMs: numberArgument("--request-timeout-ms"),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const options = {
    tarPath: requiredArgument("--tar"),
    bindingPath: requiredArgument("--binding"),
  };
  const binding =
    command === "create"
      ? createLegacyPagesRollbackArtifact(options)
      : command === "verify"
        ? verifyLegacyPagesRollbackArtifact(options)
        : undefined;
  if (!binding) {
    throw new Error(
      "usage: legacy-pages-rollback.ts <create|verify> --tar <artifact.tar> --binding <binding.json>",
    );
  }
  process.stdout.write(
    `Legacy Pages rollback ${command} OK: commit=${binding.commit} tree=${binding.tree} tar-sha256=${binding.tarSha256}\n`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
