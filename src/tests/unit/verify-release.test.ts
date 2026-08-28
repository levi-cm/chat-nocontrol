// @vitest-environment node

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const scriptPath = join(process.cwd(), "scripts/verify-release.ts");
const tsxPath = join(process.cwd(), "node_modules/.bin/tsx");

function command(cwd: string, executable: string, args: string[]): string {
  const result = spawnSync(executable, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

function git(cwd: string, ...args: string[]): string {
  return command(cwd, "git", args);
}

function write(cwd: string, path: string, contents: string): void {
  const fullPath = join(cwd, path);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, contents);
}

interface ReleaseRepository {
  cwd: string;
  pushMain: (commit?: string) => void;
  run: () => ReturnType<typeof spawnSync>;
  taggedCommit: string;
}

function createReleaseRepository(
  options: {
    signerNamespace?: "git" | "unrestricted";
  } = {},
): ReleaseRepository {
  const cwd = mkdtempSync(join(tmpdir(), "chat-nocontrol-release-"));
  temporaryDirectories.push(cwd);
  const origin = join(cwd, "origin.git");
  const repository = join(cwd, "repository");
  git(cwd, "init", "-q", "--bare", origin);
  git(cwd, "init", "-q", "-b", "main", repository);
  git(repository, "config", "user.name", "Release test");
  git(repository, "config", "user.email", "release@example.com");
  git(repository, "remote", "add", "origin", origin);

  const keyPath = join(cwd, "release-key");
  command(cwd, "ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", keyPath]);
  const publicKey = readFileSync(`${keyPath}.pub`, "utf8")
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .join(" ");
  const namespace =
    options.signerNamespace === "unrestricted" ? "" : ' namespaces="git"';
  write(
    repository,
    ".github/allowed_signers",
    `release@example.com${namespace} ${publicKey}\n`,
  );
  write(
    repository,
    "package.json",
    `${JSON.stringify(
      {
        name: "chat-nocontrol",
        version: "0.2.0-beta.1",
        homepage: "https://levi-cm.github.io/chat-nocontrol/",
        repository: { url: "https://github.com/levi-cm/chat-nocontrol.git" },
      },
      null,
      2,
    )}\n`,
  );
  write(repository, ".gitignore", "dist/\noutput/\n");
  write(repository, "dist/index.html", "<!doctype html>\n");
  write(repository, "dist/sw.js", "/* service worker */\n");
  write(repository, "public/manifest.webmanifest", "Chat NoControl\n");
  write(
    repository,
    "docs/deployed-releases.json",
    '{"schemaVersion":3,"authorizations":[],"deployments":[]}\n',
  );
  write(repository, "output/release/sbom.cdx.json", "{}\n");
  write(repository, "output/release/build.log", "vite build\nbuilt in 1ms\n");
  write(repository, "LICENSE", "AGPL-3.0-or-later\n");
  write(repository, "SOURCE.md", "source\n");
  git(repository, "add", ".");
  git(repository, "commit", "-q", "-m", "release candidate");
  const taggedCommit = git(repository, "rev-parse", "HEAD");
  write(
    repository,
    "output/release/test-report.json",
    `${JSON.stringify({
      schemaVersion: 1,
      package: "chat-nocontrol@0.2.0-beta.1",
      status: "passed",
      command: "npm run verify:quality",
      sourceCommit: taggedCommit,
      generatedAt: new Date().toISOString(),
    })}\n`,
  );
  command(repository, "tar", [
    "-czf",
    "output/release/chat-nocontrol-v0.2.0-beta.1.tgz",
    "dist",
    "LICENSE",
    "SOURCE.md",
  ]);

  git(repository, "config", "gpg.format", "ssh");
  git(repository, "config", "user.signingkey", keyPath);
  git(repository, "tag", "-s", "v0.2.0-beta.1", "-m", "CAT5 beta");
  git(repository, "push", "-q", "origin", "refs/tags/v0.2.0-beta.1");

  return {
    cwd: repository,
    taggedCommit,
    pushMain(commit = "HEAD") {
      git(repository, "push", "-q", "origin", `${commit}:refs/heads/main`);
      git(repository, "fetch", "-q", "origin", "main");
    },
    run() {
      return spawnSync(tsxPath, [scriptPath], {
        cwd: repository,
        encoding: "utf8",
        env: { ...process.env, REQUIRE_REMOTE_TAG: "1" },
      });
    },
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("release provenance", () => {
  it("rejects a signed remote tag whose commit is orphaned from origin/main", () => {
    const repository = createReleaseRepository();
    const tree = git(
      repository.cwd,
      "rev-parse",
      `${repository.taggedCommit}^{tree}`,
    );
    const unrelatedMain = git(
      repository.cwd,
      "commit-tree",
      tree,
      "-m",
      "unrelated main",
    );
    repository.pushMain(unrelatedMain);

    const result = repository.run();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Release blocked: exact tagged commit is not contained in origin/main",
    );
  });

  it("accepts the exact signed tag when origin/main points at that commit", () => {
    const repository = createReleaseRepository();
    repository.pushMain();

    const result = repository.run();

    expect(result.status).toBe(0);
  });

  it("accepts a later origin/main tip that contains the exact tagged commit", () => {
    const repository = createReleaseRepository();
    git(repository.cwd, "commit", "-q", "--allow-empty", "-m", "later main");
    repository.pushMain();
    git(repository.cwd, "reset", "-q", "--hard", repository.taggedCommit);

    const result = repository.run();

    expect(result.status).toBe(0);
  });

  it("rejects a release signer without a Git-only namespace restriction", () => {
    const repository = createReleaseRepository({
      signerNamespace: "unrestricted",
    });
    repository.pushMain();

    const result = repository.run();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "allowed signer entries must use exactly one approved signature namespace",
    );
  });
});
