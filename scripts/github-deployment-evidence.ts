export interface RecordedPagesDeployment {
  tag: string;
  commit: string;
  deployedAt: string;
  deploymentUrl: string;
  githubPagesDeploymentId: number;
  githubPagesDeploymentStatusId: number;
  status: "succeeded";
}

interface VerificationOptions {
  owner: string;
  repository: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

interface VerifiedDeployment {
  deploymentId: number;
  statusId: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchArray(
  url: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<unknown[]> {
  let response: Response;
  try {
    response = await fetchImpl(url, { headers });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "unknown error";
    throw new Error(`GitHub deployment API request failed: ${message}`);
  }
  if (!response.ok) {
    throw new Error(`GitHub deployment API returned ${response.status}`);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("GitHub deployment API returned invalid JSON");
  }
  if (!Array.isArray(payload)) {
    throw new Error("GitHub deployment API returned an invalid payload");
  }
  return payload as unknown[];
}

export async function verifyRecordedPagesDeployment(
  record: RecordedPagesDeployment,
  options: VerificationOptions,
): Promise<VerifiedDeployment> {
  if (
    !/^[A-Za-z0-9_.-]+$/u.test(options.owner) ||
    !/^[A-Za-z0-9_.-]+$/u.test(options.repository)
  ) {
    throw new Error("GitHub deployment API repository is invalid");
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "chat-nocontrol-release-verifier",
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const fetchImpl = options.fetchImpl ?? fetch;
  const root = `https://api.github.com/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repository)}`;
  const query = new URLSearchParams({
    sha: record.commit,
    ref: record.tag,
    environment: "github-pages",
    per_page: "100",
  });
  const deployments = await fetchArray(
    `${root}/deployments?${query.toString()}`,
    headers,
    fetchImpl,
  );
  const deployment = deployments.find(
    (candidate) =>
      isObject(candidate) && candidate.id === record.githubPagesDeploymentId,
  );
  if (
    !isObject(deployment) ||
    deployment.sha !== record.commit ||
    deployment.ref !== record.tag ||
    deployment.environment !== "github-pages"
  ) {
    throw new Error(
      "Release blocked: live GitHub Pages deployment evidence does not match ledger",
    );
  }

  const statuses = await fetchArray(
    `${root}/deployments/${record.githubPagesDeploymentId}/statuses?per_page=100`,
    headers,
    fetchImpl,
  );
  const status = statuses.find(
    (candidate) =>
      isObject(candidate) &&
      candidate.id === record.githubPagesDeploymentStatusId,
  );
  if (
    !isObject(status) ||
    status.state !== "success" ||
    status.environment !== "github-pages" ||
    status.environment_url !== record.deploymentUrl ||
    status.created_at !== record.deployedAt
  ) {
    throw new Error(
      "Release blocked: live GitHub Pages deployment evidence does not match ledger",
    );
  }

  return {
    deploymentId: record.githubPagesDeploymentId,
    statusId: record.githubPagesDeploymentStatusId,
  };
}
