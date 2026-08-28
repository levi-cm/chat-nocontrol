import { describe, expect, it, vi } from "vitest";

import {
  appendPagesReleaseAuthorization,
  appendRecordedPagesDeployment,
  type DeploymentLedger,
  findSuccessfulPagesDeployment,
  requirePagesReleaseAuthorization,
  type PagesReleaseAuthorization,
  serializeDeploymentLedger,
  type RecordedPagesDeployment,
  verifyRecordedPagesDeployment,
} from "../../../scripts/github-deployment-evidence";

const authorization: PagesReleaseAuthorization = {
  tag: "v0.2.0-beta.1",
  commit: "a".repeat(40),
  artifactId: "123456",
  artifactDigest: `sha256:${"b".repeat(64)}`,
  physicalEvidenceSha256: "c".repeat(64),
  workflowRunId: "789",
  authorizedAt: "2026-07-13T00:55:00.000Z",
  status: "authorized",
};

const record: RecordedPagesDeployment = {
  tag: "v0.2.0-beta.1",
  commit: "a".repeat(40),
  deployedAt: "2026-07-13T01:02:03.000Z",
  deploymentUrl: "https://levi-cm.github.io/chat-nocontrol/",
  githubPagesDeploymentId: 42,
  githubPagesDeploymentStatusId: 84,
  status: "succeeded",
};

const deploymentStartedAt = "2026-07-13T01:00:00.000Z";
const deploymentCompletedAt = "2026-07-13T01:05:00.000Z";

interface GithubFetchOptions {
  deployment?: Partial<Record<string, unknown>>;
  status?: Partial<Record<string, unknown>>;
}

