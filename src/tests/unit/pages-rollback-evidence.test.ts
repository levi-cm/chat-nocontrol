import { describe, expect, it } from "vitest";

import type { RecordedPagesDeployment } from "../../../scripts/github-deployment-evidence";
import { detectPagesMutation } from "../../../scripts/pages-deployment-mutation";
import { createPagesRollbackResult } from "../../../scripts/pages-rollback-evidence";

const candidate: RecordedPagesDeployment = {
  tag: "v0.2.0-beta.1",
  commit: "a".repeat(40),
  deployedAt: "2026-08-28T10:00:00.000Z",
  deploymentUrl: "https://levi-cm.github.io/chat-nocontrol/",
  githubPagesDeploymentId: 101,
  githubPagesDeploymentStatusId: 201,
  status: "succeeded",
};

const rollback: RecordedPagesDeployment = {
  ...candidate,
  deployedAt: "2026-08-28T10:05:00.000Z",
  githubPagesDeploymentId: 102,
  githubPagesDeploymentStatusId: 202,
};

describe("Pages rollback evidence", () => {
  it("records distinct candidate and rollback deployment identifiers", () => {
    expect(
      createPagesRollbackResult({
        candidate,
        rollback,
        workflowRunId: "303",
      }),
    ).toEqual({
      schema: "chat-nocontrol-pages-rollback-result/v2",
      status: "RESTORED_V1",
      reason: "CAT5 live acceptance did not succeed",
      tag: candidate.tag,
      commit: candidate.commit,
      workflowRunId: "303",
      candidateDeployment: candidate,
      rollbackDeployment: rollback,
    });
  });

  it.each([
    ["deployment ID", { ...rollback, githubPagesDeploymentId: 101 }],
    ["status ID", { ...rollback, githubPagesDeploymentStatusId: 201 }],
    ["tag", { ...rollback, tag: "v0.2.0-beta.2" }],
    ["commit", { ...rollback, commit: "b".repeat(40) }],
    ["URL", { ...rollback, deploymentUrl: "https://example.invalid/" }],
  ])("rejects a mismatched %s", (_label, invalidRollback) => {
    expect(() =>
      createPagesRollbackResult({
        candidate,
        rollback: invalidRollback,
        workflowRunId: "303",
      }),
    ).toThrow(/rollback evidence/u);
  });

  it("rejects a rollback recorded before the candidate deployment", () => {
    expect(() =>
      createPagesRollbackResult({
        candidate,
        rollback: { ...rollback, deployedAt: "2026-08-28T09:59:59.000Z" },
        workflowRunId: "303",
      }),
    ).toThrow(/rollback evidence/u);
  });
});

describe("Pages mutation detection", () => {
  it("accepts the deploy action URL as direct mutation proof", async () => {
    await expect(
      detectPagesMutation({
        actionOutcome: "success",
        actionPageUrl: candidate.deploymentUrl,
        findDeployment: () => Promise.reject(new Error("must not query")),
      }),
    ).resolves.toBe("MUTATED");
  });

  it("reports no mutation when the exact deployment query proves none", async () => {
    await expect(
      detectPagesMutation({
        actionOutcome: "failure",
        actionPageUrl: "",
        findDeployment: () =>
          Promise.reject(
            new Error(
              "Release blocked: no exact successful GitHub Pages deployment was found",
            ),
          ),
      }),
    ).resolves.toBe("NOT_MUTATED");
  });

  it("fails safe to unknown on API or evidence ambiguity", async () => {
    await expect(
      detectPagesMutation({
        actionOutcome: "failure",
        actionPageUrl: "",
        findDeployment: () => Promise.reject(new Error("API unavailable")),
      }),
    ).resolves.toBe("UNKNOWN");
  });

  it("recognizes a successful deployment found after an action failure", async () => {
    await expect(
      detectPagesMutation({
        actionOutcome: "failure",
        actionPageUrl: "",
        findDeployment: () => Promise.resolve(candidate),
      }),
    ).resolves.toBe("MUTATED");
  });
});
