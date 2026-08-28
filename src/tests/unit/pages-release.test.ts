// @vitest-environment node

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  createPagesArtifactBinding,
  pollLiveAcceptance,
  validateArtifactMetadata,
  verifyPagesArtifactBinding,
} from "../../../scripts/pages-release";

const COMMIT = "a".repeat(40);
const DIGEST = `sha256:${"b".repeat(64)}`;
const releaseWorkflow = readFileSync(
  resolve(".github/workflows/release.yml"),
  "utf8",
);
const exactNodeVersion = readFileSync(resolve(".node-version"), "utf8").trim();

function pagesFixture(): { dist: string; tar: string } {
  const root = mkdtempSync(join(tmpdir(), "cat5-pages-release-"));
  const dist = join(root, "dist");
  const assets = join(dist, "assets");
  mkdirSync(assets, { recursive: true });
  writeFileSync(
    join(dist, "index.html"),
    '<div id="app"></div><script type="module" src="./assets/index-CAT5.js"></script>',
  );
  writeFileSync(
    join(assets, "index-CAT5.js"),
    'const version="0.2.0-beta.1"; const protocol="CAT-5";',
  );
  writeFileSync(join(dist, "manifest.webmanifest"), "{}\n");
  const tar = join(root, "artifact.tar");
  const archived = spawnSync(
    "tar",
    ["--directory", dist, "--create", "--file", tar, "."],
    { encoding: "utf8" },
  );
  if (archived.status !== 0) throw new Error(archived.stderr);
  return { dist, tar };
}

function requestUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) return input;
  if (typeof input === "string") return new URL(input);
  return new URL(input.url);
}

function noSleep(): Promise<void> {
  return Promise.resolve();
}

describe("Pages release artifact binding", () => {
  it("binds the exact tar payload, verified dist tree, artifact ID, and digest", () => {
    const fixture = pagesFixture();
    const binding = createPagesArtifactBinding({
      distDirectory: fixture.dist,
      artifactTar: fixture.tar,
      artifactId: "123456",
      artifactDigest: DIGEST,
      commit: COMMIT,
      tag: "v0.2.0-beta.1",
      version: "0.2.0-beta.1",
    });

    expect(
      verifyPagesArtifactBinding({
        artifactTar: fixture.tar,
        binding,
        expectedArtifactId: "123456",
        expectedArtifactDigest: DIGEST,
        expectedCommit: COMMIT,
        expectedTag: "v0.2.0-beta.1",
      }),
    ).toEqual({ version: "0.2.0-beta.1" });

    writeFileSync(
      fixture.tar,
      Buffer.concat([readFileSync(fixture.tar), Buffer.from("tampered")]),
    );
    expect(() =>
      verifyPagesArtifactBinding({
        artifactTar: fixture.tar,
        binding,
        expectedArtifactId: "123456",
        expectedArtifactDigest: DIGEST,
        expectedCommit: COMMIT,
        expectedTag: "v0.2.0-beta.1",
      }),
    ).toThrow("Pages artifact tar digest does not match binding");
  });

  it("requires metadata for the same immutable artifact and workflow run", () => {
    expect(
      validateArtifactMetadata(
        {
          id: 123456,
          name: "github-pages",
          expired: false,
          digest: DIGEST,
          workflow_run: { id: 789, head_sha: COMMIT },
        },
        {
          artifactId: "123456",
          artifactDigest: DIGEST,
          commit: COMMIT,
          runId: "789",
        },
      ),
    ).toEqual({ artifactId: "123456", artifactDigest: DIGEST });

    expect(() =>
      validateArtifactMetadata(
        {
          id: 123456,
          name: "github-pages",
          expired: false,
          digest: DIGEST,
          workflow_run: { id: 790, head_sha: COMMIT },
        },
        {
          artifactId: "123456",
          artifactDigest: DIGEST,
          commit: COMMIT,
          runId: "789",
        },
      ),
    ).toThrow("workflow run");
  });
});