function githubFetch(options?: GithubFetchOptions) {
  return vi.fn((input: string | URL | Request, _init?: RequestInit) => {
    void _init;
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const payload = url.endsWith("/statuses?per_page=100")
      ? [
          {
            id: 84,
            state: "success",
            environment: "github-pages",
            environment_url: record.deploymentUrl,
            created_at: record.deployedAt.replace(".000Z", "Z"),
            ...options?.status,
          },
        ]
      : [
          {
            id: 42,
            sha: record.commit,
            ref: record.tag,
            environment: "github-pages",
            ...options?.deployment,
          },
        ];
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
}

const mismatchCases: Array<[string, GithubFetchOptions]> = [
  ["wrong commit", { deployment: { sha: "b".repeat(40) } }],
  ["wrong ref", { deployment: { ref: "main" } }],
  ["wrong environment", { deployment: { environment: "production" } }],
  ["failed status", { status: { state: "failure" } }],
  ["wrong URL", { status: { environment_url: "https://example.invalid/" } }],
  ["wrong timestamp", { status: { created_at: "2026-07-13T01:02:04.000Z" } }],
];

describe("GitHub Pages deployment evidence", () => {
  it("binds a ledger record to the exact live deployment and success status", async () => {
    const fetchImpl = githubFetch();

    await expect(
      verifyRecordedPagesDeployment(record, {
        owner: "levi-cm",
        repository: "chat-nocontrol",
        token: "test-token",
        fetchImpl,
      }),
    ).resolves.toEqual({ deploymentId: 42, statusId: 84 });

    const firstCall = fetchImpl.mock.calls[0];
    expect(firstCall?.[0]).toBe(
      `https://api.github.com/repos/levi-cm/chat-nocontrol/deployments?sha=${record.commit}&ref=${record.tag}&environment=github-pages&per_page=100`,
    );
    expect(new Headers(firstCall?.[1]?.headers).get("Authorization")).toBe(
      "Bearer test-token",
    );
  });

  it.each(mismatchCases)(
    "rejects self-asserted evidence with a live %s",
    async (_name, options) => {
      await expect(
        verifyRecordedPagesDeployment(record, {
          owner: "levi-cm",
          repository: "chat-nocontrol",
          fetchImpl: githubFetch(options),
        }),
      ).rejects.toThrow("live GitHub Pages deployment evidence");
    },
  );

  it("fails closed when GitHub cannot provide evidence", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response("rate limited", { status: 403 })),
    );

    await expect(
      verifyRecordedPagesDeployment(record, {
        owner: "levi-cm",
        repository: "chat-nocontrol",
        fetchImpl,
      }),
    ).rejects.toThrow("GitHub deployment API returned 403");
  });

  it("finds only the successful deployment matching tag, commit, environment, and URL", async () => {
    const fetchImpl = vi.fn((input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const payload = url.includes("/statuses?")
        ? [
            {
              id: 85,
              state: "failure",
              environment: "github-pages",
              environment_url: record.deploymentUrl,
              created_at: "2026-07-13T01:02:04.000Z",
            },
            {
              id: 84,
              state: "success",
              environment: "github-pages",
              environment_url: record.deploymentUrl,
              created_at: record.deployedAt.replace(".000Z", "Z"),
            },
          ]
        : [
            {
              id: 41,
              sha: "b".repeat(40),
              ref: record.tag,
              environment: "github-pages",
            },
            {
              id: 42,
              sha: record.commit,
              ref: record.tag,
              environment: "github-pages",
            },
          ];
      return Promise.resolve(
        new Response(JSON.stringify(payload), { status: 200 }),
      );
    });

    await expect(
      findSuccessfulPagesDeployment({
        owner: "levi-cm",
        repository: "chat-nocontrol",
        tag: record.tag,
        commit: record.commit,
        deploymentUrl: record.deploymentUrl,
        deploymentStartedAt,
        deploymentCompletedAt,
        token: "token",
        fetchImpl,
      }),
    ).resolves.toEqual(record);
  });

  it.each([
    ["tag", { deployment: { ref: "main" } }],
    ["commit", { deployment: { sha: "b".repeat(40) } }],
    ["environment", { deployment: { environment: "production" } }],
    ["URL", { status: { environment_url: "https://example.invalid/" } }],
    ["failed status", { status: { state: "failure" } }],
    ["timestamp", { status: { created_at: "not-a-date" } }],
  ])(
    "fails closed when no successful exact %s match exists",
    async (_name, options) => {
      await expect(
        findSuccessfulPagesDeployment({
          owner: "levi-cm",
          repository: "chat-nocontrol",
          tag: record.tag,
          commit: record.commit,
          deploymentUrl: record.deploymentUrl,
          deploymentStartedAt,
          deploymentCompletedAt,
          fetchImpl: githubFetch(options),
        }),
      ).rejects.toThrow("no exact successful GitHub Pages deployment");
    },
  );

  it("ignores a stale same-tag success and records only this deployment window", async () => {
    const current: RecordedPagesDeployment = {
      ...record,
      deployedAt: "2026-07-14T01:02:03.000Z",
      githubPagesDeploymentId: 43,
      githubPagesDeploymentStatusId: 86,
    };
    const fetchImpl = vi.fn((input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      let payload: unknown[];
      if (url.includes("/deployments/42/statuses")) {
        payload = [
          {
            id: 84,
            state: "success",
            environment: "github-pages",
            environment_url: record.deploymentUrl,
            created_at: record.deployedAt.replace(".000Z", "Z"),
          },
        ];
      } else if (url.includes("/deployments/43/statuses")) {
        payload = [
          {
            id: 86,
            state: "success",
            environment: "github-pages",
            environment_url: record.deploymentUrl,
            created_at: current.deployedAt.replace(".000Z", "Z"),
          },
        ];
      } else {
        payload = [
          {
            id: 42,
            sha: record.commit,
            ref: record.tag,
            environment: "github-pages",
          },
          {
            id: 43,
            sha: record.commit,
            ref: record.tag,
            environment: "github-pages",
          },
        ];
      }
      return Promise.resolve(
        new Response(JSON.stringify(payload), { status: 200 }),
      );
    });

    await expect(
      findSuccessfulPagesDeployment({
        owner: "levi-cm",
        repository: "chat-nocontrol",
        tag: record.tag,
        commit: record.commit,
        deploymentUrl: record.deploymentUrl,
        deploymentStartedAt: "2026-07-14T01:00:00.000Z",
        deploymentCompletedAt: "2026-07-14T01:05:00.000Z",
        fetchImpl,
      }),
    ).resolves.toEqual(current);
  });

  it("fails closed when only a prior same-tag deployment is visible", async () => {
    await expect(
      findSuccessfulPagesDeployment({
        owner: "levi-cm",
        repository: "chat-nocontrol",
        tag: record.tag,
        commit: record.commit,
        deploymentUrl: record.deploymentUrl,
        deploymentStartedAt: "2026-07-14T01:00:00.000Z",
        deploymentCompletedAt: "2026-07-14T01:05:00.000Z",
        fetchImpl: githubFetch(),
      }),
    ).rejects.toThrow("no exact successful GitHub Pages deployment");
  });

  it("appends deterministically, deduplicates retries, and retains same-tag redeployments", () => {
    const empty: DeploymentLedger = {
      schemaVersion: 3,
      authorizations: [],
      deployments: [],
    };
    expect(() => appendRecordedPagesDeployment(empty, record)).toThrow(
      "pre-deployment authorization",
    );
    const authorized = appendPagesReleaseAuthorization(empty, authorization);
    expect(
      appendPagesReleaseAuthorization(authorized, { ...authorization }),
    ).toEqual(authorized);
    expect(requirePagesReleaseAuthorization(authorized, authorization)).toEqual(
      authorization,
    );
    const first = appendRecordedPagesDeployment(authorized, record);
    expect(appendRecordedPagesDeployment(first, { ...record })).toEqual(first);

    const redeployment: RecordedPagesDeployment = {
      ...record,
      deployedAt: "2026-07-14T01:02:03.000Z",
      githubPagesDeploymentId: 43,
      githubPagesDeploymentStatusId: 86,
    };
    const history = appendRecordedPagesDeployment(first, redeployment);
    expect(history.deployments).toEqual([record, redeployment]);
    expect(serializeDeploymentLedger(history)).toBe(
      `${JSON.stringify(history, null, 2)}\n`,
    );
  });

  it("rejects conflicting deployment or status IDs and unsupported ledgers", () => {
    const ledger: DeploymentLedger = {
      schemaVersion: 3,
      authorizations: [authorization],
      deployments: [record],
    };
    expect(() =>
      appendRecordedPagesDeployment(ledger, {
        ...record,
        deploymentUrl: "https://example.invalid/",
      }),
    ).toThrow("conflicting deployment ledger record");
    expect(() =>
      appendRecordedPagesDeployment(ledger, {
        ...record,
        githubPagesDeploymentId: 43,
      }),
    ).toThrow("conflicting deployment ledger record");
    expect(() =>
      appendRecordedPagesDeployment(
        { schemaVersion: 1, deployments: [] } as never,
        record,
      ),
    ).toThrow("schema version 3");
  });

  it("rejects deployment authorization substitution and retains parallel retry intents", () => {
    const empty: DeploymentLedger = {
      schemaVersion: 3,
      authorizations: [],
      deployments: [],
    };
    const first = appendPagesReleaseAuthorization(empty, authorization);
    expect(() =>
      requirePagesReleaseAuthorization(first, {
        ...authorization,
        artifactDigest: `sha256:${"d".repeat(64)}`,
      }),
    ).toThrow("exact pre-deployment authorization");

    const retry: PagesReleaseAuthorization = {
      ...authorization,
      artifactId: "123457",
      artifactDigest: `sha256:${"e".repeat(64)}`,
      workflowRunId: "790",
      authorizedAt: "2026-07-13T00:56:00.000Z",
    };
    const retried = appendPagesReleaseAuthorization(first, retry);
    expect(retried.authorizations).toEqual([authorization, retry]);
  });
});
