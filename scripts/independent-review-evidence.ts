import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, join, posix } from "node:path";

export interface ReviewRecord {
  schemaVersion?: number;
  reviewer?: { name?: string; organization?: string };
  independenceStatement?: string;
  reviewedCommit?: string;
  completedAt?: string;
  outcome?: string;
  openCriticalOrHigh?: number;
  reportPath?: string;
  reportSha256?: string;
  signaturePath?: string;
  allowedSignersPath?: string;
  signingIdentity?: string;
  signatureNamespace?: string;
}

export interface ReviewValidationOptions {
  cwd?: string;
  head: string;
  now?: number;
}

const recordPath = "docs/independent-security-review.json";
const signatureNamespace = "chat-nocontrol-security-review-v1";

interface GitResult {
  status: number | null;
  stdout: string;
}

function git(cwd: string, args: string[]): GitResult {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout };
}

function canonicalEvidencePath(
  value: string | undefined,
  label: string,
  extensions: readonly string[],
  failures: string[],
): string | null {
  if (
    !value ||
    isAbsolute(value) ||
    value.includes("\\") ||
    posix.normalize(value) !== value ||
    !value.startsWith("docs/reviews/") ||
    !extensions.some((extension) => value.endsWith(extension))
  ) {
    failures.push(`${label} must be a canonical file under docs/reviews`);
    return null;
  }
  return value;
}

function regularEvidenceFile(
  cwd: string,
  path: string,
  label: string,
  failures: string[],
): boolean {
  const fullPath = join(cwd, path);
  if (!existsSync(fullPath)) {
    failures.push(`${label} does not exist: ${path}`);
    return false;
  }
  const status = lstatSync(fullPath);
  if (!status.isFile() || status.isSymbolicLink()) {
    failures.push(`${label} must be a regular non-symlink file`);
    return false;
  }
  if ((status.mode & 0o111) !== 0) {
    failures.push(`${label} must be a non-executable regular file`);
    return false;
  }
  return true;
}

function sha256(cwd: string, path: string): string {
  return createHash("sha256")
    .update(readFileSync(join(cwd, path)))
    .digest("hex");
}

function validateHistory(
  record: ReviewRecord,
  options: Required<Pick<ReviewValidationOptions, "cwd" | "head">>,
  namedEvidencePaths: readonly string[] | null,
  failures: string[],
): void {
  const reviewedCommit = record.reviewedCommit ?? "";
  if (!/^[0-9a-f]{40}$/u.test(reviewedCommit)) {
    failures.push("reviewedCommit must be a full lowercase commit SHA");
    return;
  }

  const commitExists = git(options.cwd, [
    "cat-file",
    "-e",
    `${reviewedCommit}^{commit}`,
  ]);
  if (commitExists.status !== 0) {
    failures.push("reviewedCommit is not a valid local commit");
    return;
  }

  const ancestry = git(options.cwd, [
    "merge-base",
    "--is-ancestor",
    reviewedCommit,
    options.head,
  ]);
  if (ancestry.status !== 0) {
    failures.push("reviewedCommit must be an ancestor of release HEAD");
    return;
  }

  const parent = git(options.cwd, ["rev-parse", `${options.head}^`]);
  const count = git(options.cwd, [
    "rev-list",
    "--count",
    `${reviewedCommit}..${options.head}`,
  ]);
  if (
    parent.status !== 0 ||
    parent.stdout.trim() !== reviewedCommit ||
    count.status !== 0 ||
    count.stdout.trim() !== "1"
  ) {
    failures.push(
      "release HEAD must be the single immediate child of reviewedCommit",
    );
  }

  if (!namedEvidencePaths) return;

  const unstagedEvidence = git(options.cwd, [
    "diff",
    "--quiet",
    options.head,
    "--",
    ...namedEvidencePaths,
  ]);
  const stagedEvidence = git(options.cwd, [
    "diff",
    "--cached",
    "--quiet",
    options.head,
    "--",
    ...namedEvidencePaths,
  ]);
  if (unstagedEvidence.status !== 0 || stagedEvidence.status !== 0) {
    failures.push("review evidence files must match release HEAD exactly");
  }

  const diff = git(options.cwd, [
    "diff",
    "--name-status",
    "-z",
    "--no-renames",
    reviewedCommit,
    options.head,
  ]);
  if (diff.status !== 0) {
    failures.push("could not verify the reviewed commit to release HEAD diff");
    return;
  }
  const fields = diff.stdout.split("\0").filter((field) => field.length > 0);
  const actual = new Map<string, string>();
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index];
    const path = fields[index + 1];
    if (status && path) actual.set(path, status);
  }
  const expected = new Set(namedEvidencePaths);
  if (
    actual.size !== expected.size ||
    [...expected].some((path) => actual.get(path) !== "A") ||
    [...actual].some(([path, status]) => status !== "A" || !expected.has(path))
  ) {
    failures.push(
      "reviewed commit to release HEAD may add only the four named review evidence files",
    );
  }
}

