import { describe, expect, it, vi } from "vitest";

import {
  type RecordedPagesDeployment,
  verifyRecordedPagesDeployment,
} from "../../../scripts/github-deployment-evidence";

const record: RecordedPagesDeployment = {
  tag: "v0.1.0-beta.1",
  commit: "a".repeat(40),
  deployedAt: "2026-07-13T01:02:03.000Z",
  deploymentUrl: "https://levi-cm.github.io/chat-nocontrol/",
  githubPagesDeploymentId: 42,
  githubPagesDeploymentStatusId: 84,
  status: "succeeded",
};

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
            created_at: record.deployedAt,
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
});
