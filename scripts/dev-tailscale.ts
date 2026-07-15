import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";

interface TailscaleStatus {
  BackendState?: string;
  Self?: { DNSName?: string; Online?: boolean };
}

function readTailscaleStatus(): TailscaleStatus {
  try {
    return JSON.parse(
      execFileSync("tailscale", ["status", "--json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    ) as TailscaleStatus;
  } catch {
    throw new Error(
      "Tailscale is unavailable. Install it, sign in, and bring this node online.",
    );
  }
}

function secureDevelopmentUrl(status: TailscaleStatus): string {
  if (status.BackendState !== "Running" || status.Self?.Online !== true) {
    throw new Error("Tailscale is not online on this node.");
  }
  const dnsName = status.Self.DNSName?.replace(/\.$/u, "");
  if (!dnsName) throw new Error("Tailscale did not report a node DNS name.");
  return `https://${dnsName}/`;
}

function childCompletion(child: ChildProcess): Promise<number> {
  return new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

function waitForPort(port: number, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const probe = () => {
      const socket = createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Vite did not open 127.0.0.1:${port}.`));
        } else {
          setTimeout(probe, 100);
        }
      });
    };
    probe();
  });
}

function terminate(child: ChildProcess | undefined, signal: NodeJS.Signals) {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
  }
}

export async function main(): Promise<void> {
  const url = secureDevelopmentUrl(readTailscaleStatus());
  const hostname = new URL(url).hostname;
  const viteEntry = fileURLToPath(
    new URL("../node_modules/vite/bin/vite.js", import.meta.url),
  );
  let vite: ChildProcess | undefined;
  let serve: ChildProcess | undefined;
  let requestedSignal: NodeJS.Signals | undefined;
  const forwardSignal = (signal: NodeJS.Signals) => {
    requestedSignal = signal;
    terminate(serve, signal);
    terminate(vite, signal);
  };
  const onSigint = () => forwardSignal("SIGINT");
  const onSigterm = () => forwardSignal("SIGTERM");
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

  try {
    vite = spawn(
      process.execPath,
      [viteEntry, "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: hostname,
        },
      },
    );
    const viteDone = childCompletion(vite);
    await Promise.race([
      waitForPort(5173),
      viteDone.then(() => {
        throw new Error("Vite exited before opening port 5173.");
      }),
    ]);

    serve = spawn(
      "tailscale",
      ["serve", "--https=443", "http://127.0.0.1:5173"],
      { stdio: "inherit" },
    );
    const serveDone = childCompletion(serve);
    console.log(`Secure development URL: ${url}`);
    const firstExitCode = await Promise.race([viteDone, serveDone]);
    terminate(serve, "SIGTERM");
    terminate(vite, "SIGTERM");
    await Promise.all([viteDone, serveDone]);
    if (!requestedSignal && firstExitCode !== 0)
      process.exitCode = firstExitCode;
  } finally {
    process.removeListener("SIGINT", onSigint);
    process.removeListener("SIGTERM", onSigterm);
    terminate(serve, requestedSignal ?? "SIGTERM");
    terminate(vite, requestedSignal ?? "SIGTERM");
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
