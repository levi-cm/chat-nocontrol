import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import {
  LEGACY_DEPLOY_COMMIT,
  LEGACY_DEPLOY_TREE,
  loadVerifiedLegacyPages,
} from "./legacy-pages-baseline";

export { LEGACY_DEPLOY_COMMIT, LEGACY_DEPLOY_TREE };

const BASE_PATH = "/chat-nocontrol/";
const MAXIMUM_FILE_BYTES = 64 * 1024 * 1024;
const MAXIMUM_TREE_BYTES = 512 * 1024 * 1024;
const MAXIMUM_FILES = 10_000;

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

export type PhysicalDeviceBuildMode = "legacy" | "candidate";

export interface PhysicalDeviceServer {
  readonly origin: string;
  readonly legacyCommit: string;
  readonly legacyTree: string;
  readonly candidateSha256: string;
  readonly tailscaleServeCommand: string;
  mode(): PhysicalDeviceBuildMode;
  switchMode(mode: PhysicalDeviceBuildMode): void;
  stop(): Promise<void>;
}

interface LoadedBuild {
  files: ReadonlyMap<string, Buffer>;
  sha256: string;
}

function normalizedRelative(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}

function digestFiles(files: ReadonlyMap<string, Buffer>): string {
  const hash = createHash("sha256");
  for (const path of [...files.keys()].sort()) {
    const content = files.get(path);
    if (!content) throw new Error("candidate build inventory changed");
    hash.update(path, "utf8");
    hash.update("\0", "utf8");
    hash.update(String(content.byteLength), "utf8");
    hash.update("\0", "utf8");
    hash.update(content);
  }
  return hash.digest("hex");
}

function loadCandidateBuild(directory: string): LoadedBuild {
  const root = realpathSync(resolve(directory));
  const files = new Map<string, Buffer>();
  const pending = [root];
  let totalBytes = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    for (const name of readdirSync(current).sort().reverse()) {
      const path = join(current, name);
      const metadata = lstatSync(path);
      if (metadata.isSymbolicLink()) {
        throw new Error(`candidate build rejects symlink: ${path}`);
      }
      if (metadata.isDirectory()) {
        pending.push(path);
        continue;
      }
      if (!metadata.isFile()) {
        throw new Error(`candidate build rejects non-file: ${path}`);
      }
      if (metadata.size > MAXIMUM_FILE_BYTES) {
        throw new Error(`candidate build file exceeds size cap: ${path}`);
      }
      const nameUnderRoot = normalizedRelative(root, path);
      if (
        nameUnderRoot.length === 0 ||
        nameUnderRoot.includes("\0") ||
        nameUnderRoot.startsWith("/") ||
        nameUnderRoot.split("/").some((part) => part === "..")
      ) {
        throw new Error("candidate build contains unsafe path");
      }
      const content = readFileSync(path);
      totalBytes += content.byteLength;
      if (totalBytes > MAXIMUM_TREE_BYTES) {
        throw new Error("candidate build exceeds size cap");
      }
      files.set(nameUnderRoot, content);
      if (files.size > MAXIMUM_FILES) {
        throw new Error("candidate build exceeds file-count cap");
      }
    }
  }
  for (const required of ["index.html", "manifest.webmanifest", "sw.js"]) {
    if (!files.has(required)) {
      throw new Error(`candidate build missing ${required}`);
    }
  }
  if (![...files.keys()].some((path) => /^assets\/.+\.js$/u.test(path))) {
    throw new Error("candidate build missing application module");
  }
  return { files, sha256: digestFiles(files) };
}

function safeRequestedPath(pathname: string): string | null {
  if (!pathname.startsWith(BASE_PATH)) return null;
  const encoded = pathname.slice(BASE_PATH.length);
  let decoded: string;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  if (
    decoded.includes("\0") ||
    decoded.includes("\\") ||
    decoded.startsWith("/") ||
    decoded.split("/").some((part) => part === "..")
  ) {
    return null;
  }
  return decoded === "" ? "index.html" : decoded;
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolveStop, reject) => {
    server.close((error) => (error ? reject(error) : resolveStop()));
    server.closeAllConnections();
  });
}

