// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getPhysicalDeviceEvidenceBindings,
  importPhysicalDeviceEvidenceFile,
  type PhysicalDeviceEvidence,
  sha256File,
  validatePhysicalDeviceEvidence,
  validatePhysicalDeviceEvidenceFiles,
} from "../../../scripts/physical-device-evidence";

const SHA_A = "a".repeat(40),
  SHA_B = "b".repeat(64),
  SHA_C = "c".repeat(64);
const COMPLETED_AT = "2026-08-08T01:00:00.000Z";
const PRINCIPAL = "136596632+levi-cm@users.noreply.github.com";
const OWNER_STATEMENT =
  "I attest that the listed checks were performed on the identified physical devices against the exact release bytes and that the recorded results are accurate.";
const CHECKS = [
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
  { id: "iphone-safari", platform: "ios", mode: "browser", browser: "Safari" },
  {
    id: "iphone-home-screen",
    platform: "ios",
    mode: "home-screen",
    browser: "Safari",
  },
] as const;

function evidence(): PhysicalDeviceEvidence {
  return {
    schemaVersion: 3,
    status: "PASS",
    reviewedCandidateSha: SHA_A,
    releaseTag: "v0.2.0-beta.1",
    version: "0.2.0-beta.1",
    distSha256: SHA_B,
    archive: { file: "chat-nocontrol-v0.2.0-beta.1.tgz", sha256: SHA_C },
    completedAt: COMPLETED_AT,
    operator: { name: "Physical release tester" },
    environments: profiles.map((profile) => ({
      ...profile,
      deviceModel: `${profile.id} physical hardware`,
      osVersion: "physical-os-1",
      browserVersion: "physical-browser-1",
      completedAt: COMPLETED_AT,
      checks: CHECKS.map((id) => ({
        id,
        status: "PASS" as const,
        notes: `${id} passed on the physical device`,
      })),
    })),
    ownerAttestation: {
      githubActor: "levi-cm",
      releaseSignerPrincipal: PRINCIPAL,
      statement: OWNER_STATEMENT,
      attestedAt: "2026-08-08T01:30:00.000Z",
    },
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

function buildRoot(): string {
  const cwd = mkdtempSync(join(tmpdir(), "cat5-device-evidence-"));
  mkdirSync(join(cwd, ".github"), { recursive: true });
  mkdirSync(join(cwd, "dist"), { recursive: true });
  mkdirSync(join(cwd, "output/release"), { recursive: true });
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify({
      repository: { url: "https://github.com/levi-cm/chat-nocontrol.git" },
    }),
  );
  writeFileSync(
    join(cwd, ".github/allowed_signers"),
    `${PRINCIPAL} namespaces="git" ssh-ed25519 AAAATEST\n`,
  );
  writeFileSync(join(cwd, "dist/index.html"), "CAT5");
  writeFileSync(
    join(cwd, "output/release/chat-nocontrol-v0.2.0-beta.1.tgz"),
    "release archive",
  );
  return cwd;
}

function boundEvidence(cwd: string): PhysicalDeviceEvidence {
  const record = evidence();
  const bindings = getPhysicalDeviceEvidenceBindings({
    cwd,
    reviewedCandidateSha: SHA_A,
    version: "0.2.0-beta.1",
  });
  record.distSha256 = bindings.distSha256;
  if (record.archive) record.archive.sha256 = bindings.archive.sha256;
  return record;
}

describe("physical device owner-attested release evidence", () => {
  it("accepts four physical profiles with all fifteen checks", () => {
    expect(validatePhysicalDeviceEvidence(evidence(), options)).toEqual([]);
  });

  it.each([
    ["reviewedCandidateSha", "d".repeat(40), "reviewed candidate"],
    ["releaseTag", "v0.2.0-beta.2", "release tag"],
    ["version", "0.2.0-beta.2", "release version"],
    ["distSha256", "d".repeat(64), "dist SHA-256"],
  ])("rejects wrong %s binding", (field, value, label) => {
    const record = evidence();
    Object.assign(record, { [field]: value });
    expect(validatePhysicalDeviceEvidence(record, options)).toContain(
      `physical evidence ${label} does not match the release candidate`,
    );
  });

  it("rejects missing, failed, duplicate, and invented checks", () => {
    const record = evidence();
    const checks = record.environments![0]!.checks!;
    checks.shift();
    checks[0]!.status = "FAIL";
    checks.push({ id: "invented", status: "PASS", notes: "no" });
    checks.push({ ...checks[1]! });
    const failures = validatePhysicalDeviceEvidence(record, options);
    expect(failures.some((failure) => failure.includes("is missing"))).toBe(
      true,
    );
    expect(failures.some((failure) => failure.includes("is not PASS"))).toBe(
      true,
    );
    expect(
      failures.some((failure) => failure.includes("unknown check invented")),
    ).toBe(true);
    expect(failures.some((failure) => failure.includes("is duplicated"))).toBe(
      true,
    );
  });

  it("permits only truthful Web Share NOT SUPPORTED", () => {
    const record = evidence();
    const check = record.environments![0]!.checks!.find(
      (item) => item.id === "web-share",
    )!;
    check.status = "NOT SUPPORTED";
    check.supported = false;
    expect(validatePhysicalDeviceEvidence(record, options)).toEqual([]);
    check.supported = true;
    expect(validatePhysicalDeviceEvidence(record, options)).toContain(
      "android-chrome check web-share may be NOT SUPPORTED only when supported is false",
    );
  });

  it("rejects emulated hardware and unknown fields", () => {
    const record = evidence() as PhysicalDeviceEvidence & { unknown?: boolean };
    record.unknown = true;
    record.environments![0]!.deviceModel = "Android emulator";
    const failures = validatePhysicalDeviceEvidence(record, options);
    expect(failures).toContain(
      "physical evidence contains unknown property unknown",
    );
    expect(failures).toContain(
      "android-chrome deviceModel must identify physical hardware",
    );
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
    ["statement", "wrong", "owner attestation statement is invalid"],
    [
      "attestedAt",
      "2026-08-08T00:00:00.000Z",
      "owner attestation cannot predate completed work",
    ],
    [
      "attestedAt",
      "2026-08-08T03:00:00.000Z",
      "owner attestation time must be canonical ISO-8601 UTC and not future",
    ],
  ])("rejects invalid owner attestation %s", (field, value, failure) => {
    const record = evidence();
    Object.assign(record.ownerAttestation!, { [field]: value });
    expect(validatePhysicalDeviceEvidence(record, options)).toContain(failure);
  });

  it("rejects owner attestation before a device profile completed", () => {
    const record = evidence();
    record.environments![0]!.completedAt = "2026-08-08T01:45:00.000Z";
    expect(validatePhysicalDeviceEvidence(record, options)).toContain(
      "owner attestation cannot predate completed work",
    );
  });

  it("publishes a closed version-3 JSON schema", () => {
    const schema = JSON.parse(
      readFileSync("docs/physical-device-release-evidence.schema.json", "utf8"),
    ) as {
      additionalProperties?: boolean;
      required?: string[];
      properties: {
        schemaVersion: { const?: number };
        operator: { required?: string[] };
        environments: { minItems?: number; maxItems?: number };
      };
    };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.schemaVersion.const).toBe(3);
    expect(schema.properties.operator.required).toEqual(["name"]);
    expect(schema.required).toContain("ownerAttestation");
    expect(schema.properties.environments).toMatchObject({
      minItems: 4,
      maxItems: 4,
    });
  });

  it("imports exact-digest evidence without SSH and removes the legacy signature", () => {
    const cwd = buildRoot();
    try {
      const record = boundEvidence(cwd),
        input = join(cwd, "external-evidence.json");
      writeFileSync(input, `${JSON.stringify(record)}\n`, { mode: 0o600 });
      const legacy = join(
        cwd,
        "output/release/physical-device-release-evidence.json.sig",
      );
      writeFileSync(legacy, "legacy detached signature");
      const expectedSha256 = sha256File(input);
      const result = importPhysicalDeviceEvidenceFile({
        cwd,
        inputPath: input,
        expectedSha256,
        ownerActor: "levi-cm",
        reviewedCandidateSha: SHA_A,
        version: "0.2.0-beta.1",
        now: options.now,
      });
      expect(result.expectedSha256).toBe(expectedSha256);
      expect(readFileSync(join(cwd, result.destination))).toEqual(
        readFileSync(input),
      );
      expect(existsSync(legacy)).toBe(false);
      expect(JSON.stringify(result)).not.toContain("signature");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("rejects a non-owner importer", () => {
    const cwd = buildRoot();
    try {
      const input = join(cwd, "external-evidence.json");
      writeFileSync(input, `${JSON.stringify(boundEvidence(cwd))}\n`);
      expect(() =>
        importPhysicalDeviceEvidenceFile({
          cwd,
          inputPath: input,
          expectedSha256: sha256File(input),
          ownerActor: "attacker",
          reviewedCandidateSha: SHA_A,
          version: "0.2.0-beta.1",
          now: options.now,
        }),
      ).toThrow("authenticated workflow actor must equal repository owner");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("rejects symlink input without writing evidence", () => {
    const cwd = buildRoot();
    try {
      const target = join(cwd, "target.json"),
        input = join(cwd, "input.json");
      writeFileSync(target, `${JSON.stringify(boundEvidence(cwd))}\n`);
      symlinkSync(target, input);
      expect(() =>
        importPhysicalDeviceEvidenceFile({
          cwd,
          inputPath: input,
          expectedSha256: sha256File(target),
          ownerActor: "levi-cm",
          reviewedCandidateSha: SHA_A,
          version: "0.2.0-beta.1",
        }),
      ).toThrow("must not be a symlink");
      expect(
        existsSync(
          join(cwd, "output/release/physical-device-release-evidence.json"),
        ),
      ).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("validates stored evidence against exact dist and archive bytes", () => {
    const cwd = buildRoot();
    try {
      writeFileSync(
        join(cwd, "output/release/physical-device-release-evidence.json"),
        `${JSON.stringify(boundEvidence(cwd))}\n`,
      );
      expect(
        validatePhysicalDeviceEvidenceFiles({
          cwd,
          reviewedCandidateSha: SHA_A,
          version: "0.2.0-beta.1",
          now: options.now,
        }).failures,
      ).toEqual([]);
      writeFileSync(join(cwd, "dist/index.html"), "changed");
      expect(
        validatePhysicalDeviceEvidenceFiles({
          cwd,
          reviewedCandidateSha: SHA_A,
          version: "0.2.0-beta.1",
          now: options.now,
        }).failures,
      ).toContain(
        "physical evidence dist SHA-256 does not match the release candidate",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
