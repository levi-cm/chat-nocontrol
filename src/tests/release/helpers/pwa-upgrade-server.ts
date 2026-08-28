import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:https";
import { extname, resolve } from "node:path";
import { testTlsCredentials } from "../../helpers/test-tls";

export const LEGACY_DEPLOY_COMMIT = "1a3a5b4d5e55ab78d2bf4692eed2d3545856e291";
const LEGACY_DEPLOY_TREE = "f58cbb1e46f3e046139788a62bf0333d13c1c1a5";
const LEGACY_SHA256: Readonly<Record<string, string>> = {
  "index.html":
    "41e18bc83251854ef195221ca5aebca9dfcc5796989d11f287f278a5e20f3cf1",
  "sw.js": "ce35e1a513c74d9e49d84e320c999e1d0024ea0eaa4465a6645ebd512de71c78",
  "assets/index-CZw01I_i.js":
    "f27e8834c19d996089627c33b68e61e95024b3fc65b8c47b412d3957fa2ecf29",
};

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

function gitText(...args: string[]): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}

function gitBytes(path: string): Uint8Array {
  return execFileSync("git", ["show", `${LEGACY_DEPLOY_COMMIT}:${path}`], {
    maxBuffer: 16 * 1024 * 1024,
  });
}

function loadVerifiedLegacyDeploy(): ReadonlyMap<string, Uint8Array> {
  const actualCommit = gitText("rev-parse", `${LEGACY_DEPLOY_COMMIT}^{commit}`);
  const actualTree = gitText("show", "-s", "--format=%T", LEGACY_DEPLOY_COMMIT);
  if (
    actualCommit !== LEGACY_DEPLOY_COMMIT ||
    actualTree !== LEGACY_DEPLOY_TREE
  ) {
    throw new Error("legacy deployment Git identity mismatch");
  }
  const paths = gitText(
    "ls-tree",
    "-r",
    "--name-only",
    LEGACY_DEPLOY_COMMIT,
  ).split("\n");
  const files = new Map(paths.map((path) => [path, gitBytes(path)]));
  for (const [path, expected] of Object.entries(LEGACY_SHA256)) {
    const bytes = files.get(path);
    if (!bytes) throw new Error(`legacy deployment missing ${path}`);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== expected)
      throw new Error(`legacy deployment SHA-256 mismatch for ${path}`);
  }
  return files;
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolveStop, reject) => {
    server.close((error) => (error ? reject(error) : resolveStop()));
    server.closeAllConnections();
  });
}

export async function startPwaUpgradeServer(): Promise<{
  origin: string;
  legacyCommit: string;
  requests(): ReadonlyArray<string>;
  serveCurrentBuild(): void;
  stop(): Promise<void>;
}> {
  const legacyFiles = loadVerifiedLegacyDeploy();
  const distRoot = resolve(process.cwd(), "dist");
  const requestLog: string[] = [];
  let mode: "legacy" | "current" = "legacy";
  const server = createServer(testTlsCredentials(), (request, response) => {
    void (async () => {
      try {
        requestLog.push(
          `${request.method ?? "GET"} ${request.url ?? "/"} referrer=${request.headers.referer ?? ""}`,
        );
        const requestUrl = new URL(request.url ?? "/", "https://127.0.0.1");
        const relativePath = decodeURIComponent(requestUrl.pathname).replace(
          /^\/+/,
          "",
        );
        if (mode === "legacy") {
          const requestedPath = relativePath || "index.html";
          const bytes = legacyFiles.get(requestedPath);
          if (!bytes) {
            response.writeHead(404).end();
            return;
          }
          response.writeHead(200, {
            "cache-control": "no-store",
            "content-type":
              contentTypes[extname(requestedPath)] ??
              "application/octet-stream",
            "service-worker-allowed": "/",
          });
          response.end(bytes);
          return;
        }

        const requestedPath = relativePath || "index.html";
        const filePath = resolve(distRoot, requestedPath);
        if (!filePath.startsWith(`${distRoot}/`)) {
          response.writeHead(403).end();
          return;
        }
        let bytes: Uint8Array;
        try {
          bytes = await readFile(filePath);
        } catch {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          "cache-control": "no-store",
          "content-type":
            contentTypes[extname(filePath)] ?? "application/octet-stream",
          "service-worker-allowed": "/",
        });
        response.end(bytes);
      } catch {
        response.writeHead(500).end();
      }
    })();
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await stopServer(server);
    throw new Error("PWA upgrade server did not bind a TCP port");
  }
  let stopped = false;
  return {
    origin: `https://127.0.0.1:${address.port}`,
    legacyCommit: LEGACY_DEPLOY_COMMIT,
    requests: () => [...requestLog],
    serveCurrentBuild() {
      mode = "current";
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      await stopServer(server);
    },
  };
}
