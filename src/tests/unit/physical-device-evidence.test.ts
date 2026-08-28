// @vitest-environment node

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getPhysicalDeviceEvidenceBindings,
  importPhysicalDeviceEvidenceFile,
  type PhysicalDeviceEvidence,
  sha256File,
  validatePhysicalDeviceEvidenceFiles,
  validatePhysicalDeviceEvidence,
} from "../../../scripts/physical-device-evidence";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const COMPLETED_AT = "2026-08-08T01:00:00.000Z";
const PHYSICAL_SIGNATURE_NAMESPACE = "chat-nocontrol-physical-device-cat5-v2";
const REQUIRED_CHECKS = [
  "cat5-identity",
  "cat5-recovery",
  "cat5-text",
  "cat5-files",
  "cat5-contacts",
  "cat5-links",
  "recovery-qr-camera",
  "recovery-qr-image-import",
  "legacy-ppxt",
  "legacy-ppxf",
  "legacy-ppxq",
  "legacy-archived-camera-link",
  "offline-reopen",
  "silent-upgrade",
  "web-share",
] as const;

const profiles = [
  {
    id: "android-chrome",
    platform: "android",
    mode: "browser",
    browser: "Chrome",
  },
  {
    id: "android-installed-pwa",
    platform: "android",
    mode: "installed-pwa",
    browser: "Chrome",
  },
  {
    id: "iphone-safari",
    platform: "ios",
    mode: "browser",
    browser: "Safari",
  },
  {
    id: "iphone-home-screen",
    platform: "ios",
    mode: "home-screen",
    browser: "Safari",
  },
] as const;

function validEvidence(): PhysicalDeviceEvidence {
  return {
    schemaVersion: 2,
    status: "PASS",
    reviewedCandidateSha: SHA_A,
    releaseTag: "v0.2.0-beta.1",
    version: "0.2.0-beta.1",
    distSha256: SHA_B,
    archive: {
      file: "chat-nocontrol-v0.2.0-beta.1.tgz",
      sha256: SHA_C,
    },
    completedAt: COMPLETED_AT,
    operator: {
      name: "Physical release tester",
      signingIdentity: "physical-tester@example.com",
    },
    environments: profiles.map((profile) => ({
      ...profile,
      deviceModel: `${profile.id} hardware`,
      osVersion: "physical-os-1",
      browserVersion: "physical-browser-1",
      completedAt: COMPLETED_AT,
      checks: REQUIRED_CHECKS.map((id) => ({
        id,
        status: "PASS" as const,
        notes: `${id} passed on the physical device`,
      })),
    })),
  };
}

