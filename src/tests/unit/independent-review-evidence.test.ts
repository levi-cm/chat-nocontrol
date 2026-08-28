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
const namespace = "chat-nocontrol-security-review-cat5-v2";

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

function createReviewRepository(
  options: {
    replaceTrustedRootInCandidate?: boolean;
    reviewerAlsoReleaseSigner?: boolean;
    reviewerNamespace?: "cat5" | "git" | "unrestricted";
    signWithProjectKey?: boolean;
    trustedSigner?: boolean;
  } = {},
): ReviewRepository {
  const cwd = mkdtempSync(join(tmpdir(), "chat-nocontrol-review-"));
  temporaryDirectories.push(cwd);
  git(cwd, "init", "-q");
  git(cwd, "config", "user.name", "Release test");
  git(cwd, "config", "user.email", "release-test@example.com");

  const trustedKeyPath = join(cwd, "trusted-reviewer-key");
  command(cwd, "ssh-keygen", [
    "-q",
    "-t",
    "ed25519",
    "-N",
    "",
    "-C",
    "reviewer@example.com",
    "-f",
    trustedKeyPath,
  ]);
  const trustedPublicKey = readFileSync(`${trustedKeyPath}.pub`, "utf8")
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .join(" ");
  const projectKeyPath = join(cwd, "project-release-key");
  command(cwd, "ssh-keygen", [
    "-q",
    "-t",
    "ed25519",
    "-N",
    "",
    "-C",
    "release@example.com",
    "-f",
    projectKeyPath,
  ]);
  const projectPublicKey = readFileSync(`${projectKeyPath}.pub`, "utf8")
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .join(" ");
  const reviewerNamespace =
    options.reviewerNamespace === "unrestricted"
      ? ""
      : ` namespaces=\"${options.reviewerNamespace === "git" ? "git" : namespace}\"`;
  const releasePublicKey = options.reviewerAlsoReleaseSigner
    ? trustedPublicKey
    : projectPublicKey;
  write(
    cwd,
    ".github/allowed_signers",
    `reviewer@example.com${reviewerNamespace} ${trustedPublicKey}\nrelease@example.com namespaces=\"git\" ${releasePublicKey}\n`,
  );
  write(cwd, "src/app.ts", "export const candidate = false;\n");
  git(cwd, "add", ".github/allowed_signers", "src/app.ts");
  git(cwd, "commit", "-q", "-m", "establish trusted review root");

  const forgedKeyPath = join(cwd, "forged-reviewer-key");
  if (
    options.trustedSigner === false ||
    options.replaceTrustedRootInCandidate
  ) {
    command(cwd, "ssh-keygen", [
      "-q",
      "-t",
      "ed25519",
      "-N",
      "",
      "-C",
      "reviewer@example.com",
      "-f",
      forgedKeyPath,
    ]);
  }
  if (options.replaceTrustedRootInCandidate) {
    const forgedPublicKey = readFileSync(`${forgedKeyPath}.pub`, "utf8")
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .join(" ");
    write(
      cwd,
      ".github/allowed_signers",
      `reviewer@example.com ${forgedPublicKey}\n`,
    );
  }
  write(
    cwd,
    "src/app.ts",
    options.replaceTrustedRootInCandidate
      ? "export const exfiltrate = true;\n"
      : "export const candidate = true;\n",
  );
  git(cwd, "add", ".github/allowed_signers", "src/app.ts");
  git(cwd, "commit", "-q", "-m", "candidate");
  const candidate = git(cwd, "rev-parse", "HEAD");

  const reportPath = "docs/reviews/independent-cryptographic-review.md";
  const signaturePath = `${reportPath}.sig`;
  write(cwd, reportPath, "# Independent review\n\nCleared for public beta.\n");

  const keyPath = options.signWithProjectKey
    ? projectKeyPath
    : options.trustedSigner === false || options.replaceTrustedRootInCandidate
      ? forgedKeyPath
      : trustedKeyPath;
  command(cwd, "ssh-keygen", [
    "-Y",
    "sign",
    "-f",
    keyPath,
    "-n",
    namespace,
    join(cwd, reportPath),
  ]);

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
    signingIdentity: options.signWithProjectKey
      ? "release@example.com"
      : "reviewer@example.com",
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
  it("rejects a candidate that replaces the trusted signer root", () => {
    expect(
      validate(createReviewRepository({ replaceTrustedRootInCandidate: true })),
    ).toContain(
      "trusted allowed-signers root must predate reviewedCommit and remain unchanged",
    );
  });

  it("rejects a self-forged signature absent from the fixed trust root", () => {
    expect(
      validate(createReviewRepository({ trustedSigner: false })),
    ).toContain("independent review report SSH signature did not verify");
  });

  it("accepts one evidence-only child commit of the reviewed candidate", () => {
    expect(validate(createReviewRepository())).toEqual([]);
  });

  it("rejects an independent review signed by the project release signer", () => {
    expect(
      validate(createReviewRepository({ signWithProjectKey: true })),
    ).toContain(
      "independent review signer must be authorized only for the CAT5 review namespace",
    );
  });

  it("rejects a reviewer key that is also authorized to sign Git tags", () => {
    expect(
      validate(createReviewRepository({ reviewerAlsoReleaseSigner: true })),
    ).toContain(
      "review and Git release signing roles must use different keys and principals",
    );
  });

  it("rejects an unrestricted reviewer trust-root entry", () => {
    expect(
      validate(createReviewRepository({ reviewerNamespace: "unrestricted" })),
    ).toContain(
      "allowed signer entries must use exactly one approved signature namespace",
    );
  });

  it("rejects the legacy V1 review-signature namespace", () => {
    const repository = createReviewRepository();
    repository.record.signatureNamespace = "chat-nocontrol-security-review-v1";

    expect(validate(repository)).toContain(
      "review signature namespace is invalid",
    );
  });

  it("rejects a source modification in the evidence commit", () => {
    const repository = createReviewRepository();
    git(repository.cwd, "reset", "--soft", repository.candidate);
    write(repository.cwd, "src/app.ts", "export const candidate = false;\n");
    git(repository.cwd, "add", "src/app.ts");
    git(repository.cwd, "commit", "-q", "-m", "mix source and evidence");
    repository.head = git(repository.cwd, "rev-parse", "HEAD");

    expect(validate(repository)).toContain(
      "reviewed commit to release HEAD may add only the three named review evidence files",
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
      "reviewed commit to release HEAD may add only the three named review evidence files",
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
      "reviewed commit to release HEAD may add only the three named review evidence files",
    );
  });

  it("rejects allowed_signers from the evidence-only child diff", () => {
    const repository = createReviewRepository();
    git(repository.cwd, "reset", "--soft", repository.candidate);
    appendFileSync(
      join(repository.cwd, ".github/allowed_signers"),
      "# trust roots must predate the candidate\n",
    );
    git(repository.cwd, "add", ".github/allowed_signers");
    git(repository.cwd, "commit", "-q", "-m", "mix trust root and evidence");
    repository.head = git(repository.cwd, "rev-parse", "HEAD");

    expect(validate(repository)).toContain(
      "reviewed commit to release HEAD may add only the three named review evidence files",
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
    appendFileSync(join(repository.cwd, repository.record.reportPath!), "\n");

    expect(validate(repository)).toContain(
      "review evidence files must match release HEAD exactly",
    );
  });
});
