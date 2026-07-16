import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { encryptText } from "../../crypto/text";
import { encodeMessageLink } from "../../protocol/message-link";
import { createPublicContact } from "../../protocol/ppxc";

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolveStop, reject) => {
    server.close((error) => (error ? reject(error) : resolveStop()));
    server.closeAllConnections();
  });
}

async function startEphemeralStaticServer(): Promise<{
  origin: string;
  stop(): Promise<void>;
}> {
  const distRoot = resolve(process.cwd(), "dist");
  const server = createServer((request, response) => {
    void (async () => {
      try {
        const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
        const relativePath =
          requestUrl.pathname === "/"
            ? "index.html"
            : decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
        let filePath = resolve(distRoot, relativePath);
        if (!filePath.startsWith(`${distRoot}/`) && filePath !== distRoot) {
          response.writeHead(403).end();
          return;
        }
        let bytes: Uint8Array;
        try {
          bytes = await readFile(filePath);
        } catch {
          filePath = join(distRoot, "index.html");
          bytes = await readFile(filePath);
        }
        response.writeHead(200, {
          "cache-control": "no-store",
          "content-type":
            contentTypes[extname(filePath)] ?? "application/octet-stream",
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
    throw new Error("ephemeral static server did not bind a TCP port");
  }
  let stopped = false;
  return {
    origin: `http://127.0.0.1:${address.port}`,
    async stop() {
      if (stopped) return;
      stopped = true;
      await stopServer(server);
    },
  };
}

test("versioned app shell reloads after its origin server disappears", async ({
  page,
}) => {
  const sender = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(101),
    "Offline sender",
  );
  const recipient = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(102),
    "Offline recipient",
  );
  const incomingHash = new URL(
    encodeMessageLink(
      {
        kind: "ppxt",
        object: await encryptText({
          sender: createPublicContact(sender, "Offline sender", 101n),
          senderSigningCapability: createSenderSigningCapability(sender),
          recipient: createPublicContact(recipient, "Offline recipient", 102n),
          plaintext: "offline encrypted message",
          messageId: new Uint8Array(16).fill(103),
          sentAt: 104n,
          createdAt: 104n,
        }),
      },
      "https://offline.example/",
    ),
  ).hash;
  const staticServer = await startEphemeralStaticServer();
  let stopped = false;
  try {
    await page.goto(`${staticServer.origin}/`);
    await page.evaluate(async () => navigator.serviceWorker.ready);
    await page.reload();
    const cachedUrls = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        for (const request of await (await caches.open(name)).keys())
          urls.push(request.url);
      }
      return urls;
    });
    expect(
      cachedUrls.some((url) => new URL(url).pathname.endsWith("/index.html")),
    ).toBe(true);
    expect(
      cachedUrls.some((url) =>
        /\/assets\/.*\.js$/u.test(new URL(url).pathname),
      ),
    ).toBe(true);
    expect(
      cachedUrls.some((url) =>
        /\.(?:ppxcontact|ppxmessage|ppxrecovery|ppxvault)$/u.test(
          new URL(url).pathname,
        ),
      ),
    ).toBe(false);
    expect(
      await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    ).toBe(true);

    const reloadSentinel = "__chatNoControlOfflineReloadSentinel";
    await page.evaluate(
      (key) => Reflect.set(window, key, true),
      reloadSentinel,
    );
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => false,
      });
    });
    await staticServer.stop();
    stopped = true;
    await page.reload();

    await expect
      .poll(() =>
        page.evaluate((key) => Reflect.has(window, key), reloadSentinel),
      )
      .toBe(false);
    await expect(
      page.getByRole("heading", { name: "Create identity or import identity" }),
    ).toBeVisible();
    await expect(
      page.getByText("You are offline, but this session can keep working."),
    ).toBeVisible();
    await page.evaluate((hash) => {
      window.location.hash = hash;
    }, incomingHash);
    await expect(page).toHaveURL(/#\/decrypt$/u);
    await expect(
      page.getByRole("heading", { name: "Open encrypted message" }),
    ).toBeVisible();
    await expect(page.getByLabel("24 recovery words")).toBeVisible();
  } finally {
    if (!stopped) await staticServer.stop();
  }
});
