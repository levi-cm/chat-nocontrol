import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, posix } from "node:path";

interface ReviewRecord {
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

const failures: string[] = [];
const recordPath = "docs/independent-security-review.json";
const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
const commit = head.status === 0 ? head.stdout.trim() : "";

function evidencePath(
  value: string | undefined,
  label: string,
  extensions: readonly string[],
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
  if (!existsSync(value)) {
    failures.push(`${label} does not exist: ${value}`);
    return null;
  }
  const status = lstatSync(value);
  if (!status.isFile() || status.isSymbolicLink()) {
    failures.push(`${label} must be a regular non-symlink file`);
    return null;
  }
  return value;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

if (!existsSync(recordPath)) {
  failures.push(
    `missing ${recordPath}; an implementation-team or AI review is not independent review`,
  );
} else {
  let record: ReviewRecord = {};
  try {
    record = JSON.parse(readFileSync(recordPath, "utf8")) as ReviewRecord;
  } catch {
    failures.push(`${recordPath} is not valid JSON`);
  }
  if (record.schemaVersion !== 2)
    failures.push("review schemaVersion must be 2");
  if (!record.reviewer?.name?.trim()) failures.push("reviewer name is missing");
  if (!record.reviewer?.organization?.trim())
    failures.push("reviewer organization is missing");
  if (!record.independenceStatement?.trim())
    failures.push("independence statement is missing");
  if (record.reviewedCommit !== commit)
    failures.push("independent review does not cover exact HEAD");
  if (record.outcome !== "cleared-for-public-beta")
    failures.push("independent review has not cleared public beta");
  if (record.openCriticalOrHigh !== 0)
    failures.push("independent review has open critical/high findings");
  if (!/^[0-9a-f]{64}$/u.test(record.reportSha256 ?? ""))
    failures.push("independent review report SHA-256 is missing or invalid");
  const reportPath = evidencePath(record.reportPath, "review report", [
    ".md",
    ".pdf",
  ]);
  const signaturePath = evidencePath(record.signaturePath, "review signature", [
    ".sig",
  ]);
  const allowedSignersPath = evidencePath(
    record.allowedSignersPath,
    "review allowed-signers file",
    [".allowed_signers"],
  );
  if (reportPath && sha256(reportPath) !== record.reportSha256) {
    failures.push("independent review report SHA-256 does not match its file");
  }
  if (!record.signingIdentity?.trim()) {
    failures.push("review signing identity is missing");
  }
  if (record.signatureNamespace !== "chat-nocontrol-security-review-v1") {
    failures.push("review signature namespace is invalid");
  }
  if (
    reportPath &&
    signaturePath &&
    allowedSignersPath &&
    record.signingIdentity?.trim() &&
    record.signatureNamespace === "chat-nocontrol-security-review-v1"
  ) {
    const verification = spawnSync(
      "ssh-keygen",
      [
        "-Y",
        "verify",
        "-f",
        allowedSignersPath,
        "-I",
        record.signingIdentity,
        "-n",
        record.signatureNamespace,
        "-s",
        signaturePath,
      ],
      { input: readFileSync(reportPath), encoding: "utf8" },
    );
    if (verification.status !== 0) {
      failures.push("independent review report SSH signature did not verify");
    }
  }
  if (
    !record.completedAt ||
    Number.isNaN(Date.parse(record.completedAt)) ||
    new Date(record.completedAt).toISOString() !== record.completedAt ||
    Date.parse(record.completedAt) > Date.now()
  ) {
    failures.push("independent review completion time must be ISO-8601 UTC");
  }
}

const response = await fetch(
  "https://api.github.com/repos/levi-cm/chat-nocontrol/private-vulnerability-reporting",
  { headers: { Accept: "application/vnd.github+json" } },
).catch(() => null);
if (!response?.ok) {
  failures.push("could not verify GitHub private vulnerability reporting");
} else {
  const reporting = (await response.json()) as { enabled?: boolean };
  if (reporting.enabled !== true) {
    failures.push("GitHub private vulnerability reporting is not enabled");
  }
}

if (failures.length > 0) {
  throw new Error(`Public-beta release blocked:\n- ${failures.join("\n- ")}`);
}

console.log(
  `Public-beta prerequisites OK: independent review covers ${commit}; private reporting enabled.`,
);
