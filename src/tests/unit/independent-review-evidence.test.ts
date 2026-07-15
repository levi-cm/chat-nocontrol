// @vitest-environment node

import { createHash } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import {
  type ReviewRecord,
  validateIndependentReviewEvidence,
} from "../../../scripts/independent-review-evidence";

const temporaryDirectories: string[] = [];
const namespace = "chat-nocontrol-security-review-v1";

function command(cwd: string, executable: string, args: string[]): string {
  const result = spawnSync(executable, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

function git(cwd: string, ...args: string[]): string {
  return command(cwd, "git", args);
}

function write(cwd: string, path: string, contents: string): void {
  const fullPath = join(cwd, path);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, contents);
}

interface ReviewRepository {
  cwd: string;
  candidate: string;
  head: string;
  record: ReviewRecord;
}

function createReviewRepository(): ReviewRepository {
  const cwd = mkdtempSync(join(tmpdir(), "chat-nocontrol-review-"));
  temporaryDirectories.push(cwd);
  git(cwd, "init", "-q");
  git(cwd, "config", "user.name", "Release test");
  git(cwd, "config", "user.email", "release-test@example.com");
  write(cwd, "src/app.ts", "export const candidate = true;\n");
  git(cwd, "add", "src/app.ts");
  git(cwd, "commit", "-q", "-m", "candidate");
  const candidate = git(cwd, "rev-parse", "HEAD");

  const reportPath = "docs/reviews/independent-cryptographic-review.md";
  const signaturePath = `${reportPath}.sig`;
  const allowedSignersPath = `${reportPath}.allowed_signers`;
  write(cwd, reportPath, "# Independent review\n\nCleared for public beta.\n");

  const keyPath = join(cwd, "reviewer-key");
  command(cwd, "ssh-keygen", [
    "-q",
    "-t",
    "ed25519",
    "-N",
    "",
    "-C",
    "reviewer@example.com",
    "-f",
    keyPath,
  ]);
  command(cwd, "ssh-keygen", [
    "-Y",
    "sign",
    "-f",
    keyPath,
    "-n",
    namespace,
    join(cwd, reportPath),
  ]);
  const publicKey = readFileSync(`${keyPath}.pub`, "utf8")
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .join(" ");
  write(cwd, allowedSignersPath, `reviewer@example.com ${publicKey}\n`);

  const record: ReviewRecord = {
    schemaVersion: 2,
    reviewer: {
      name: "Independent Reviewer",
      organization: "Independent individual",
    },
    independenceStatement:
      "I did not design or implement the reviewed code and am independent of its implementation team.",
    reviewedCommit: candidate,
    completedAt: "2026-07-13T12:00:00.000Z",
    outcome: "cleared-for-public-beta",
    openCriticalOrHigh: 0,
    reportPath,
    reportSha256: createHash("sha256")
      .update(readFileSync(join(cwd, reportPath)))
      .digest("hex"),
    signaturePath,
    allowedSignersPath,
    signingIdentity: "reviewer@example.com",
    signatureNamespace: namespace,
  };
  write(
    cwd,
    "docs/independent-security-review.json",
    `${JSON.stringify(record, null, 2)}\n`,
  );
  git(cwd, "add", "docs");
  git(cwd, "commit", "-q", "-m", "add independent review evidence");

  return { cwd, candidate, head: git(cwd, "rev-parse", "HEAD"), record };
}

function validate(repository: ReviewRepository): string[] {
  return validateIndependentReviewEvidence(repository.record, {
    cwd: repository.cwd,
    head: repository.head,
    now: Date.parse("2026-07-13T13:00:00.000Z"),
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("independent review evidence", () => {
  it("accepts one evidence-only child commit of the reviewed candidate", () => {
    expect(validate(createReviewRepository())).toEqual([]);
  });

  it("rejects a source modification in the evidence commit", () => {
    const repository = createReviewRepository();
    git(repository.cwd, "reset", "--soft", repository.candidate);
    write(repository.cwd, "src/app.ts", "export const candidate = false;\n");
    git(repository.cwd, "add", "src/app.ts");
    git(repository.cwd, "commit", "-q", "-m", "mix source and evidence");
    repository.head = git(repository.cwd, "rev-parse", "HEAD");

    expect(validate(repository)).toContain(
      "reviewed commit to release HEAD may add only the four named review evidence files",
    );
  });

  it("rejects a renamed application file in the evidence commit", () => {
    const repository = createReviewRepository();
    git(repository.cwd, "reset", "--soft", repository.candidate);
    renameSync(
      join(repository.cwd, "src/app.ts"),
      join(repository.cwd, "src/renamed.ts"),
    );
    git(repository.cwd, "add", "-A");
    git(repository.cwd, "commit", "-q", "-m", "rename source with evidence");
    repository.head = git(repository.cwd, "rev-parse", "HEAD");

    expect(validate(repository)).toContain(
      "reviewed commit to release HEAD may add only the four named review evidence files",
    );
  });

  it("rejects an unexpected fifth evidence file", () => {
    const repository = createReviewRepository();
    git(repository.cwd, "reset", "--soft", repository.candidate);
    write(repository.cwd, "docs/reviews/unexpected.txt", "not permitted\n");
    git(repository.cwd, "add", "docs/reviews/unexpected.txt");
    git(repository.cwd, "commit", "-q", "-m", "add extra evidence");
    repository.head = git(repository.cwd, "rev-parse", "HEAD");

    expect(validate(repository)).toContain(
      "reviewed commit to release HEAD may add only the four named review evidence files",
    );
  });

  it("rejects an extra commit after the evidence commit", () => {
    const repository = createReviewRepository();
    git(repository.cwd, "commit", "-q", "--allow-empty", "-m", "extra commit");
    repository.head = git(repository.cwd, "rev-parse", "HEAD");

    expect(validate(repository)).toContain(
      "release HEAD must be the single immediate child of reviewedCommit",
    );
  });

  it("rejects a reviewed commit that is not an ancestor of release HEAD", () => {
    const repository = createReviewRepository();
    const tree = git(repository.cwd, "rev-parse", `${repository.head}^{tree}`);
    repository.record.reviewedCommit = git(
      repository.cwd,
      "commit-tree",
      tree,
      "-m",
      "unrelated root",
    );

    expect(validate(repository)).toContain(
      "reviewedCommit must be an ancestor of release HEAD",
    );
  });

  it("rejects path traversal and mismatched companion filenames", () => {
    const repository = createReviewRepository();
    repository.record.reportPath = "docs/reviews/../review.md";

    expect(validate(repository)).toContain(
      "review report must be a canonical file under docs/reviews",
    );

    repository.record.reportPath =
      "docs/reviews/independent-cryptographic-review.md";
    repository.record.signaturePath =
      "docs/reviews/independent-cryptographic-review.md.other.sig";

    expect(validate(repository)).toContain(
      "review signature must be the report path plus .sig",
    );
  });

  it("rejects symlinked evidence", () => {
    const repository = createReviewRepository();
    const reportPath = join(repository.cwd, repository.record.reportPath!);
    const contents = readFileSync(reportPath);
    rmSync(reportPath);
    write(repository.cwd, "real-review.md", contents.toString("utf8"));
    symlinkSync(join(repository.cwd, "real-review.md"), reportPath);

    expect(validate(repository)).toContain(
      "review report must be a regular non-symlink file",
    );
  });

  it("rejects executable evidence files", () => {
    const repository = createReviewRepository();
    chmodSync(join(repository.cwd, repository.record.reportPath!), 0o755);
    git(repository.cwd, "add", repository.record.reportPath!);
    git(repository.cwd, "commit", "-q", "--amend", "--no-edit");
    repository.head = git(repository.cwd, "rev-parse", "HEAD");

    expect(validate(repository)).toContain(
      "review report must be a non-executable regular file",
    );
  });

  it("rejects working-tree evidence that differs from release HEAD", () => {
    const repository = createReviewRepository();
    appendFileSync(
      join(repository.cwd, repository.record.allowedSignersPath!),
      "\n",
    );

    expect(validate(repository)).toContain(
      "review evidence files must match release HEAD exactly",
    );
  });
});
