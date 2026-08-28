import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  appendRecordedPagesDeployment,
  type DeploymentLedger,
  findSuccessfulPagesDeployment,
  requirePagesReleaseAuthorization,
  serializeDeploymentLedger,
} from "./github-deployment-evidence";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const owner = required("REPOSITORY_OWNER");
const repository = required("REPOSITORY_NAME");
const tag = required("RELEASE_TAG");
const commit = required("RELEASE_COMMIT");
const deploymentUrl = required("DEPLOYMENT_URL");
const deploymentStartedAt = required("DEPLOYMENT_STARTED_AT");
const deploymentCompletedAt = required("DEPLOYMENT_COMPLETED_AT");
const artifactId = required("PAGES_ARTIFACT_ID");
const artifactDigest = required("PAGES_ARTIFACT_DIGEST");
const physicalEvidenceSha256 = required("PHYSICAL_EVIDENCE_SHA256");
const workflowRunId = required("WORKFLOW_RUN_ID");
const authorizedAt = required("DEPLOYMENT_AUTHORIZED_AT");
const ledgerPath = "docs/deployed-releases.json";
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as DeploymentLedger;
requirePagesReleaseAuthorization(ledger, {
  tag,
  commit,
  artifactId,
  artifactDigest,
  physicalEvidenceSha256,
  workflowRunId,
  authorizedAt,
  status: "authorized",
});
const record = await findSuccessfulPagesDeployment({
  owner,
  repository,
  tag,
  commit,
  deploymentUrl,
  deploymentStartedAt,
  deploymentCompletedAt,
  token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
});
const nextLedger = appendRecordedPagesDeployment(ledger, record);
const serializedLedger = serializeDeploymentLedger(nextLedger);

mkdirSync("output/release", { recursive: true });
writeFileSync(ledgerPath, serializedLedger);
writeFileSync(
  "output/release/deployment-record.json",
  `${JSON.stringify(record, null, 2)}\n`,
);
console.log(
  `Recorded GitHub Pages deployment ${record.githubPagesDeploymentId}/${record.githubPagesDeploymentStatusId} for ${tag}.`,
);
