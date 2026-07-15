export interface RecordedPagesDeployment {
  tag: string;
  commit: string;
  deployedAt: string;
  deploymentUrl: string;
  githubPagesDeploymentId: number;
  githubPagesDeploymentStatusId: number;
  status: "succeeded";
}

export interface DeploymentLedger {
  schemaVersion: 2;
  deployments: RecordedPagesDeployment[];
}

export interface FindSuccessfulPagesDeploymentOptions {
  owner: string;
  repository: string;
  tag: string;
  commit: string;
  deploymentUrl: string;
  deploymentStartedAt: string;
  deploymentCompletedAt: string;
  token?: string;
  fetchImpl?: typeof fetch;
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

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function timestampMillis(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  const canonical = new Date(parsed).toISOString();
  const secondPrecision = canonical.replace(/\.000Z$/u, "Z");
  return value === canonical || value === secondPrecision ? parsed : null;
}

function isValidTimestamp(value: unknown): value is string {
  return timestampMillis(value) !== null;
}

function assertRepository(owner: string, repository: string): void {
  if (
    !/^[A-Za-z0-9_.-]+$/u.test(owner) ||
    !/^[A-Za-z0-9_.-]+$/u.test(repository)
  ) {
    throw new Error("GitHub deployment API repository is invalid");
  }
}

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "chat-nocontrol-release-verifier",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function githubRoot(owner: string, repository: string): string {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
}

function deploymentQuery(tag: string, commit: string): string {
  return new URLSearchParams({
    sha: commit,
    ref: tag,
    environment: "github-pages",
    per_page: "100",
  }).toString();
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
  assertRepository(options.owner, options.repository);
  const headers = githubHeaders(options.token);
  const fetchImpl = options.fetchImpl ?? fetch;
  const root = githubRoot(options.owner, options.repository);
  const deployments = await fetchArray(
    `${root}/deployments?${deploymentQuery(record.tag, record.commit)}`,
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
  const liveDeployedAt = isObject(status)
    ? timestampMillis(status.created_at)
    : null;
  const recordedDeployedAt = timestampMillis(record.deployedAt);
  if (
    !isObject(status) ||
    status.state !== "success" ||
    status.environment !== "github-pages" ||
    status.environment_url !== record.deploymentUrl ||
    liveDeployedAt === null ||
    recordedDeployedAt === null ||
    liveDeployedAt !== recordedDeployedAt
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

export async function findSuccessfulPagesDeployment(
  options: FindSuccessfulPagesDeploymentOptions,
): Promise<RecordedPagesDeployment> {
  assertRepository(options.owner, options.repository);
  const deploymentStartedAt = timestampMillis(options.deploymentStartedAt);
  const deploymentCompletedAt = timestampMillis(options.deploymentCompletedAt);
  if (
    deploymentStartedAt === null ||
    deploymentCompletedAt === null ||
    deploymentStartedAt > deploymentCompletedAt
  ) {
    throw new Error("Release blocked: deployment window is invalid");
  }
  const headers = githubHeaders(options.token);
  const fetchImpl = options.fetchImpl ?? fetch;
  const root = githubRoot(options.owner, options.repository);
  const deployments = await fetchArray(
    `${root}/deployments?${deploymentQuery(options.tag, options.commit)}`,
    headers,
    fetchImpl,
  );
  const matches: RecordedPagesDeployment[] = [];
  for (const deployment of deployments) {
    if (
      !isObject(deployment) ||
      !isPositiveInteger(deployment.id) ||
      deployment.sha !== options.commit ||
      deployment.ref !== options.tag ||
      deployment.environment !== "github-pages"
    ) {
      continue;
    }
    const statuses = await fetchArray(
      `${root}/deployments/${deployment.id}/statuses?per_page=100`,
      headers,
      fetchImpl,
    );
    for (const status of statuses) {
      const statusCreatedAt = isObject(status)
        ? timestampMillis(status.created_at)
        : null;
      if (
        !isObject(status) ||
        !isPositiveInteger(status.id) ||
        status.state !== "success" ||
        status.environment !== "github-pages" ||
        status.environment_url !== options.deploymentUrl ||
        statusCreatedAt === null ||
        statusCreatedAt < deploymentStartedAt ||
        statusCreatedAt > deploymentCompletedAt
      ) {
        continue;
      }
      matches.push({
        tag: options.tag,
        commit: options.commit,
        deployedAt: new Date(statusCreatedAt).toISOString(),
        deploymentUrl: options.deploymentUrl,
        githubPagesDeploymentId: deployment.id,
        githubPagesDeploymentStatusId: status.id,
        status: "succeeded",
      });
    }
  }
  matches.sort(
    (left, right) =>
      right.deployedAt.localeCompare(left.deployedAt) ||
      right.githubPagesDeploymentStatusId -
        left.githubPagesDeploymentStatusId ||
      right.githubPagesDeploymentId - left.githubPagesDeploymentId,
  );
  const match = matches[0];
  if (!match) {
    throw new Error(
      "Release blocked: no exact successful GitHub Pages deployment was found",
    );
  }
  return match;
}

function canonicalRecord(
  record: RecordedPagesDeployment,
): RecordedPagesDeployment {
  if (
    record.status !== "succeeded" ||
    !isPositiveInteger(record.githubPagesDeploymentId) ||
    !isPositiveInteger(record.githubPagesDeploymentStatusId) ||
    !isValidTimestamp(record.deployedAt) ||
    record.tag.length === 0 ||
    !/^[0-9a-f]{40}$/u.test(record.commit) ||
    record.deploymentUrl.length === 0
  ) {
    throw new Error("deployment ledger record is invalid");
  }
  return {
    tag: record.tag,
    commit: record.commit,
    deployedAt: new Date(
      timestampMillis(record.deployedAt) as number,
    ).toISOString(),
    deploymentUrl: record.deploymentUrl,
    githubPagesDeploymentId: record.githubPagesDeploymentId,
    githubPagesDeploymentStatusId: record.githubPagesDeploymentStatusId,
    status: "succeeded",
  };
}

function recordsEqual(
  left: RecordedPagesDeployment,
  right: RecordedPagesDeployment,
): boolean {
  return serializeDeploymentRecord(left) === serializeDeploymentRecord(right);
}

function serializeDeploymentRecord(record: RecordedPagesDeployment): string {
  return JSON.stringify(canonicalRecord(record));
}

function sortedRecords(
  records: readonly RecordedPagesDeployment[],
): RecordedPagesDeployment[] {
  return records
    .map(canonicalRecord)
    .sort(
      (left, right) =>
        left.deployedAt.localeCompare(right.deployedAt) ||
        left.githubPagesDeploymentId - right.githubPagesDeploymentId ||
        left.githubPagesDeploymentStatusId -
          right.githubPagesDeploymentStatusId,
    );
}

function normalizedLedgerRecords(
  records: readonly RecordedPagesDeployment[],
): RecordedPagesDeployment[] {
  const normalized: RecordedPagesDeployment[] = [];
  for (const candidate of sortedRecords(records)) {
    const collision = normalized.find(
      (existing) =>
        existing.githubPagesDeploymentId ===
          candidate.githubPagesDeploymentId ||
        existing.githubPagesDeploymentStatusId ===
          candidate.githubPagesDeploymentStatusId,
    );
    if (!collision) {
      normalized.push(candidate);
      continue;
    }
    if (
      collision.githubPagesDeploymentId === candidate.githubPagesDeploymentId &&
      collision.githubPagesDeploymentStatusId ===
        candidate.githubPagesDeploymentStatusId &&
      recordsEqual(collision, candidate)
    ) {
      continue;
    }
    throw new Error("conflicting deployment ledger record");
  }
  return normalized;
}

export function appendRecordedPagesDeployment(
  ledger: DeploymentLedger,
  record: RecordedPagesDeployment,
): DeploymentLedger {
  if (ledger.schemaVersion !== 2 || !Array.isArray(ledger.deployments)) {
    throw new Error("deployment ledger must use schema version 2");
  }
  const current = normalizedLedgerRecords(ledger.deployments);
  const candidate = canonicalRecord(record);
  for (const existing of current) {
    const reusesDeploymentId =
      existing.githubPagesDeploymentId === candidate.githubPagesDeploymentId;
    const reusesStatusId =
      existing.githubPagesDeploymentStatusId ===
      candidate.githubPagesDeploymentStatusId;
    if (!reusesDeploymentId && !reusesStatusId) continue;
    if (
      reusesDeploymentId &&
      reusesStatusId &&
      recordsEqual(existing, candidate)
    ) {
      return { schemaVersion: 2, deployments: current };
    }
    throw new Error("conflicting deployment ledger record");
  }
  return {
    schemaVersion: 2,
    deployments: normalizedLedgerRecords([...current, candidate]),
  };
}

export function serializeDeploymentLedger(ledger: DeploymentLedger): string {
  if (ledger.schemaVersion !== 2 || !Array.isArray(ledger.deployments)) {
    throw new Error("deployment ledger must use schema version 2");
  }
  return `${JSON.stringify(
    {
      schemaVersion: 2,
      deployments: normalizedLedgerRecords(ledger.deployments),
    },
    null,
    2,
  )}\n`;
}