function command(cwd: string, executable: string, args: string[]): string {
  const result = spawnSync(executable, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

function createPhysicalTrustRoot(cwd: string): {
  candidate: string;
  keyPath: string;
} {
  command(cwd, "git", ["init", "-q", "-b", "main"]);
  command(cwd, "git", ["config", "user.name", "Physical evidence test"]);
  command(cwd, "git", ["config", "user.email", "fixture@example.com"]);
  const keyPath = join(cwd, "physical-tester-key");
  command(cwd, "ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", keyPath]);
  const publicKey = readFileSync(`${keyPath}.pub`, "utf8")
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .join(" ");
  mkdirSync(join(cwd, ".github"), { recursive: true });
  writeFileSync(
    join(cwd, ".github/physical-device-allowed-signers"),
    `physical-tester@example.com namespaces="${PHYSICAL_SIGNATURE_NAMESPACE}" ${publicKey}\n`,
  );
  writeFileSync(
    join(cwd, ".github/allowed_signers"),
    'release@example.com namespaces="git" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJJ3veGtRWfgspsWDWrt8edvk4F8jjkA1a7lMM57cDKS\n',
  );
  command(cwd, "git", ["add", ".github"]);
  command(cwd, "git", ["commit", "-q", "-m", "establish trust roots"]);
  command(cwd, "git", ["commit", "-q", "--allow-empty", "-m", "candidate"]);
  return {
    candidate: command(cwd, "git", ["rev-parse", "HEAD"]),
    keyPath,
  };
}

const options = {
  reviewedCandidateSha: SHA_A,
  releaseTag: "v0.2.0-beta.1",
  version: "0.2.0-beta.1",
  distSha256: SHA_B,
  archiveFile: "chat-nocontrol-v0.2.0-beta.1.tgz",
  archiveSha256: SHA_C,
  now: Date.parse("2026-08-08T02:00:00.000Z"),
};

describe("physical device release evidence", () => {
  it("accepts the exact physical Android, PWA, iPhone, and home-screen matrix", () => {
    expect(validatePhysicalDeviceEvidence(validEvidence(), options)).toEqual(
      [],
    );
  });

  it.each([
    ["reviewedCandidateSha", "d".repeat(40), "reviewed candidate"],
    ["releaseTag", "v0.2.0-beta.2", "release tag"],
    ["version", "0.2.0-beta.2", "release version"],
    ["distSha256", "d".repeat(64), "dist SHA-256"],
  ] as const)("rejects a wrong %s binding", (field, value, message) => {
    const record = validEvidence();
    Object.assign(record, { [field]: value });
    expect(validatePhysicalDeviceEvidence(record, options)).toContain(
      `physical evidence ${message} does not match the release candidate`,
    );
  });

  it("rejects the wrong release archive name or digest", () => {
    const record = validEvidence();
    record.archive = { file: "wrong.tgz", sha256: "d".repeat(64) };
    expect(validatePhysicalDeviceEvidence(record, options)).toEqual(
      expect.arrayContaining([
        "physical evidence archive file does not match the release artifact",
        "physical evidence archive SHA-256 does not match the release artifact",
      ]),
    );
  });

  it("rejects malformed binding values even when expected values are equally malformed", () => {
    const record = validEvidence();
    record.reviewedCandidateSha = "candidate";
    record.releaseTag = "beta";
    record.version = "beta";
    record.distSha256 = "dist";
    record.archive = { file: "archive", sha256: "archive" };
    const failures = validatePhysicalDeviceEvidence(record, {
      ...options,
      reviewedCandidateSha: "candidate",
      releaseTag: "beta",
      version: "beta",
      distSha256: "dist",
      archiveFile: "archive",
      archiveSha256: "archive",
    });
    expect(failures).toEqual(
      expect.arrayContaining([
        "physical evidence reviewed candidate must be a full lowercase commit SHA",
        "physical evidence release tag is invalid",
        "physical evidence release version is invalid",
        "physical evidence dist SHA-256 is invalid",
        "physical evidence archive file is invalid",
        "physical evidence archive SHA-256 is invalid",
      ]),
    );
  });

  it("rejects missing, duplicate, partial, NOT RUN, and failed rows", () => {
    const record = validEvidence();
    record.environments?.pop();
    record.environments?.push(
      structuredClone(
        record.environments[0] as NonNullable<
          PhysicalDeviceEvidence["environments"]
        >[number],
      ),
    );
    const first = record.environments?.[0];
    first?.checks?.pop();
    if (first?.checks?.[0]) first.checks[0].status = "NOT RUN";
    if (record.environments?.[1]?.checks?.[0])
      record.environments[1].checks[0].status = "FAIL";

    const failures = validatePhysicalDeviceEvidence(record, options);
    expect(failures).toEqual(
      expect.arrayContaining([
        "physical environment android-chrome is duplicated",
        "physical environment iphone-home-screen is missing",
        "android-chrome check web-share is missing",
        "android-chrome check cat5-identity is not PASS",
        "android-installed-pwa check cat5-identity is not PASS",
      ]),
    );
  });

  it("accepts Web Share as unsupported only when the physical environment says so", () => {
    const record = validEvidence();
    const webShare = record.environments?.[3]?.checks?.find(
      (check) => check.id === "web-share",
    );
    if (webShare) {
      webShare.status = "NOT SUPPORTED";
      webShare.supported = false;
      webShare.notes = "Web Share is unavailable in this physical mode";
    }
    expect(validatePhysicalDeviceEvidence(record, options)).toEqual([]);

    if (webShare) webShare.supported = true;
    expect(validatePhysicalDeviceEvidence(record, options)).toContain(
      "iphone-home-screen check web-share may be NOT SUPPORTED only when supported is false",
    );

    if (webShare) {
      webShare.status = "PASS";
      webShare.supported = false;
    }
    expect(validatePhysicalDeviceEvidence(record, options)).toContain(
      "iphone-home-screen check web-share cannot PASS when supported is false",
    );
  });

  it("rejects prohibited V2 contact/message QR creation and unknown checks", () => {
    const record = validEvidence();
    record.environments?.[0]?.checks?.push(
      {
        id: "v2-contact-qr-creation",
        status: "PASS",
        notes: "must not exist",
      },
      {
        id: "v2-message-qr-creation",
        status: "PASS",
        notes: "must not exist",
      },
    );
    expect(validatePhysicalDeviceEvidence(record, options)).toEqual(
      expect.arrayContaining([
        "android-chrome contains prohibited V2 contact/message QR creation evidence",
      ]),
    );
  });

  it("rejects placeholders, non-physical metadata, bad timestamps, and future evidence", () => {
    const record = validEvidence();
    record.status = "NOT RUN";
    record.operator = { name: "<tester>" };
    record.completedAt = "2026-08-08T03:00:00.000Z";
    const first = record.environments?.[0];
    if (first) {
      first.deviceModel = "emulated Pixel";
      first.osVersion = "<version>";
      first.browserVersion = "";
      first.completedAt = "not-a-time";
    }
    expect(validatePhysicalDeviceEvidence(record, options)).toEqual(
      expect.arrayContaining([
        "physical evidence status must be PASS",
        "physical evidence operator name is missing or placeholder",
        "physical evidence completion time must be ISO-8601 UTC and not future",
        "android-chrome deviceModel must identify physical hardware",
        "android-chrome osVersion is missing or placeholder",
        "android-chrome browserVersion is missing or placeholder",
        "android-chrome completion time must be ISO-8601 UTC and not future",
      ]),
    );
  });

  it("keeps the documentation example fail-closed and NOT RUN", () => {
    const example = JSON.parse(
      readFileSync(
        "docs/physical-device-release-evidence.example.json",
        "utf8",
      ),
    ) as PhysicalDeviceEvidence;
    const failures = validatePhysicalDeviceEvidence(example, options);
    expect(example.status).toBe("NOT RUN");
    expect(failures.length).toBeGreaterThan(0);
    expect(failures).toContain("physical evidence status must be PASS");
  });

  it("publishes a closed JSON schema for the external evidence artifact", () => {
    const schema = JSON.parse(
      readFileSync("docs/physical-device-release-evidence.schema.json", "utf8"),
    ) as {
      $schema?: string;
      additionalProperties?: boolean;
      required?: string[];
      properties?: { environments?: { minItems?: number; maxItems?: number } };
    };
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "reviewedCandidateSha",
        "releaseTag",
        "distSha256",
        "archive",
        "environments",
      ]),
    );
    expect(
      (
        schema as {
          properties?: { operator?: { required?: string[] } };
        }
      ).properties?.operator?.required,
    ).toEqual(["name", "signingIdentity"]);
    expect(schema.properties?.environments).toMatchObject({
      minItems: 4,
      maxItems: 4,
    });
  });

  it("rejects unknown properties before importing external evidence", () => {
    const record = validEvidence() as PhysicalDeviceEvidence & {
      unreviewed?: string;
    };
    record.unreviewed = "must not be silently accepted";
    expect(validatePhysicalDeviceEvidence(record, options)).toContain(
      "physical evidence contains unknown property unreviewed",
    );

    const environment = record.environments?.[0];
    if (environment) Object.assign(environment, { extra: true });
    expect(validatePhysicalDeviceEvidence(record, options)).toContain(
      "android-chrome contains unknown property extra",
    );
  });

  it("imports only an exact-digest, exact-build physical evidence file", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cat5-device-import-"));
    try {
      const trust = createPhysicalTrustRoot(cwd);
      mkdirSync(join(cwd, "dist"));
      mkdirSync(join(cwd, "output/release"), { recursive: true });
      writeFileSync(join(cwd, "dist/index.html"), "CAT5");
      writeFileSync(
        join(cwd, "output/release/chat-nocontrol-v0.2.0-beta.1.tgz"),
        "release archive",
      );
      const record = validEvidence();
      record.reviewedCandidateSha = trust.candidate;
      const bindings = validatePhysicalDeviceEvidenceFiles({
        cwd,
        record,
        reviewedCandidateSha: trust.candidate,
        version: "0.2.0-beta.1",
        now: options.now,
      }).bindings;
      record.distSha256 = bindings.distSha256;
      if (record.archive) record.archive.sha256 = bindings.archiveSha256;
      const input = join(cwd, "external-physical-evidence.json");
      writeFileSync(input, `${JSON.stringify(record)}\n`, { mode: 0o600 });
      command(cwd, "ssh-keygen", [
        "-Y",
        "sign",
        "-f",
        trust.keyPath,
        "-n",
        PHYSICAL_SIGNATURE_NAMESPACE,
        input,
      ]);
      const expectedSha256 = sha256File(input);

      const result = importPhysicalDeviceEvidenceFile({
        cwd,
        inputPath: input,
        signaturePath: `${input}.sig`,
        expectedSha256,
        reviewedCandidateSha: trust.candidate,
        version: "0.2.0-beta.1",
        now: options.now,
      });

      expect(result).toMatchObject({ expectedSha256, ...bindings });
      expect(
        readFileSync(
          join(cwd, "output/release/physical-device-release-evidence.json"),
        ),
      ).toEqual(readFileSync(input));
      expect(
        readFileSync(
          join(cwd, "output/release/physical-device-release-evidence.json.sig"),
        ),
      ).toEqual(readFileSync(`${input}.sig`));
      expect(
        validatePhysicalDeviceEvidenceFiles({
          cwd,
          reviewedCandidateSha: trust.candidate,
          version: "0.2.0-beta.1",
          now: options.now,
          requireSignature: true,
        }).failures,
      ).toEqual([]);

      const attackerKey = join(cwd, "attacker-key");
      command(cwd, "ssh-keygen", [
        "-q",
        "-t",
        "ed25519",
        "-N",
        "",
        "-f",
        attackerKey,
      ]);
      const attackerInput = join(cwd, "attacker-evidence.json");
      writeFileSync(attackerInput, readFileSync(input), { mode: 0o600 });
      command(cwd, "ssh-keygen", [
        "-Y",
        "sign",
        "-f",
        attackerKey,
        "-n",
        PHYSICAL_SIGNATURE_NAMESPACE,
        attackerInput,
      ]);
      expect(() =>
        importPhysicalDeviceEvidenceFile({
          cwd,
          inputPath: attackerInput,
          signaturePath: `${attackerInput}.sig`,
          expectedSha256,
          reviewedCandidateSha: trust.candidate,
          version: "0.2.0-beta.1",
          now: options.now,
        }),
      ).toThrow("physical-device evidence SSH signature did not verify");

      writeFileSync(
        join(cwd, ".github/physical-device-allowed-signers"),
        `${readFileSync(
          join(cwd, ".github/physical-device-allowed-signers"),
          "utf8",
        )}# changed after candidate\n`,
      );
      expect(() =>
        importPhysicalDeviceEvidenceFile({
          cwd,
          inputPath: input,
          signaturePath: `${input}.sig`,
          expectedSha256,
          reviewedCandidateSha: trust.candidate,
          version: "0.2.0-beta.1",
          now: options.now,
        }),
      ).toThrow(
        "physical-device trust root must predate the reviewed candidate and remain unchanged",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("exports the exact public bindings needed by a physical tester", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cat5-device-bindings-"));
    try {
      mkdirSync(join(cwd, "dist"));
      mkdirSync(join(cwd, "output/release"), { recursive: true });
      writeFileSync(join(cwd, "dist/index.html"), "CAT5");
      writeFileSync(
        join(cwd, "output/release/chat-nocontrol-v0.2.0-beta.1.tgz"),
        "release archive",
      );

      const bindings = getPhysicalDeviceEvidenceBindings({
        cwd,
        reviewedCandidateSha: SHA_A,
        version: "0.2.0-beta.1",
      });
      expect(bindings.distSha256).toMatch(/^[0-9a-f]{64}$/u);
      expect(bindings).toEqual({
        reviewedCandidateSha: SHA_A,
        releaseTag: "v0.2.0-beta.1",
        version: "0.2.0-beta.1",
        distSha256: bindings.distSha256,
        archive: {
          file: "chat-nocontrol-v0.2.0-beta.1.tgz",
          sha256: sha256File(
            join(cwd, "output/release/chat-nocontrol-v0.2.0-beta.1.tgz"),
          ),
        },
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("rejects a wrong external digest without creating release evidence", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cat5-device-import-"));
    try {
      mkdirSync(join(cwd, "dist"));
      mkdirSync(join(cwd, "output/release"), { recursive: true });
      writeFileSync(join(cwd, "dist/index.html"), "CAT5");
      writeFileSync(
        join(cwd, "output/release/chat-nocontrol-v0.2.0-beta.1.tgz"),
        "release archive",
      );
      const input = join(cwd, "external-physical-evidence.json");
      writeFileSync(input, `${JSON.stringify(validEvidence())}\n`);

      expect(() =>
        importPhysicalDeviceEvidenceFile({
          cwd,
          inputPath: input,
          signaturePath: `${input}.sig`,
          expectedSha256: "d".repeat(64),
          reviewedCandidateSha: SHA_A,
          version: "0.2.0-beta.1",
          now: options.now,
        }),
      ).toThrow("digest does not match");
      expect(() =>
        readFileSync(
          join(cwd, "output/release/physical-device-release-evidence.json"),
        ),
      ).toThrow();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("validates a regular evidence file against the exact dist and archive bytes", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cat5-device-evidence-"));
    try {
      mkdirSync(join(cwd, "dist"));
      mkdirSync(join(cwd, "output/release"), { recursive: true });
      writeFileSync(join(cwd, "dist/index.html"), "CAT5");
      writeFileSync(
        join(cwd, "output/release/chat-nocontrol-v0.2.0-beta.1.tgz"),
        "release archive",
      );
      const record = validEvidence();
      const firstPass = validatePhysicalDeviceEvidenceFiles({
        cwd,
        record,
        reviewedCandidateSha: SHA_A,
        version: "0.2.0-beta.1",
        now: options.now,
      });
      record.distSha256 = firstPass.bindings.distSha256;
      if (record.archive)
        record.archive.sha256 = firstPass.bindings.archiveSha256;
      writeFileSync(
        join(cwd, "output/release/physical-device-release-evidence.json"),
        `${JSON.stringify(record)}\n`,
      );

      const result = validatePhysicalDeviceEvidenceFiles({
        cwd,
        reviewedCandidateSha: SHA_A,
        version: "0.2.0-beta.1",
        now: options.now,
      });
      expect(result.failures).toEqual([]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("fails closed for missing or symlinked physical evidence", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cat5-device-evidence-"));
    try {
      mkdirSync(join(cwd, "dist"));
      mkdirSync(join(cwd, "output/release"), { recursive: true });
      writeFileSync(join(cwd, "dist/index.html"), "CAT5");
      writeFileSync(
        join(cwd, "output/release/chat-nocontrol-v0.2.0-beta.1.tgz"),
        "release archive",
      );
      const missing = validatePhysicalDeviceEvidenceFiles({
        cwd,
        reviewedCandidateSha: SHA_A,
        version: "0.2.0-beta.1",
        now: options.now,
      });
      expect(missing.failures).toContain(
        "missing output/release/physical-device-release-evidence.json; desktop emulation is not physical-device evidence",
      );

      writeFileSync(join(cwd, "record.json"), "{}\n");
      symlinkSync(
        join(cwd, "record.json"),
        join(cwd, "output/release/physical-device-release-evidence.json"),
      );
      const symlinked = validatePhysicalDeviceEvidenceFiles({
        cwd,
        reviewedCandidateSha: SHA_A,
        version: "0.2.0-beta.1",
        now: options.now,
      });
      expect(symlinked.failures).toContain(
        "physical-device evidence must be a regular non-symlink file",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
