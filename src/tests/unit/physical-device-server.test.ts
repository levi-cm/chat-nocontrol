// @vitest-environment node

import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  executePhysicalDeviceServerCommand,
  LEGACY_DEPLOY_COMMIT,
  LEGACY_DEPLOY_TREE,
  startPhysicalDeviceServer,
} from "../../../scripts/physical-device-server";
import { sha256Directory } from "../../../scripts/physical-device-evidence";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function candidateFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "cat5-physical-server-"));
  roots.push(root);
  mkdirSync(join(root, "assets"));
  writeFileSync(
    join(root, "index.html"),
    '<script type="module" src="./assets/index-CANDIDATE.js"></script>',
  );
  writeFileSync(
    join(root, "assets/index-CANDIDATE.js"),
    'const version="0.2.0-beta.1"; const protocol="CAT-5";',
  );
  writeFileSync(join(root, "manifest.webmanifest"), "{}\n");
  writeFileSync(
    join(root, "sw.js"),
    "self.skipWaiting(); self.addEventListener('activate', () => self.clients.claim());\n",
  );
  return root;
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("private physical-device two-build server", () => {
  it("serves pinned V1, switches atomically by local command, and exposes no network control", async () => {
    const candidateDirectory = candidateFixture();
    const server = await startPhysicalDeviceServer({ candidateDirectory });
    try {
      expect(server.legacyCommit).toBe(LEGACY_DEPLOY_COMMIT);
      expect(server.legacyTree).toBe(LEGACY_DEPLOY_TREE);
      expect(server.candidateSha256).toBe(sha256Directory(candidateDirectory));
      expect(server.mode()).toBe("legacy");
      const url = new URL(server.origin);
      expect(url.hostname).toBe("127.0.0.1");
      expect(url.pathname).toBe("/chat-nocontrol/");
      expect(server.tailscaleServeCommand).toContain("tailscale serve");
      expect(server.tailscaleServeCommand).toContain(
        "--set-path /chat-nocontrol",
      );
      expect(server.tailscaleServeCommand).not.toContain("funnel");

      const legacyIndex = await fetch(server.origin);
      expect(legacyIndex.status).toBe(200);
      expect(sha256(new Uint8Array(await legacyIndex.arrayBuffer()))).toBe(
        "41e18bc83251854ef195221ca5aebca9dfcc5796989d11f287f278a5e20f3cf1",
      );
      expect(legacyIndex.headers.get("cache-control")).toBe("no-store");
      expect(legacyIndex.headers.get("x-content-type-options")).toBe("nosniff");

      const status = executePhysicalDeviceServerCommand(server, "status");
      expect(status).toMatchObject({ shouldQuit: false });
      expect(status.message).toContain("mode=legacy");
      const switched = executePhysicalDeviceServerCommand(server, "candidate");
      expect(switched).toMatchObject({ shouldQuit: false });
      expect(server.mode()).toBe("candidate");

      const [candidateIndex, candidateAsset] = await Promise.all([
        fetch(server.origin),
        fetch(new URL("assets/index-CANDIDATE.js", server.origin)),
      ]);
      expect(await candidateIndex.text()).toContain("index-CANDIDATE.js");
      expect(await candidateAsset.text()).toContain("CAT-5");
      expect(candidateAsset.headers.get("content-type")).toBe(
        "text/javascript; charset=utf-8",
      );

      const head = await fetch(server.origin, { method: "HEAD" });
      expect(head.status).toBe(200);
      expect(await head.text()).toBe("");
      const post = await fetch(server.origin, { method: "POST" });
      expect(post.status).toBe(405);
      const networkControl = await fetch(
        new URL("__physical-mode/candidate", server.origin),
      );
      expect(networkControl.status).toBe(404);
      expect(() =>
        executePhysicalDeviceServerCommand(server, "network-candidate"),
      ).toThrow("unknown physical-device server command");

      executePhysicalDeviceServerCommand(server, "legacy");
      expect(server.mode()).toBe("legacy");
      expect(executePhysicalDeviceServerCommand(server, "quit")).toEqual({
        message: "Stopping physical-device server.",
        shouldQuit: true,
      });
    } finally {
      await server.stop();
    }
  });

  it("rejects candidate trees containing symlinks", async () => {
    const candidateDirectory = candidateFixture();
    symlinkSync("index.html", join(candidateDirectory, "linked-index.html"));

    await expect(
      startPhysicalDeviceServer({ candidateDirectory }),
    ).rejects.toThrow("candidate build rejects symlink");
  });
});
