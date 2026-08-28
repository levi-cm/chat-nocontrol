// @vitest-environment node

import { createHash } from "node:crypto";
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createLegacyPagesRollbackArtifact,
  pollLegacyPagesLiveAcceptance,
  verifyLegacyPagesRollbackArtifact,
} from "../../../scripts/legacy-pages-rollback";
import {
  LEGACY_DEPLOY_COMMIT,
  LEGACY_DEPLOY_SHA256,
  LEGACY_DEPLOY_TREE,
} from "../../../scripts/legacy-pages-baseline";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("pinned legacy Pages rollback artifact", () => {
  it("packages and freshly verifies the exact V1 tree deterministically", () => {
    const root = mkdtempSync(join(tmpdir(), "cat5-pages-rollback-"));
    roots.push(root);
    const firstTar = join(root, "first.tar");
    const secondTar = join(root, "second.tar");
    const firstBinding = join(root, "first-binding.json");
    const secondBinding = join(root, "second-binding.json");

    const first = createLegacyPagesRollbackArtifact({
      tarPath: firstTar,
      bindingPath: firstBinding,
    });
    const second = createLegacyPagesRollbackArtifact({
      tarPath: secondTar,
      bindingPath: secondBinding,
    });

    expect(first).toEqual(second);
    expect(readFileSync(firstTar)).toEqual(readFileSync(secondTar));
    expect(first).toMatchObject({
      schema: "chat-nocontrol-legacy-pages-rollback/v1",
      commit: LEGACY_DEPLOY_COMMIT,
      tree: LEGACY_DEPLOY_TREE,
      pinnedSha256: LEGACY_DEPLOY_SHA256,
    });
    const indexEntry = first.files.find((file) => file.path === "index.html");
    expect(indexEntry).toMatchObject({
      path: "index.html",
      sha256: LEGACY_DEPLOY_SHA256["index.html"],
    });
    expect(indexEntry?.size).toBeGreaterThan(0);
    expect(
      verifyLegacyPagesRollbackArtifact({
        tarPath: firstTar,
        bindingPath: firstBinding,
      }),
    ).toEqual(first);
  });

  it("polls through stale CDN bytes and accepts only the pinned V1 hashes", async () => {
    const expected = new Map(
      Object.entries(LEGACY_DEPLOY_SHA256).map(([path, digest]) => [
        `/${path}`,
        { digest, bytes: new Uint8Array() },
      ]),
    );
    const actualBytes = new Map<string, Uint8Array>();
    for (const path of expected.keys()) {
      const bytes = Buffer.from(`pinned:${path}`);
      actualBytes.set(path, bytes);
      const entry = expected.get(path);
      if (entry)
        entry.digest = createHash("sha256").update(bytes).digest("hex");
    }
    const result = await pollLegacyPagesLiveAcceptance({
      deploymentUrl: "https://example.test/",
      expectedSha256: Object.fromEntries(
        [...expected].map(([path, value]) => [path.slice(1), value.digest]),
      ),
      attempts: 2,
      intervalMs: 0,
      requestTimeoutMs: 1_000,
      sleep: () => Promise.resolve(),
      fetcher: (input) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input
              : input.url,
        );
        const body =
          url.searchParams.get("rollback-check") === "1"
            ? "stale"
            : actualBytes.get(url.pathname);
        const responseBody =
          typeof body === "string"
            ? body
            : body
              ? Uint8Array.from(body).buffer
              : "missing";
        return Promise.resolve(new Response(responseBody, { status: 200 }));
      },
    });

    expect(result.attempt).toBe(2);
    expect(result.sha256).toEqual(
      Object.fromEntries(
        [...expected].map(([path, value]) => [path.slice(1), value.digest]),
      ),
    );
  });

  it("rejects any change to the uploaded rollback tar", () => {
    const root = mkdtempSync(join(tmpdir(), "cat5-pages-rollback-tamper-"));
    roots.push(root);
    const tarPath = join(root, "artifact.tar");
    const bindingPath = join(root, "binding.json");
    createLegacyPagesRollbackArtifact({ tarPath, bindingPath });
    appendFileSync(tarPath, "tampered");

    expect(() =>
      verifyLegacyPagesRollbackArtifact({ tarPath, bindingPath }),
    ).toThrow("rollback artifact tar SHA-256 mismatch");
  });
});
