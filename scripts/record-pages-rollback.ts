import { mkdirSync, writeFileSync } from "node:fs";

import { findSuccessfulPagesDeployment } from "./github-deployment-evidence";
import { createPagesRollbackResult } from "./pages-rollback-evidence";

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
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

const candidate = await findSuccessfulPagesDeployment({
  owner,
  repository,
  tag,
  commit,
  deploymentUrl,
  deploymentStartedAt: required("CANDIDATE_DEPLOYMENT_STARTED_AT"),
  deploymentCompletedAt: required("CANDIDATE_DEPLOYMENT_COMPLETED_AT"),
  token,
});
const rollback = await findSuccessfulPagesDeployment({
  owner,
  repository,
  tag,
  commit,
  deploymentUrl,
  deploymentStartedAt: required("ROLLBACK_DEPLOYMENT_STARTED_AT"),
  deploymentCompletedAt: required("ROLLBACK_DEPLOYMENT_COMPLETED_AT"),
  token,
});
const result = createPagesRollbackResult({
  candidate,
  rollback,
  workflowRunId: required("WORKFLOW_RUN_ID"),
});

mkdirSync("output/release", { recursive: true });
writeFileSync(
  "output/release/pages-rollback-result.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(
  `Recorded CAT5 deployment ${candidate.githubPagesDeploymentId}/${candidate.githubPagesDeploymentStatusId} and V1 rollback ${rollback.githubPagesDeploymentId}/${rollback.githubPagesDeploymentStatusId}.`,
);
