import type { RecordedPagesDeployment } from "./github-deployment-evidence";

const RESULT_SCHEMA = "chat-nocontrol-pages-rollback-result/v2";

export interface PagesRollbackResult {
  schema: typeof RESULT_SCHEMA;
  status: "RESTORED_V1";
  reason: "CAT5 live acceptance did not succeed";
  tag: string;
  commit: string;
  workflowRunId: string;
  candidateDeployment: RecordedPagesDeployment;
  rollbackDeployment: RecordedPagesDeployment;
}

interface PagesRollbackResultInput {
  candidate: RecordedPagesDeployment;
  rollback: RecordedPagesDeployment;
  workflowRunId: string;
}

function validRunId(value: string): boolean {
  return /^[1-9][0-9]*$/u.test(value);
}

function validDeployment(record: RecordedPagesDeployment): boolean {
  return (
    record.status === "succeeded" &&
    /^v\d+\.\d+\.\d+-beta\.\d+$/u.test(record.tag) &&
    /^[0-9a-f]{40}$/u.test(record.commit) &&
    Number.isSafeInteger(record.githubPagesDeploymentId) &&
    record.githubPagesDeploymentId > 0 &&
    Number.isSafeInteger(record.githubPagesDeploymentStatusId) &&
    record.githubPagesDeploymentStatusId > 0 &&
    Number.isFinite(Date.parse(record.deployedAt)) &&
    record.deploymentUrl.startsWith("https://")
  );
}

export function createPagesRollbackResult(
  input: PagesRollbackResultInput,
): PagesRollbackResult {
  const { candidate, rollback, workflowRunId } = input;
  if (
    !validRunId(workflowRunId) ||
    !validDeployment(candidate) ||
    !validDeployment(rollback) ||
    candidate.tag !== rollback.tag ||
    candidate.commit !== rollback.commit ||
    candidate.deploymentUrl !== rollback.deploymentUrl ||
    candidate.githubPagesDeploymentId === rollback.githubPagesDeploymentId ||
    candidate.githubPagesDeploymentStatusId ===
      rollback.githubPagesDeploymentStatusId ||
    Date.parse(rollback.deployedAt) < Date.parse(candidate.deployedAt)
  ) {
    throw new Error("Release blocked: Pages rollback evidence is invalid");
  }
  return {
    schema: RESULT_SCHEMA,
    status: "RESTORED_V1",
    reason: "CAT5 live acceptance did not succeed",
    tag: candidate.tag,
    commit: candidate.commit,
    workflowRunId,
    candidateDeployment: candidate,
    rollbackDeployment: rollback,
  };
}
