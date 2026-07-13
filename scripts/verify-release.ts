import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  buildReleaseRecord,
  releaseArtifactName,
  serializeEvidence,
} from "./release-evidence";
import {
  type RecordedPagesDeployment,
  verifyRecordedPagesDeployment,
} from "./github-deployment-evidence";

function git(args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

if (!existsSync("dist/index.html") || !existsSync("dist/sw.js")) {
  throw new Error("Release artifact missing: run npm run build");
}

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  name: string;
  version: string;
  homepage: string;
  repository: { url: string };
};
const repositoryUrl = new URL(manifest.repository.url);
const repositoryPath = repositoryUrl.pathname.replace(/\.git$/u, "");
const repositoryParts = repositoryPath.split("/").filter(Boolean);
if (
  repositoryUrl.protocol !== "https:" ||
  repositoryUrl.hostname !== "github.com" ||
  repositoryParts.length !== 2
) {
  throw new Error("Release blocked: package repository is not a GitHub repo");
}
const [repositoryOwner, repositoryName] = repositoryParts as [string, string];
const expectedTag = `v${manifest.version}`;
const commit = git(["rev-parse", "HEAD"]);
if (git(["status", "--porcelain"]) !== "") {
  throw new Error("Release blocked: source tree has uncommitted changes");
}
const tags = git(["tag", "--points-at", "HEAD"]).split("\n");
if (!tags.includes(expectedTag)) {
  throw new Error(`Release blocked: HEAD lacks exact tag ${expectedTag}`);
}
if (git(["cat-file", "-t", `refs/tags/${expectedTag}`]) !== "tag") {
  throw new Error(`Release blocked: ${expectedTag} is not an annotated tag`);
}
if (git(["rev-list", "-n", "1", expectedTag]) !== commit) {
  throw new Error(`Release blocked: ${expectedTag} does not resolve to HEAD`);
}
const tagObject = git(["cat-file", "-p", `refs/tags/${expectedTag}`]);
if (
  !/-----BEGIN (?:PGP |SSH )?SIGNATURE-----|-----BEGIN SIGNED MESSAGE-----/u.test(
    tagObject,
  )
) {
  throw new Error(`Release blocked: ${expectedTag} has no signature material`);
}
git([
  "-c",
  "gpg.ssh.allowedSignersFile=.github/allowed_signers",
  "verify-tag",
  expectedTag,
]);
const localTagObjectId = git(["rev-parse", `refs/tags/${expectedTag}`]);
const remote = spawnSync(
  "git",
  ["ls-remote", "--tags", "origin", `refs/tags/${expectedTag}`],
  { encoding: "utf8" },
);
const remoteTagObjectId =
  remote.status === 0 && remote.stdout.trim() !== ""
    ? (remote.stdout.trim().split(/\s+/u)[0] ?? null)
    : null;
if (remoteTagObjectId && remoteTagObjectId !== localTagObjectId) {
  throw new Error("Release blocked: remote tag object differs from local tag");
}
if (process.env.REQUIRE_REMOTE_TAG === "1" && !remoteTagObjectId) {
  throw new Error("Release blocked: signed tag is missing from origin");
}

const outputDirectory = "output/release";
const artifactFile = releaseArtifactName(manifest.version);
const artifactPath = `${outputDirectory}/${artifactFile}`;
const sbomPath = `${outputDirectory}/sbom.cdx.json`;
const buildLogPath = `${outputDirectory}/build.log`;
const testReportPath = `${outputDirectory}/test-report.json`;
for (const path of [artifactPath, sbomPath, buildLogPath, testReportPath]) {
  if (!existsSync(path)) throw new Error(`Release evidence missing: ${path}`);
}
const buildLog = readFileSync(buildLogPath, "utf8");
if (!buildLog.includes("vite build") || !/built in/u.test(buildLog)) {
  throw new Error("Release build log lacks successful Vite build evidence");
}
const testReport = JSON.parse(readFileSync(testReportPath, "utf8")) as {
  schemaVersion?: number;
  package?: string;
  status?: string;
  command?: string;
  sourceCommit?: string | null;
  generatedAt?: string;
};
const generatedAt = Date.parse(testReport.generatedAt ?? "");
if (
  testReport.schemaVersion !== 1 ||
  testReport.package !== `${manifest.name}@${manifest.version}` ||
  testReport.status !== "passed" ||
  testReport.command !== "npm run verify:quality" ||
  testReport.sourceCommit !== commit ||
  Number.isNaN(generatedAt) ||
  generatedAt > Date.now() ||
  Date.now() - generatedAt > 6 * 60 * 60 * 1000
) {
  throw new Error(
    "Release blocked: quality report is stale, failed, or does not match exact HEAD",
  );
}
const archive = spawnSync("tar", ["-tzf", artifactPath], { encoding: "utf8" });
const archiveEntries = archive.stdout.split("\n");
if (
  archive.status !== 0 ||
  !archiveEntries.includes("dist/index.html") ||
  !archiveEntries.includes("dist/sw.js") ||
  !archiveEntries.includes("LICENSE") ||
  !archiveEntries.includes("SOURCE.md")
) {
  throw new Error(
    "Release archive lacks the application shell, license, or source notice",
  );
}

