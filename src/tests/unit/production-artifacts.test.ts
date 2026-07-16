// @vitest-environment node

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inspectProductionArtifacts } from "../../../scripts/production-artifacts";

const roots: string[] = [];

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "chat-nocontrol-dist-"));
  roots.push(root);
  await mkdir(join(root, "assets"));
  await writeFile(
    join(root, "index.html"),
    "<!doctype html><title>App</title>",
  );
  await writeFile(
    join(root, "sw.js"),
    "self.skipWaiting();workbox.clientsClaim();workbox.precacheAndRoute([]);",
  );
  await writeFile(join(root, "assets", "app.js"), "console.log('ok');");
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("production artifact inspection", () => {
  it("accepts a clean production shell", async () => {
    expect(inspectProductionArtifacts(await fixture())).toEqual([]);
  });

  it("rejects source maps and sourceMappingURL references recursively", async () => {
    const root = await fixture();
    await writeFile(join(root, "assets", "app.js.map"), "{}");
    await writeFile(
      join(root, "assets", "chunk.js"),
      "console.log('bad');\n//# sourceMappingURL=chunk.js.map",
    );

    expect(inspectProductionArtifacts(root)).toEqual([
      "source map file: assets/app.js.map",
      "sourceMappingURL reference: assets/chunk.js",
    ]);
  });

  it("rejects a missing production shell file", async () => {
    const root = await fixture();
    await rm(join(root, "sw.js"));
    expect(inspectProductionArtifacts(root)).toEqual([
      "missing production shell file: sw.js",
    ]);
  });

  it("rejects an approval-based service-worker update", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "sw.js"),
      "self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });",
    );

    expect(inspectProductionArtifacts(root)).toEqual([
      "service worker does not claim clients automatically",
      "service worker waits for update approval",
    ]);
  });

  it("rejects a service worker that does not activate immediately", async () => {
    const root = await fixture();
    await writeFile(join(root, "sw.js"), "workbox.clientsClaim();");

    expect(inspectProductionArtifacts(root)).toEqual([
      "service worker does not activate updates automatically",
    ]);
  });
});