export function validateIndependentReviewEvidence(
  record: ReviewRecord,
  options: ReviewValidationOptions,
): string[] {
  const failures: string[] = [];
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? Date.now();

  if (record.schemaVersion !== 2)
    failures.push("review schemaVersion must be 2");
  if (!record.reviewer?.name?.trim()) failures.push("reviewer name is missing");
  if (!record.reviewer?.organization?.trim())
    failures.push("reviewer organization is missing");
  if (!record.independenceStatement?.trim())
    failures.push("independence statement is missing");
  if (record.outcome !== "cleared-for-public-beta")
    failures.push("independent review has not cleared public beta");
  if (record.openCriticalOrHigh !== 0)
    failures.push("independent review has open critical/high findings");
  if (!/^[0-9a-f]{64}$/u.test(record.reportSha256 ?? ""))
    failures.push("independent review report SHA-256 is missing or invalid");
  if (!record.signingIdentity?.trim())
    failures.push("review signing identity is missing");
  if (record.signatureNamespace !== signatureNamespace)
    failures.push("review signature namespace is invalid");
  if (
    !record.completedAt ||
    Number.isNaN(Date.parse(record.completedAt)) ||
    new Date(record.completedAt).toISOString() !== record.completedAt ||
    Date.parse(record.completedAt) > now
  ) {
    failures.push("independent review completion time must be ISO-8601 UTC");
  }

  const reportPath = canonicalEvidencePath(
    record.reportPath,
    "review report",
    [".md", ".pdf"],
    failures,
  );
  const signaturePath = canonicalEvidencePath(
    record.signaturePath,
    "review signature",
    [".sig"],
    failures,
  );
  const allowedSignersPath = canonicalEvidencePath(
    record.allowedSignersPath,
    "review allowed-signers file",
    [".allowed_signers"],
    failures,
  );
  if (reportPath && signaturePath !== `${reportPath}.sig`) {
    failures.push("review signature must be the report path plus .sig");
  }
  if (reportPath && allowedSignersPath !== `${reportPath}.allowed_signers`) {
    failures.push(
      "review allowed-signers file must be the report path plus .allowed_signers",
    );
  }

  const namedEvidencePaths =
    reportPath &&
    signaturePath === `${reportPath}.sig` &&
    allowedSignersPath === `${reportPath}.allowed_signers`
      ? [recordPath, reportPath, signaturePath, allowedSignersPath]
      : null;

  const recordIsFile = regularEvidenceFile(
    cwd,
    recordPath,
    "review record",
    failures,
  );
  const reportIsFile = reportPath
    ? regularEvidenceFile(cwd, reportPath, "review report", failures)
    : false;
  const signatureIsFile = signaturePath
    ? regularEvidenceFile(cwd, signaturePath, "review signature", failures)
    : false;
  const allowedSignersIsFile = allowedSignersPath
    ? regularEvidenceFile(
        cwd,
        allowedSignersPath,
        "review allowed-signers file",
        failures,
      )
    : false;
  void recordIsFile;

  if (
    reportPath &&
    reportIsFile &&
    sha256(cwd, reportPath) !== record.reportSha256
  ) {
    failures.push("independent review report SHA-256 does not match its file");
  }

  if (
    reportPath &&
    signaturePath &&
    allowedSignersPath &&
    reportIsFile &&
    signatureIsFile &&
    allowedSignersIsFile &&
    record.signingIdentity?.trim() &&
    record.signatureNamespace === signatureNamespace
  ) {
    const verification = spawnSync(
      "ssh-keygen",
      [
        "-Y",
        "verify",
        "-f",
        join(cwd, allowedSignersPath),
        "-I",
        record.signingIdentity,
        "-n",
        record.signatureNamespace,
        "-s",
        join(cwd, signaturePath),
      ],
      { input: readFileSync(join(cwd, reportPath)) },
    );
    if (verification.status !== 0) {
      failures.push("independent review report SSH signature did not verify");
    }
  }

  validateHistory(
    record,
    { cwd, head: options.head },
    namedEvidencePaths,
    failures,
  );
  return failures;
}