describe("live Pages acceptance", () => {
  it("polls through a stale legacy shell and accepts the exact CAT5 build", async () => {
    let attempts = 0;
    const fetcher: typeof fetch = (input) => {
      const url = requestUrl(input);
      if (url.pathname.endsWith("/index-CAT5.js")) {
        return Promise.resolve(
          new Response(
            'const version="0.2.0-beta.1"; const protocol="CAT-5";',
            { status: 200, headers: { "content-type": "text/javascript" } },
          ),
        );
      }
      attempts += 1;
      if (attempts === 1) {
        return Promise.resolve(
          new Response(
            '<script type="module" src="./assets/index-old.js"></script>',
            { status: 200, headers: { "content-type": "text/html" } },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          '<div id="app"></div><script type="module" src="./assets/index-CAT5.js"></script>',
          { status: 200, headers: { "content-type": "text/html" } },
        ),
      );
    };

    const result = await pollLiveAcceptance({
      deploymentUrl: "https://example.test/chat-nocontrol/",
      version: "0.2.0-beta.1",
      attempts: 2,
      intervalMs: 0,
      requestTimeoutMs: 1_000,
      fetcher,
      sleep: noSleep,
    });

    expect(result).toMatchObject({
      attempt: 2,
      version: "0.2.0-beta.1",
      modulePath: "/chat-nocontrol/assets/index-CAT5.js",
    });
  });

  it("rejects the legacy update choice even when the version marker is forged", async () => {
    const fetcher: typeof fetch = (input) => {
      const url = requestUrl(input);
      const body = url.pathname.endsWith(".js")
        ? 'const version="0.2.0-beta.1"; const protocol="CAT-5"; const old="__PPX_UPDATE_AVAILABLE__";'
        : '<div id="app"></div><script type="module" src="./assets/index-CAT5.js"></script>';
      return Promise.resolve(
        new Response(body, {
          status: 200,
          headers: {
            "content-type": url.pathname.endsWith(".js")
              ? "text/javascript"
              : "text/html",
          },
        }),
      );
    };

    await expect(
      pollLiveAcceptance({
        deploymentUrl: "https://example.test/chat-nocontrol/",
        version: "0.2.0-beta.1",
        attempts: 1,
        intervalMs: 0,
        requestTimeoutMs: 1_000,
        fetcher,
        sleep: noSleep,
      }),
    ).rejects.toThrow("legacy update-choice marker");
  });

  it("rejects old V1 message-QR write controls in an otherwise CAT5 bundle", async () => {
    const fetcher: typeof fetch = (input) => {
      const url = requestUrl(input);
      const body = url.pathname.endsWith(".js")
        ? 'const version="0.2.0-beta.1"; const protocol="CAT-5"; const old="Download in-app message QR";'
        : '<div id="app"></div><script type="module" src="./assets/index-CAT5.js"></script>';
      return Promise.resolve(
        new Response(body, {
          status: 200,
          headers: {
            "content-type": url.pathname.endsWith(".js")
              ? "text/javascript"
              : "text/html",
          },
        }),
      );
    };

    await expect(
      pollLiveAcceptance({
        deploymentUrl: "https://example.test/chat-nocontrol/",
        version: "0.2.0-beta.1",
        attempts: 1,
        intervalMs: 0,
        requestTimeoutMs: 1_000,
        fetcher,
        sleep: noSleep,
      }),
    ).rejects.toThrow("legacy V1 write UI");
  });

  it("fails closed after the bounded CDN polling window", async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(
        new Response("missing", {
          status: 404,
          headers: { "content-type": "text/html" },
        }),
      );

    await expect(
      pollLiveAcceptance({
        deploymentUrl: "https://example.test/chat-nocontrol/",
        version: "0.2.0-beta.1",
        attempts: 2,
        intervalMs: 0,
        requestTimeoutMs: 1_000,
        fetcher,
        sleep: noSleep,
      }),
    ).rejects.toThrow("Live Pages acceptance failed after 2 attempts");
  });
});