export async function startPhysicalDeviceServer(options: {
  candidateDirectory: string;
  port?: number;
}): Promise<PhysicalDeviceServer> {
  const legacyFiles = loadVerifiedLegacyPages();
  const candidate = loadCandidateBuild(options.candidateDirectory);
  let mode: PhysicalDeviceBuildMode = "legacy";
  let activeFiles = legacyFiles;
  const server = createServer((request, response) => {
    const method = request.method ?? "GET";
    if (method !== "GET" && method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" }).end();
      return;
    }
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (
      requestUrl.pathname === "/" ||
      requestUrl.pathname === "/chat-nocontrol"
    ) {
      response.writeHead(308, { location: BASE_PATH }).end();
      return;
    }
    const requestedPath = safeRequestedPath(requestUrl.pathname);
    if (!requestedPath) {
      response.writeHead(404).end();
      return;
    }
    const filesForRequest = activeFiles;
    let content = filesForRequest.get(requestedPath);
    let servedPath = requestedPath;
    if (
      !content &&
      !extname(requestedPath) &&
      (request.headers.accept ?? "").includes("text/html")
    ) {
      content = filesForRequest.get("index.html");
      servedPath = "index.html";
    }
    if (!content) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": String(content.byteLength),
      "content-type":
        contentTypes[extname(servedPath)] ?? "application/octet-stream",
      "service-worker-allowed": BASE_PATH,
      "x-content-type-options": "nosniff",
    });
    response.end(method === "HEAD" ? undefined : content);
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await stopServer(server);
    throw new Error("physical-device server did not bind a TCP port");
  }
  const localOrigin = `http://127.0.0.1:${address.port}`;
  let stopped = false;
  return {
    origin: `${localOrigin}${BASE_PATH}`,
    legacyCommit: LEGACY_DEPLOY_COMMIT,
    legacyTree: LEGACY_DEPLOY_TREE,
    candidateSha256: candidate.sha256,
    tailscaleServeCommand: `tailscale serve --bg --set-path /chat-nocontrol ${localOrigin}`,
    mode: () => mode,
    switchMode(nextMode) {
      mode = nextMode;
      activeFiles = nextMode === "legacy" ? legacyFiles : candidate.files;
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      await stopServer(server);
    },
  };
}

export function executePhysicalDeviceServerCommand(
  server: PhysicalDeviceServer,
  command: string,
): { message: string; shouldQuit: boolean } {
  const normalized = command.trim().toLowerCase();
  if (normalized === "legacy" || normalized === "candidate") {
    server.switchMode(normalized);
    return {
      message: `Physical-device server mode=${normalized}.`,
      shouldQuit: false,
    };
  }
  if (normalized === "status") {
    return {
      message: `Physical-device server mode=${server.mode()} candidate-sha256=${server.candidateSha256}.`,
      shouldQuit: false,
    };
  }
  if (normalized === "quit") {
    return { message: "Stopping physical-device server.", shouldQuit: true };
  }
  throw new Error(
    "unknown physical-device server command; use legacy, candidate, status, or quit",
  );
}

function numberArgument(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be an integer from 1 through 65535`);
  }
  return value;
}

function stringArgument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`missing value for ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const server = await startPhysicalDeviceServer({
    candidateDirectory: stringArgument("--candidate", "dist"),
    port: numberArgument("--port", 4173),
  });
  const consoleInput = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    consoleInput.close();
    await server.stop();
  };
  process.stdout.write(
    [
      `Physical-device server: ${server.origin}`,
      `Candidate SHA-256: ${server.candidateSha256}`,
      `Private HTTPS command: ${server.tailscaleServeCommand}`,
      "Do not use Tailscale Funnel. Commands: legacy, candidate, status, quit.",
      "Initial mode=legacy.",
    ].join("\n") + "\n",
  );
  consoleInput.on("line", (line) => {
    void Promise.resolve()
      .then(() => executePhysicalDeviceServerCommand(server, line))
      .then(async (result) => {
        process.stdout.write(`${result.message}\n`);
        if (result.shouldQuit) await close();
      })
      .catch((error: unknown) => {
        process.stderr.write(
          `${error instanceof Error ? error.message : String(error)}\n`,
        );
      });
  });
  consoleInput.once("close", () => {
    void server.stop();
  });
  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());
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
