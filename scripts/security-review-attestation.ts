import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, join, posix } from "node:path";

import {
  type OwnerAttestation,
  validateOwnerAttestation,
} from "./owner-attestation";

export const SECURITY_REVIEW_OWNER_STATEMENT =
  "I attest that this record accurately reports the completed security review for the exact candidate and that no known critical or high findings remain open.";

export interface SecurityReviewAttestation {
  schemaVersion?: number;
  reviewer?: { name?: string; organization?: string };
  independenceStatement?: string;
  reviewedCommit?: string;
  completedAt?: string;
  outcome?: string;
  openCriticalOrHigh?: number;
  reportPath?: string;
  reportSha256?: string;
  ownerAttestation?: OwnerAttestation;
}

export interface SecurityReviewValidationOptions {
  cwd?: string;
  head: string;
  now?: number;
}

const recordPath = "docs/security-review-attestation.json";
const reportPath = "docs/reviews/security-review.md";
const allowedRecordProperties = new Set([
  "schemaVersion",
  "reviewer",
  "independenceStatement",
  "reviewedCommit",
  "completedAt",
  "outcome",
  "openCriticalOrHigh",
  "reportPath",
  "reportSha256",
  "ownerAttestation",
]);
const allowedReviewerProperties = new Set(["name", "organization"]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function closedShapeFailures(value: unknown): string[] {
  if (!isPlainRecord(value))
    return ["security review attestation must be an object"];
  const failures = Object.keys(value)
    .filter((property) => !allowedRecordProperties.has(property))
    .sort()
    .map(
      (property) =>
        `security review attestation contains unknown property ${property}`,
    );
  if (isPlainRecord(value.reviewer)) {
    failures.push(
      ...Object.keys(value.reviewer)
        .filter((property) => !allowedReviewerProperties.has(property))
        .sort()
        .map(
          (property) =>
            `security review reviewer contains unknown property ${property}`,
        ),
    );
  }
  return failures;
}

function git(
  cwd: string,
  args: string[],
): { status: number | null; stdout: string } {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout };
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

function validateHistory(
  record: SecurityReviewAttestation,
  cwd: string,
  head: string,
  failures: string[],
): void {
  const status = git(cwd, ["status", "--porcelain", "--untracked-files=all"]);
  if (status.status !== 0 || status.stdout !== "") {
    failures.push("release worktree must be clean");
  }
  const candidate = record.reviewedCommit ?? "";
  if (!/^[0-9a-f]{40}$/u.test(candidate)) {
    failures.push("reviewedCommit must be a full lowercase commit SHA");
    return;
  }
  if (git(cwd, ["cat-file", "-e", `${candidate}^{commit}`]).status !== 0) {
    failures.push("reviewedCommit is not a valid local commit");
    return;
  }
  if (git(cwd, ["merge-base", "--is-ancestor", candidate, head]).status !== 0) {
    failures.push("reviewedCommit must be an ancestor of release HEAD");
    return;
  }
  const parent = git(cwd, ["rev-parse", `${head}^`]);
  const count = git(cwd, ["rev-list", "--count", `${candidate}..${head}`]);
  if (
    parent.status !== 0 ||
    parent.stdout.trim() !== candidate ||
    count.status !== 0 ||
    count.stdout.trim() !== "1"
  ) {
    failures.push(
      "release HEAD must be the single immediate child of reviewedCommit",
    );
  }
  const evidencePaths = [recordPath, reportPath];
  for (const args of [
    ["diff", "--quiet", head, "--", ...evidencePaths],
    ["diff", "--cached", "--quiet", head, "--", ...evidencePaths],
  ]) {
    if (git(cwd, args).status !== 0) {
      failures.push("review evidence files must match release HEAD exactly");
      break;
    }
  }
  const diff = git(cwd, [
    "diff",
    "--name-status",
    "-z",
    "--no-renames",
    candidate,
    head,
  ]);
  if (diff.status !== 0) {
    failures.push("could not verify the reviewed commit to release HEAD diff");
    return;
  }
  const fields = diff.stdout.split("\0").filter(Boolean);
  const actual = new Map<string, string>();
  for (let index = 0; index < fields.length; index += 2) {
    if (fields[index] && fields[index + 1])
      actual.set(fields[index + 1]!, fields[index]!);
  }
  if (
    actual.size !== 2 ||
    evidencePaths.some((path) => actual.get(path) !== "A") ||
    [...actual].some(
      ([path, status]) => status !== "A" || !evidencePaths.includes(path),
    )
  ) {
    failures.push(
      "reviewed commit to release HEAD may add only the two named review evidence files",
    );
  }
}

function canonicalUtc(value: string | undefined, now: number): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return (
    !Number.isNaN(timestamp) &&
    new Date(timestamp).toISOString() === value &&
    timestamp <= now
  );
}

export function validateSecurityReviewAttestation(
  record: SecurityReviewAttestation,
  options: SecurityReviewValidationOptions,
): string[] {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? Date.now();
  const failures = closedShapeFailures(record);
  if (record.schemaVersion !== 3)
    failures.push("review schemaVersion must be 3");
  if (!record.reviewer?.name?.trim()) failures.push("reviewer name is missing");
  if (!record.reviewer?.organization?.trim())
    failures.push("reviewer organization is missing");
  if (!record.independenceStatement?.trim())
    failures.push("independence statement is missing");
  if (record.outcome !== "owner-attested-cleared-for-public-beta") {
    failures.push("owner-attested security review has not cleared public beta");
  }
  if (record.openCriticalOrHigh !== 0) {
    failures.push("security review has open critical/high findings");
  }
  if (!canonicalUtc(record.completedAt, now)) {
    failures.push(
      "security review completion time must be canonical ISO-8601 UTC and not future",
    );
  }
  if (record.reportPath !== reportPath) {
    failures.push(`review report path must be ${reportPath}`);
  }
  if (
    !record.reportPath ||
    isAbsolute(record.reportPath) ||
    record.reportPath.includes("\\") ||
    posix.normalize(record.reportPath) !== record.reportPath
  ) {
    failures.push("review report must use its canonical repository path");
  }
  if (!/^[0-9a-f]{64}$/u.test(record.reportSha256 ?? "")) {
    failures.push("security review report SHA-256 is missing or invalid");
  }
  const recordIsFile = regularEvidenceFile(
    cwd,
    recordPath,
    "review record",
    failures,
  );
  const reportIsFile = regularEvidenceFile(
    cwd,
    reportPath,
    "review report",
    failures,
  );
  void recordIsFile;
  if (
    reportIsFile &&
    createHash("sha256")
      .update(readFileSync(join(cwd, reportPath)))
      .digest("hex") !== record.reportSha256
  ) {
    failures.push("security review report SHA-256 does not match its file");
  }
  failures.push(
    ...validateOwnerAttestation(record.ownerAttestation, {
      cwd,
      completedAt: record.completedAt,
      expectedStatement: SECURITY_REVIEW_OWNER_STATEMENT,
      now,
    }),
  );
  validateHistory(record, cwd, options.head, failures);
  return failures;
}

export type ReviewRecord = SecurityReviewAttestation;
export const validateIndependentReviewEvidence =
  validateSecurityReviewAttestation;
