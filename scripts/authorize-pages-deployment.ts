import { readFileSync, writeFileSync } from "node:fs";

import {
  appendPagesReleaseAuthorization,
  type DeploymentLedger,
  serializeDeploymentLedger,
} from "./github-deployment-evidence";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const ledgerPath = "docs/deployed-releases.json";
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as DeploymentLedger;
const authorization = {
  tag: required("RELEASE_TAG"),
  commit: required("RELEASE_COMMIT"),
  artifactId: required("PAGES_ARTIFACT_ID"),
  artifactDigest: required("PAGES_ARTIFACT_DIGEST"),
  physicalEvidenceSha256: required("PHYSICAL_EVIDENCE_SHA256"),
  workflowRunId: required("WORKFLOW_RUN_ID"),
  authorizedAt: required("DEPLOYMENT_AUTHORIZED_AT"),
  status: "authorized" as const,
};
const nextLedger = appendPagesReleaseAuthorization(ledger, authorization);
writeFileSync(ledgerPath, serializeDeploymentLedger(nextLedger));
writeFileSync(
  "output/release/deployment-authorization.json",
  `${JSON.stringify(authorization, null, 2)}\n`,
);
console.log(
  `Authorized Pages artifact ${authorization.artifactId} for ${authorization.tag} before deployment.`,
);
