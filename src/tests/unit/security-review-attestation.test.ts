// @vitest-environment node

import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import {
  SECURITY_REVIEW_OWNER_STATEMENT,
  type SecurityReviewAttestation,
  validateSecurityReviewAttestation,
} from "../../../scripts/security-review-attestation";

const directories: string[] = [];
const principal = "136596632+levi-cm@users.noreply.github.com";

function command(cwd: string, executable: string, args: string[]): string {
  const result = spawnSync(executable, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
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

function repository(): {
  cwd: string;
  candidate: string;
  head: string;
  record: SecurityReviewAttestation;
} {
  const cwd = mkdtempSync(join(tmpdir(), "cat5-owner-review-"));
  directories.push(cwd);
  git(cwd, "init", "-q");
  git(cwd, "config", "user.name", "Test");
  git(cwd, "config", "user.email", "test@example.com");
  write(
    cwd,
    "package.json",
    JSON.stringify({
      repository: { url: "https://github.com/levi-cm/chat-nocontrol.git" },
    }),
  );
  write(
    cwd,
    ".github/allowed_signers",
    `${principal} namespaces="git" ssh-ed25519 AAAATEST\n`,
  );
  write(cwd, "src/app.ts", "export const candidate = true;\n");
  git(cwd, "add", ".");
  git(cwd, "commit", "-q", "-m", "candidate");
  const candidate = git(cwd, "rev-parse", "HEAD");
  const report =
    "# Security review\n\nNo critical or high findings remain open.\n";
  write(cwd, "docs/reviews/security-review.md", report);
  const record: SecurityReviewAttestation = {
    schemaVersion: 3,
    reviewer: {
      name: "Human Reviewer",
      organization: "Independent individual",
    },
    independenceStatement:
      "I did not implement the reviewed candidate and reviewed it independently.",
    reviewedCommit: candidate,
    completedAt: "2026-08-30T12:00:00.000Z",
    outcome: "owner-attested-cleared-for-public-beta",
    openCriticalOrHigh: 0,
    reportPath: "docs/reviews/security-review.md",
    reportSha256: createHash("sha256").update(report).digest("hex"),
    ownerAttestation: {
      githubActor: "levi-cm",
      releaseSignerPrincipal: principal,
      statement: SECURITY_REVIEW_OWNER_STATEMENT,
      attestedAt: "2026-08-30T12:30:00.000Z",
    },
  };
  write(
    cwd,
    "docs/security-review-attestation.json",
    `${JSON.stringify(record, null, 2)}\n`,
  );
  git(cwd, "add", "docs");
  git(cwd, "commit", "-q", "-m", "owner-attested review evidence");
  return { cwd, candidate, head: git(cwd, "rev-parse", "HEAD"), record };
}

function validate(repo: ReturnType<typeof repository>): string[] {
  return validateSecurityReviewAttestation(repo.record, {
    cwd: repo.cwd,
    head: repo.head,
    now: Date.parse("2026-08-30T13:00:00.000Z"),
  });
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("owner-attested security review", () => {
  it("accepts the exact two-file evidence-only child", () => {
    expect(validate(repository())).toEqual([]);
  });

  it.each([
    ["schemaVersion", 2, "review schemaVersion must be 3"],
    [
      "reviewedCommit",
      "0".repeat(40),
      "reviewedCommit is not a valid local commit",
    ],
    [
      "outcome",
      "cleared-for-public-beta",
      "owner-attested security review has not cleared public beta",
    ],
    [
      "openCriticalOrHigh",
      1,
      "security review has open critical/high findings",
    ],
    [
      "reportSha256",
      "0".repeat(64),
      "security review report SHA-256 does not match its file",
    ],
  ])("rejects invalid %s", (field, value, failure) => {
    const repo = repository();
    Object.assign(repo.record, { [field]: value });
    expect(validate(repo)).toContain(failure);
  });

  it.each([
    [
      "githubActor",
      "attacker",
      "owner attestation GitHub actor must equal repository owner",
    ],
    [
      "releaseSignerPrincipal",
      "wrong@example.com",
      "owner attestation principal must equal the sole Git release signer",
    ],
    ["statement", "close enough", "owner attestation statement is invalid"],
    [
      "attestedAt",
      "2026-08-30T11:00:00.000Z",
      "owner attestation cannot predate completed work",
    ],
    [
      "attestedAt",
      "2026-08-30T14:00:00.000Z",
      "owner attestation time must be canonical ISO-8601 UTC and not future",
    ],
  ])("rejects invalid owner %s", (field, value, failure) => {
    const repo = repository();
    Object.assign(repo.record.ownerAttestation!, { [field]: value });
    expect(validate(repo)).toContain(failure);
  });

  it("rejects unknown fields", () => {
    const repo = repository();
    Object.assign(repo.record, { surprise: true });
    expect(validate(repo)).toContain(
      "security review attestation contains unknown property surprise",
    );
  });

  it("rejects extra evidence-commit files", () => {
    const repo = repository();
    write(repo.cwd, "docs/extra.txt", "extra\n");
    git(repo.cwd, "add", "docs/extra.txt");
    git(repo.cwd, "commit", "--amend", "-q", "--no-edit");
    repo.head = git(repo.cwd, "rev-parse", "HEAD");
    expect(validate(repo)).toContain(
      "reviewed commit to release HEAD may add only the two named review evidence files",
    );
  });

  it("rejects executable reports", () => {
    const repo = repository();
    chmodSync(join(repo.cwd, "docs/reviews/security-review.md"), 0o700);
    expect(validate(repo)).toContain(
      "review report must be a non-executable regular file",
    );
  });

  it("rejects symlinked reports", () => {
    const repo = repository();
    const report = join(repo.cwd, "docs/reviews/security-review.md");
    const target = join(repo.cwd, "report-target.md");
    writeFileSync(target, readFileSync(report));
    unlinkSync(report);
    symlinkSync(target, report);
    expect(validate(repo)).toContain(
      "review report must be a regular non-symlink file",
    );
  });

  it("rejects non-child history", () => {
    const repo = repository();
    write(repo.cwd, "after.txt", "after\n");
    git(repo.cwd, "add", "after.txt");
    git(repo.cwd, "commit", "-q", "-m", "later change");
    repo.head = git(repo.cwd, "rev-parse", "HEAD");
    expect(validate(repo)).toContain(
      "release HEAD must be the single immediate child of reviewedCommit",
    );
  });

  it("rejects a dirty release worktree", () => {
    const repo = repository();
    write(repo.cwd, "src/app.ts", "export const candidate = false;\n");
    expect(validate(repo)).toContain("release worktree must be clean");
  });
});