const deploymentLedger = JSON.parse(
  readFileSync("docs/deployed-releases.json", "utf8"),
) as {
  schemaVersion?: number;
  deployments?: Partial<RecordedPagesDeployment>[];
};
if (
  deploymentLedger.schemaVersion !== 2 ||
  !Array.isArray(deploymentLedger.deployments)
) {
  throw new Error("Release blocked: deployed release ledger is invalid");
}
const provenDeployments = (
  await Promise.all(
    deploymentLedger.deployments.map(async (deployment) => {
      const deployedAt = Date.parse(deployment.deployedAt ?? "");
      if (
        !/^v\d+\.\d+\.\d+-beta\.\d+$/u.test(deployment.tag ?? "") ||
        !/^[0-9a-f]{40}$/u.test(deployment.commit ?? "") ||
        !deployment.deployedAt ||
        Number.isNaN(deployedAt) ||
        new Date(deployedAt).toISOString() !== deployment.deployedAt ||
        deployedAt > Date.now() ||
        deployment.deploymentUrl !== manifest.homepage ||
        !Number.isSafeInteger(deployment.githubPagesDeploymentId) ||
        (deployment.githubPagesDeploymentId ?? 0) <= 0 ||
        !Number.isSafeInteger(deployment.githubPagesDeploymentStatusId) ||
        (deployment.githubPagesDeploymentStatusId ?? 0) <= 0 ||
        deployment.status !== "succeeded"
      ) {
        throw new Error(
          "Release blocked: deployed release ledger entry is invalid",
        );
      }
      if (
        git(["rev-list", "-n", "1", deployment.tag as string]) !==
        deployment.commit
      ) {
        throw new Error(
          "Release blocked: deployed release tag/commit mismatch",
        );
      }
      git([
        "-c",
        "gpg.ssh.allowedSignersFile=.github/allowed_signers",
        "verify-tag",
        deployment.tag as string,
      ]);
      const localDeploymentTagObjectId = git([
        "rev-parse",
        `refs/tags/${deployment.tag}`,
      ]);
      const remoteDeploymentTag = spawnSync(
        "git",
        ["ls-remote", "--tags", "origin", `refs/tags/${deployment.tag}`],
        { encoding: "utf8" },
      );
      const remoteDeploymentTagObjectId =
        remoteDeploymentTag.status === 0
          ? (remoteDeploymentTag.stdout.trim().split(/\s+/u)[0] ?? "")
          : "";
      if (remoteDeploymentTagObjectId === "") {
        throw new Error(
          "Release blocked: deployed release tag is absent from origin",
        );
      }
      if (remoteDeploymentTagObjectId !== localDeploymentTagObjectId) {
        throw new Error(
          "Release blocked: deployed release tag object differs from origin",
        );
      }
      const provenDeployment = deployment as RecordedPagesDeployment;
      await verifyRecordedPagesDeployment(provenDeployment, {
        owner: repositoryOwner,
        repository: repositoryName,
        token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
      });
      return provenDeployment;
    }),
  )
)
  .filter(
    (deployment) =>
      deployment.tag !== expectedTag &&
      spawnSync("git", [
        "merge-base",
        "--is-ancestor",
        deployment.commit,
        commit,
      ]).status === 0,
  )
  .sort((left, right) => right.deployedAt.localeCompare(left.deployedAt));
const record = buildReleaseRecord({
  packageName: manifest.name,
  version: manifest.version,
  commit,
  tag: expectedTag,
  artifactSha256: sha256(artifactPath),
  sbomSha256: sha256(sbomPath),
  testReportSha256: sha256(testReportPath),
  deploymentUrl: manifest.homepage,
  remoteTagObjectId,
  rollbackTag: provenDeployments[0]?.tag ?? null,
});
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  `${outputDirectory}/release-record.json`,
  serializeEvidence(record),
);

const webManifest = readFileSync("public/manifest.webmanifest", "utf8");
if (!webManifest.includes("Chat NoControl")) {
  throw new Error("Release manifest does not identify Chat NoControl");
}

console.log(
  `Release evidence ready: package=${manifest.name}@${manifest.version} commit=${commit} tag=${expectedTag} artifact=${record.artifact.sha256} rollback=${record.rollback.tag ?? "initial-release"}`,
);
