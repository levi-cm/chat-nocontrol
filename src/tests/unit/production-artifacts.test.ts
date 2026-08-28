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

  it("accepts the injectManifest clients.claim activation shape", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "sw.js"),
      "self.skipWaiting();self.addEventListener('activate',()=>self.clients.claim());",
    );
    expect(inspectProductionArtifacts(root)).toEqual([]);
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

  it("rejects map files case-insensitively", async () => {
    const root = await fixture();
    await writeFile(join(root, "assets", "APP.JS.MAP"), "{}");

    expect(inspectProductionArtifacts(root)).toEqual([
      "source map file: assets/APP.JS.MAP",
    ]);
  });

  it("rejects source map directives in CSS, HTML, and manifests", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "assets", "app.css"),
      "body{}\n/*# sourceMappingURL=data:application/json;base64,e30= */",
    );
    await writeFile(
      join(root, "inline.html"),
      "<script>console.log('bad')//# sourceURL=inline-worker.js</script>",
    );
    await writeFile(
      join(root, "manifest.webmanifest"),
      '{"debug":"//# sourceMappingURL=manifest.json.map"}',
    );

    expect(inspectProductionArtifacts(root)).toEqual([
      "sourceMappingURL reference: assets/app.css",
      "sourceMappingURL reference: manifest.webmanifest",
      "sourceURL reference: inline.html",
    ]);
  });

  it("rejects source map directives embedded in SVG", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "assets", "icon.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"><script><![CDATA[//# sourceMappingURL=icon.svg.map]]></script></svg>',
    );

    expect(inspectProductionArtifacts(root)).toEqual([
      "sourceMappingURL reference: assets/icon.svg",
    ]);
  });

  it("accepts harmless source directive words in text artifacts", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "assets", "diagnostics.js"),
      'console.log("sourceMappingURL", "sourceURL");',
    );

    expect(inspectProductionArtifacts(root)).toEqual([]);
  });

  it("finds a binary source map directive across bounded scan chunks", async () => {
    const root = await fixture();
    const prefix = Buffer.alloc(64 * 1024 - 7, 0);
    const directive = Buffer.from(
      "//# sourceMappingURL=data:application/json,{}",
      "ascii",
    );
    await writeFile(
      join(root, "assets", "binary-worker.js"),
      Buffer.concat([prefix, directive]),
    );

    expect(inspectProductionArtifacts(root)).toEqual([
      "sourceMappingURL reference: assets/binary-worker.js",
    ]);
  });

  it("does not interpret binary asset payloads as source directives", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "assets", "image.png"),
      Buffer.from("\0sourceMappingURL=not-a-map\0", "ascii"),
    );

    expect(inspectProductionArtifacts(root)).toEqual([]);
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