describe("release workflow structure", () => {
  it("runs candidate verification without deployment approval and gates the first public mutation", () => {
    const jobBlocks = releaseWorkflow.split(/\n(?= {2}[a-z][a-z-]+:\n)/u);
    const verifyCandidate =
      jobBlocks.find((block) => block.startsWith("  verify-candidate:\n")) ??
      "";
    const authorizeDeployment =
      jobBlocks.find((block) =>
        block.startsWith("  authorize-deployment:\n"),
      ) ?? "";

    expect(verifyCandidate).not.toContain(
      "if: ${{ inputs.confirm_deployment == true }}",
    );
    expect(authorizeDeployment).toContain(
      "if: ${{ inputs.confirm_deployment == true }}",
    );
  });

  it("sets up exact project Node before candidate validation uses node", () => {
    const setup = releaseWorkflow.indexOf("name: Set up exact project Node.js");
    const candidate = releaseWorkflow.indexOf(
      "name: Validate exact beta candidate",
    );
    expect(setup).toBeGreaterThan(-1);
    expect(candidate).toBeGreaterThan(setup);
    expect(releaseWorkflow).toContain("node-version-file: .node-version");
    expect(exactNodeVersion).toBe("22.23.1");
  });

  it("sets up project Node before every job that runs project Node commands", () => {
    const jobBlocks = releaseWorkflow.split(/\n(?= {2}[a-z][a-z-]+:\n)/u);
    const projectCommand = /^ {8,}(?:node|npm|npx)\s/imu;
    for (const block of jobBlocks.filter((candidate) =>
      projectCommand.test(candidate),
    )) {
      const setup = block.indexOf("name: Set up exact project Node.js");
      const command = block.search(projectCommand);
      expect(setup).toBeGreaterThan(-1);
      expect(command).toBeGreaterThan(setup);
    }
  });

  it("binds and attests the exact immutable Pages artifact before deployment", () => {
    expect(releaseWorkflow).toMatch(
      /id: pages-artifact[\s\S]+uses: actions\/upload-artifact@[a-f0-9]{40}/u,
    );
    expect(releaseWorkflow).toContain(
      "artifact_id: ${{ steps.pages-artifact.outputs.artifact-id }}",
    );
    expect(releaseWorkflow).toContain(
      "artifact_digest: ${{ steps.pages-artifact.outputs.artifact-digest }}",
    );
    expect(releaseWorkflow).toContain(
      "${{ runner.temp }}/pages-artifact/artifact.tar",
    );
    expect(releaseWorkflow).toMatch(
      /Attest exact deployed Pages artifact[\s\S]+Deploy exact verified Pages artifact/u,
    );
  });

  it("blocks release finalization on bounded semantic live acceptance", () => {
    expect(releaseWorkflow).toContain("live-acceptance:");
    expect(releaseWorkflow).toContain("--attempts 20");
    expect(releaseWorkflow).toContain(
      "[verify-candidate, authorize-deployment, deploy-pages, live-acceptance]",
    );
  });

  it("packages pinned V1 before mutation and rolls back only after a failed live deployment", () => {
    const verify = releaseWorkflow.indexOf("verify-candidate:");
    const packageRollback = releaseWorkflow.indexOf(
      "name: Package verified pinned V1 rollback artifact",
    );
    const authorize = releaseWorkflow.indexOf("authorize-deployment:");
    expect(packageRollback).toBeGreaterThan(verify);
    expect(packageRollback).toBeLessThan(authorize);
    expect(releaseWorkflow).toContain("rollback_artifact_id:");
    expect(releaseWorkflow).toContain("rollback_artifact_digest:");
    expect(releaseWorkflow).toContain("rollback-pages:");
    expect(releaseWorkflow).toContain(
      "needs.deploy-pages.outputs.mutation_state == 'MUTATED'",
    );
    expect(releaseWorkflow).toContain(
      "needs.deploy-pages.outputs.mutation_state == 'UNKNOWN'",
    );
    expect(releaseWorkflow).toContain("needs.deploy-pages.result != 'success'");
    expect(releaseWorkflow).toContain(
      "artifact_name: github-pages-rollback-v1",
    );
    expect(releaseWorkflow).toContain(
      "name: Verify pinned V1 is live after rollback",
    );
    expect(releaseWorkflow).toContain(
      "name: Mark rollback deployment window start",
    );
    expect(releaseWorkflow).toContain(
      "name: Mark rollback deployment window end",
    );
    expect(releaseWorkflow).toContain(
      "path: ${{ runner.temp }}/rollback-pages/artifact.tar",
    );
    expect(releaseWorkflow).toContain(
      'test "$(find "$RUNNER_TEMP/rollback-artifact" -type f -printf \'%P\\n\')" = "artifact.tar"',
    );
    expect(releaseWorkflow).toContain(
      "npx tsx scripts/record-pages-rollback.ts",
    );
    expect(releaseWorkflow).toContain(
      "CANDIDATE_DEPLOYMENT_STARTED_AT: ${{ needs.deploy-pages.outputs.started_at }}",
    );
    expect(releaseWorkflow).toContain(
      "ROLLBACK_DEPLOYMENT_STARTED_AT: ${{ steps.rollback-window-start.outputs.timestamp }}",
    );
    expect(releaseWorkflow).toContain(
      "name: Detect whether Pages was actually mutated",
    );
    expect(releaseWorkflow).toContain(
      "mutation_state: ${{ steps.pages-mutation.outputs.state || steps.pages-mutation-fallback.outputs.state }}",
    );
    expect(releaseWorkflow).toContain(
      "if: ${{ always() && steps.deployment-window-start.outputs.timestamp != '' }}",
    );
    expect(releaseWorkflow).toContain(
      "name: Fail safe when mutation detection is unavailable",
    );
    expect(releaseWorkflow).toContain('run: echo "state=UNKNOWN"');
  });

  it("turns rollback failure into a hard failure with exact manual recovery", () => {
    expect(releaseWorkflow).toContain(
      "name: Report hard rollback failure and exact manual recovery",
    );
    expect(releaseWorkflow).toContain("if: ${{ failure() }}");
    expect(releaseWorkflow).toContain("automated V1 rollback failed");
    expect(releaseWorkflow).toContain(
      "1a3a5b4d5e55ab78d2bf4692eed2d3545856e291",
    );
    expect(releaseWorkflow).toContain(
      "f58cbb1e46f3e046139788a62bf0333d13c1c1a5",
    );
    expect(releaseWorkflow).toContain(
      "restore the source to **Deploy from a branch**, branch `gh-pages`, folder `/`",
    );
    expect(releaseWorkflow).toContain("exit 1");
  });

  it("keeps the prerelease draft on rollback and publishes only after live CAT5 success", () => {
    const blocks = releaseWorkflow.split(/\n(?= {2}[a-z][a-z-]+:\n)/u);
    const rollback =
      blocks.find((block) => block.startsWith("  rollback-pages:\n")) ?? "";
    const finalize =
      blocks.find((block) => block.startsWith("  finalize-evidence:\n")) ?? "";
    expect(rollback).not.toContain("gh release edit");
    expect(rollback).not.toContain("gh release upload");
    expect(finalize).toContain("live-acceptance");
    expect(finalize).toContain("gh release edit");
  });

  it("imports trusted-tester-signed physical evidence only after preparing release bytes", () => {
    expect(releaseWorkflow).toContain("physical_evidence_sha256:");
    expect(releaseWorkflow).toContain(
      "name: Download signed physical-device evidence from the draft prerelease",
    );
    const prepare = releaseWorkflow.indexOf(
      "name: Prepare exact release bytes",
    );
    const importEvidence = releaseWorkflow.indexOf(
      "name: Import exact physical-device evidence",
    );
    const verify = releaseWorkflow.indexOf(
      "name: Verify review evidence, signature, quality, reproducibility, SBOM, and archive",
    );
    expect(prepare).toBeGreaterThan(-1);
    expect(importEvidence).toBeGreaterThan(prepare);
    expect(verify).toBeGreaterThan(importEvidence);
    expect(releaseWorkflow).toContain("npm run release:prepare");
    expect(releaseWorkflow).toContain(
      "npm run release:import-physical-evidence",
    );
    expect(releaseWorkflow).toContain(
      '--signature "$RUNNER_TEMP/physical-evidence/physical-device-release-evidence.json.sig"',
    );
    expect(releaseWorkflow).toContain("npm run verify:prepared");
  });

  it("commits exact authorization before deployment and deployment evidence before publication", () => {
    const authorization = releaseWorkflow.indexOf(
      "name: Append authorization to canonical ledger before deployment",
    );
    const deploy = releaseWorkflow.indexOf(
      "name: Deploy exact verified Pages artifact",
    );
    const ledger = releaseWorkflow.indexOf(
      "name: Append canonical deployment ledger evidence",
    );
    const publish = releaseWorkflow.indexOf(
      "name: Publish matching prerelease only after canonical ledger success",
    );
    expect(authorization).toBeGreaterThan(-1);
    expect(deploy).toBeGreaterThan(authorization);
    expect(ledger).toBeGreaterThan(deploy);
    expect(publish).toBeGreaterThan(ledger);
    expect(releaseWorkflow).toContain(
      "needs: [verify-candidate, authorize-deployment]",
    );
  });

  it("pins every third-party action to a full commit SHA", () => {
    const uses = [...releaseWorkflow.matchAll(/^\s*uses:\s*([^\s#]+)/gmu)].map(
      (match) => match[1] ?? "",
    );
    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) {
      expect(action).toMatch(/^[^@]+@[a-f0-9]{40}$/u);
    }
  });
});
