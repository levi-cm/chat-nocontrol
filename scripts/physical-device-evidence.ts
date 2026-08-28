import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

export type PhysicalCheckStatus = "PASS" | "FAIL" | "NOT RUN" | "NOT SUPPORTED";

export interface PhysicalDeviceCheck {
  id?: string;
  status?: PhysicalCheckStatus;
  supported?: boolean;
  notes?: string;
}

export interface PhysicalDeviceEnvironment {
  id?: string;
  platform?: string;
  mode?: string;
  browser?: string;
  deviceModel?: string;
  osVersion?: string;
  browserVersion?: string;
  completedAt?: string;
  checks?: PhysicalDeviceCheck[];
}

export interface PhysicalDeviceEvidence {
  schemaVersion?: number;
  status?: "PASS" | "FAIL" | "NOT RUN" | "PARTIAL";
  reviewedCandidateSha?: string;
  releaseTag?: string;
  version?: string;
  distSha256?: string;
  archive?: { file?: string; sha256?: string };
  completedAt?: string;
  operator?: { name?: string; signingIdentity?: string };
  environments?: PhysicalDeviceEnvironment[];
}

export interface PhysicalDeviceValidationOptions {
  reviewedCandidateSha: string;
  releaseTag: string;
  version: string;
  distSha256: string;
  archiveFile: string;
  archiveSha256: string;
  now?: number;
}

const REQUIRED_CHECK_IDS = [
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

const REQUIRED_ENVIRONMENTS = [
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

const forbiddenQrChecks = new Set([
  "v2-contact-qr-creation",
  "v2-message-qr-creation",
]);
const requiredChecks = new Set<string>(REQUIRED_CHECK_IDS);

const allowedEvidenceProperties = new Set([
  "schemaVersion",
  "status",
  "reviewedCandidateSha",
  "releaseTag",
  "version",
  "distSha256",
  "archive",
  "completedAt",
  "operator",
  "environments",
]);
const allowedArchiveProperties = new Set(["file", "sha256"]);
const allowedOperatorProperties = new Set(["name", "signingIdentity"]);
const allowedEnvironmentProperties = new Set([
  "id",
  "platform",
  "mode",
  "browser",
  "deviceModel",
  "osVersion",
  "browserVersion",
  "completedAt",
  "checks",
]);
const allowedCheckProperties = new Set(["id", "status", "supported", "notes"]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

function unknownPropertyFailures(
  value: unknown,
  allowed: ReadonlySet<string>,
  label: string,
): string[] {
  if (!isPlainRecord(value)) return [];
  return Object.keys(value)
    .filter((property) => !allowed.has(property))
    .sort()
    .map((property) => `${label} contains unknown property ${property}`);
}

function validateClosedEvidenceShape(value: unknown): string[] {
  if (!isPlainRecord(value)) {
    return ["physical evidence must be a JSON object"];
  }
  const failures = unknownPropertyFailures(
    value,
    allowedEvidenceProperties,
    "physical evidence",
  );
  failures.push(
    ...unknownPropertyFailures(
      value.archive,
      allowedArchiveProperties,
      "physical evidence archive",
    ),
    ...unknownPropertyFailures(
      value.operator,
      allowedOperatorProperties,
      "physical evidence operator",
    ),
  );
  if (value.environments !== undefined && !Array.isArray(value.environments)) {
    failures.push("physical evidence environments must be an array");
    return failures;
  }
  for (const [index, environment] of (Array.isArray(value.environments)
    ? value.environments
    : []
  ).entries()) {
    if (!isPlainRecord(environment)) {
      failures.push(`physical environment at index ${index} must be an object`);
      continue;
    }
    const id =
      typeof environment.id === "string" && environment.id.length > 0
        ? environment.id
        : `physical environment at index ${index}`;
    failures.push(
      ...unknownPropertyFailures(environment, allowedEnvironmentProperties, id),
    );
    if (
      environment.checks !== undefined &&
      !Array.isArray(environment.checks)
    ) {
      failures.push(`${id} checks must be an array`);
      continue;
    }
    for (const [checkIndex, check] of (Array.isArray(environment.checks)
      ? environment.checks
      : []
    ).entries()) {
      if (!isPlainRecord(check)) {
        failures.push(`${id} check at index ${checkIndex} must be an object`);
        continue;
      }
      failures.push(
        ...unknownPropertyFailures(
          check,
          allowedCheckProperties,
          `${id} check ${typeof check.id === "string" ? check.id : checkIndex}`,
        ),
      );
    }
  }
  return failures;
}

function isMissingOrPlaceholder(value: string | undefined): boolean {
  const normalized = typeof value === "string" ? value.trim() : "";
  return (
    normalized.length === 0 ||
    /[<>]|placeholder|todo|not run|unknown/iu.test(normalized)
  );
}

function isCanonicalPastUtc(value: string | undefined, now: number): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  const timestamp = Date.parse(value);
  return (
    !Number.isNaN(timestamp) &&
    new Date(timestamp).toISOString() === value &&
    timestamp <= now
  );
}

function validateEnvironment(
  environment: PhysicalDeviceEnvironment,
  expected: (typeof REQUIRED_ENVIRONMENTS)[number],
  now: number,
): string[] {
  const failures: string[] = [];
  const id = expected.id;

  for (const field of ["platform", "mode", "browser"] as const) {
    if (environment[field] !== expected[field]) {
      failures.push(`${id} ${field} must be ${expected[field]}`);
    }
  }
  if (
    isMissingOrPlaceholder(environment.deviceModel) ||
    /emulat|simulat|desktop/iu.test(environment.deviceModel ?? "")
  ) {
    failures.push(`${id} deviceModel must identify physical hardware`);
  }
  if (isMissingOrPlaceholder(environment.osVersion)) {
    failures.push(`${id} osVersion is missing or placeholder`);
  }
  if (isMissingOrPlaceholder(environment.browserVersion)) {
    failures.push(`${id} browserVersion is missing or placeholder`);
  }
  if (!isCanonicalPastUtc(environment.completedAt, now)) {
    failures.push(`${id} completion time must be ISO-8601 UTC and not future`);
  }

  const checks = (
    Array.isArray(environment.checks)
      ? environment.checks.filter((check) => isPlainRecord(check))
      : []
  ) as PhysicalDeviceCheck[];
  const counts = new Map<string, number>();
  for (const check of checks) {
    const checkId = check.id ?? "";
    counts.set(checkId, (counts.get(checkId) ?? 0) + 1);
  }
  if (checks.some((check) => forbiddenQrChecks.has(check.id ?? ""))) {
    failures.push(
      `${id} contains prohibited V2 contact/message QR creation evidence`,
    );
  }
  for (const check of checks) {
    const checkId = check.id ?? "";
    if (!requiredChecks.has(checkId) && !forbiddenQrChecks.has(checkId)) {
      failures.push(`${id} contains unknown check ${checkId || "<missing>"}`);
    }
    if ((counts.get(checkId) ?? 0) > 1) {
      failures.push(`${id} check ${checkId || "<missing>"} is duplicated`);
      counts.set(checkId, 1);
    }
  }

  for (const requiredId of REQUIRED_CHECK_IDS) {
    const check = checks.find((entry) => entry.id === requiredId);
    if (!check) {
      failures.push(`${id} check ${requiredId} is missing`);
      continue;
    }
    if (requiredId === "web-share" && check.status === "NOT SUPPORTED") {
      if (check.supported !== false) {
        failures.push(
          `${id} check web-share may be NOT SUPPORTED only when supported is false`,
        );
      }
    } else if (
      requiredId === "web-share" &&
      check.status === "PASS" &&
      check.supported === false
    ) {
      failures.push(
        `${id} check web-share cannot PASS when supported is false`,
      );
    } else if (check.status !== "PASS") {
      failures.push(`${id} check ${requiredId} is not PASS`);
    }
    if (isMissingOrPlaceholder(check.notes)) {
      failures.push(
        `${id} check ${requiredId} notes are missing or placeholder`,
      );
    }
  }

  return failures;
}

export function validatePhysicalDeviceEvidence(
  record: PhysicalDeviceEvidence,
  options: PhysicalDeviceValidationOptions,
): string[] {
  const unknownRecord: unknown = record;
  const failures = validateClosedEvidenceShape(unknownRecord);
  if (!isPlainRecord(unknownRecord)) return failures;
  const now = options.now ?? Date.now();

  if (record.schemaVersion !== 2) {
    failures.push("physical evidence schemaVersion must be 2");
  }
  if (record.status !== "PASS") {
    failures.push("physical evidence status must be PASS");
  }
  if (!/^[0-9a-f]{40}$/u.test(record.reviewedCandidateSha ?? "")) {
    failures.push(
      "physical evidence reviewed candidate must be a full lowercase commit SHA",
    );
  }
  if (!/^v\d+\.\d+\.\d+-beta\.\d+$/u.test(record.releaseTag ?? "")) {
    failures.push("physical evidence release tag is invalid");
  }
  if (!/^\d+\.\d+\.\d+-beta\.\d+$/u.test(record.version ?? "")) {
    failures.push("physical evidence release version is invalid");
  }
  if (!/^[0-9a-f]{64}$/u.test(record.distSha256 ?? "")) {
    failures.push("physical evidence dist SHA-256 is invalid");
  }
  if (
    !/^chat-nocontrol-v\d+\.\d+\.\d+-beta\.\d+\.tgz$/u.test(
      record.archive?.file ?? "",
    )
  ) {
    failures.push("physical evidence archive file is invalid");
  }
  if (!/^[0-9a-f]{64}$/u.test(record.archive?.sha256 ?? "")) {
    failures.push("physical evidence archive SHA-256 is invalid");
  }
  if (record.reviewedCandidateSha !== options.reviewedCandidateSha) {
    failures.push(
      "physical evidence reviewed candidate does not match the release candidate",
    );
  }
  if (record.releaseTag !== options.releaseTag) {
    failures.push(
      "physical evidence release tag does not match the release candidate",
    );
  }
  if (record.version !== options.version) {
    failures.push(
      "physical evidence release version does not match the release candidate",
    );
  }
  if (record.distSha256 !== options.distSha256) {
    failures.push(
      "physical evidence dist SHA-256 does not match the release candidate",
    );
  }
  if (record.archive?.file !== options.archiveFile) {
    failures.push(
      "physical evidence archive file does not match the release artifact",
    );
  }
  if (record.archive?.sha256 !== options.archiveSha256) {
    failures.push(
      "physical evidence archive SHA-256 does not match the release artifact",
    );
  }
  if (!isCanonicalPastUtc(record.completedAt, now)) {
    failures.push(
      "physical evidence completion time must be ISO-8601 UTC and not future",
    );
  }
  if (isMissingOrPlaceholder(record.operator?.name)) {
    failures.push("physical evidence operator name is missing or placeholder");
  }
  if (
    !/^[A-Za-z0-9._%+@-]{3,254}$/u.test(record.operator?.signingIdentity ?? "")
  ) {
    failures.push("physical evidence signing identity is invalid");
  }

  const environments = (
    Array.isArray(record.environments)
      ? record.environments.filter((environment) => isPlainRecord(environment))
      : []
  ) as PhysicalDeviceEnvironment[];
  for (const expected of REQUIRED_ENVIRONMENTS) {
    const matches = environments.filter(
      (environment) => environment.id === expected.id,
    );
    if (matches.length === 0) {
      failures.push(`physical environment ${expected.id} is missing`);
      continue;
    }
    if (matches.length > 1) {
      failures.push(`physical environment ${expected.id} is duplicated`);
    }
    failures.push(...validateEnvironment(matches[0]!, expected, now));
  }
  for (const environment of environments) {
    if (
      !REQUIRED_ENVIRONMENTS.some((expected) => expected.id === environment.id)
    ) {
      failures.push(
        `physical evidence contains unknown environment ${environment.id ?? "<missing>"}`,
      );
    }
  }

  return failures;
}

function regularFiles(root: string, directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Physical evidence digest rejects symlink: ${path}`);
    }
    if (entry.isDirectory()) {
      files.push(...regularFiles(root, path));
    } else if (entry.isFile()) {
      files.push(relative(root, path).split(sep).join("/"));
    } else {
      throw new Error(`Physical evidence digest rejects non-file: ${path}`);
    }
  }
  return files;
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function sha256Directory(directory: string): string {
  const hash = createHash("sha256");
  for (const path of regularFiles(directory, directory).sort()) {
    const content = readFileSync(join(directory, path));
    hash.update(path, "utf8");
    hash.update("\0", "utf8");
    hash.update(String(content.byteLength), "utf8");
    hash.update("\0", "utf8");
    hash.update(content);
  }
  return hash.digest("hex");
}

interface PhysicalDeviceEvidenceFileOptions {
  cwd?: string;
  reviewedCandidateSha: string;
  version: string;
  now?: number;
  record?: PhysicalDeviceEvidence;
  requireSignature?: boolean;
}

export interface PhysicalDeviceEvidenceFileResult {
  failures: string[];
  bindings: {
    distSha256: string;
    archiveSha256: string;
  };
}

const physicalEvidencePath =
  "output/release/physical-device-release-evidence.json";
const physicalEvidenceSignaturePath = `${physicalEvidencePath}.sig`;
const physicalSignatureNamespace = "chat-nocontrol-physical-device-cat5-v2";
const physicalAllowedSignersPath = ".github/physical-device-allowed-signers";
const releaseAllowedSignersPath = ".github/allowed_signers";
const maximumEvidenceBytes = 1024 * 1024;
const maximumSignatureBytes = 64 * 1024;

function isRegularNonSymlink(path: string): boolean {
  if (!existsSync(path)) return false;
  const status = lstatSync(path);
  return status.isFile() && !status.isSymbolicLink();
}

interface PhysicalSignerEntry {
  principal: string;
  key: string;
}

function gitResult(cwd: string, args: string[]) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function parsePhysicalAllowedSigners(contents: string): {
  entries: PhysicalSignerEntry[];
  invalid: boolean;
} {
  const entries: PhysicalSignerEntry[] = [];
  let invalid = false;
  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const match =
      /^(\S+)\s+namespaces="([^"]+)"\s+((?:ssh-|ecdsa-|sk-)\S*)\s+(\S+)(?:\s+.*)?$/u.exec(
        line,
      );
    if (
      !match ||
      match[2] !== physicalSignatureNamespace ||
      /[,!*?\[\]]/u.test(match[1] ?? "")
    ) {
      invalid = true;
      continue;
    }
    entries.push({
      principal: match[1]!,
      key: `${match[3]} ${match[4]}`,
    });
  }
  return { entries, invalid };
}

function trustedPhysicalSignerFailures(
  cwd: string,
  reviewedCandidateSha: string,
  signingIdentity: string,
): { failures: string[]; allowedSigners: Buffer | null } {
  const failures: string[] = [];
  const fullPath = join(cwd, physicalAllowedSignersPath);
  if (!isRegularNonSymlink(fullPath)) {
    failures.push(
      "physical-device trust root must be a regular non-symlink file",
    );
    return { failures, allowedSigners: null };
  }
  const parentRoot = gitResult(cwd, [
    "rev-parse",
    `${reviewedCandidateSha}^:${physicalAllowedSignersPath}`,
  ]);
  const candidateRoot = gitResult(cwd, [
    "rev-parse",
    `${reviewedCandidateSha}:${physicalAllowedSignersPath}`,
  ]);
  const workingRoot = gitResult(cwd, [
    "hash-object",
    "--",
    physicalAllowedSignersPath,
  ]);
  const stagedRoot = gitResult(cwd, [
    "diff",
    "--cached",
    "--quiet",
    reviewedCandidateSha,
    "--",
    physicalAllowedSignersPath,
  ]);
  if (
    parentRoot.status !== 0 ||
    candidateRoot.status !== 0 ||
    workingRoot.status !== 0 ||
    stagedRoot.status !== 0 ||
    parentRoot.stdout.trim() !== candidateRoot.stdout.trim() ||
    parentRoot.stdout.trim() !== workingRoot.stdout.trim()
  ) {
    failures.push(
      "physical-device trust root must predate the reviewed candidate and remain unchanged",
    );
    return { failures, allowedSigners: null };
  }

  const allowedSigners = readFileSync(fullPath);
  const parsed = parsePhysicalAllowedSigners(allowedSigners.toString("utf8"));
  const matching = parsed.entries.filter(
    (entry) => entry.principal === signingIdentity,
  );
  if (parsed.invalid || matching.length !== 1) {
    failures.push(
      "physical-device signer must have exactly one dedicated trusted principal",
    );
  }

  try {
    const releaseRoles = readFileSync(
      join(cwd, releaseAllowedSignersPath),
      "utf8",
    );
    if (
      matching.some((entry) =>
        releaseRoles
          .split(/\r?\n/u)
          .some(
            (line) =>
              line.trim().startsWith(`${entry.principal} `) ||
              line.includes(entry.key),
          ),
      )
    ) {
      failures.push(
        "physical-device and release/review signing roles must use different keys and principals",
      );
    }
  } catch {
    failures.push("release/review signer trust root is missing");
  }
  return { failures, allowedSigners };
}

function verifyPhysicalEvidenceSignature(
  cwd: string,
  evidence: Buffer,
  signature: Buffer,
  record: PhysicalDeviceEvidence,
  reviewedCandidateSha: string,
): string[] {
  const signingIdentity = record.operator?.signingIdentity ?? "";
  const trust = trustedPhysicalSignerFailures(
    cwd,
    reviewedCandidateSha,
    signingIdentity,
  );
  if (trust.failures.length > 0 || !trust.allowedSigners) {
    return trust.failures;
  }
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "cat5-physical-signature-"),
  );
  try {
    const signaturePath = join(temporaryDirectory, "evidence.sig");
    const allowedSignersPath = join(temporaryDirectory, "allowed_signers");
    writeFileSync(signaturePath, signature, { mode: 0o600 });
    writeFileSync(allowedSignersPath, trust.allowedSigners, { mode: 0o600 });
    const verification = spawnSync(
      "ssh-keygen",
      [
        "-Y",
        "verify",
        "-f",
        allowedSignersPath,
        "-I",
        signingIdentity,
        "-n",
        physicalSignatureNamespace,
        "-s",
        signaturePath,
      ],
      { input: evidence },
    );
    return verification.status === 0
      ? []
      : ["physical-device evidence SSH signature did not verify"];
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

export interface PhysicalDeviceEvidenceBindings {
  reviewedCandidateSha: string;
  releaseTag: string;
  version: string;
  distSha256: string;
  archive: { file: string; sha256: string };
}

export function getPhysicalDeviceEvidenceBindings(options: {
  cwd?: string;
  reviewedCandidateSha: string;
  version: string;
}): PhysicalDeviceEvidenceBindings {
  if (!/^[0-9a-f]{40}$/u.test(options.reviewedCandidateSha)) {
    throw new Error("reviewed candidate must be a full lowercase commit SHA");
  }
  if (!/^\d+\.\d+\.\d+-beta\.\d+$/u.test(options.version)) {
    throw new Error("physical-device evidence release version is invalid");
  }
  const cwd = options.cwd ?? process.cwd();
  const distPath = join(cwd, "dist");
  if (!existsSync(distPath) || !lstatSync(distPath).isDirectory()) {
    throw new Error("missing dist directory for physical-device evidence");
  }
  const archiveFile = `chat-nocontrol-v${options.version}.tgz`;
  const archivePath = join(cwd, "output/release", archiveFile);
  if (!isRegularNonSymlink(archivePath)) {
    throw new Error(
      `missing regular non-symlink release archive ${archiveFile}`,
    );
  }
  return {
    reviewedCandidateSha: options.reviewedCandidateSha,
    releaseTag: `v${options.version}`,
    version: options.version,
    distSha256: sha256Directory(distPath),
    archive: { file: archiveFile, sha256: sha256File(archivePath) },
  };
}

export function validatePhysicalDeviceEvidenceFiles(
  options: PhysicalDeviceEvidenceFileOptions,
): PhysicalDeviceEvidenceFileResult {
  const cwd = options.cwd ?? process.cwd();
  const failures: string[] = [];
  const distPath = join(cwd, "dist");
  const archiveFile = `chat-nocontrol-v${options.version}.tgz`;
  const archivePath = join(cwd, "output/release", archiveFile);
  const evidencePath = join(cwd, physicalEvidencePath);

  let distSha256 = "";
  let archiveSha256 = "";
  if (!existsSync(distPath) || !lstatSync(distPath).isDirectory()) {
    failures.push(
      "missing dist directory for physical-device evidence binding",
    );
  } else {
    try {
      distSha256 = sha256Directory(distPath);
    } catch (error) {
      failures.push(
        `could not hash dist for physical-device evidence: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (!isRegularNonSymlink(archivePath)) {
    failures.push(
      `missing regular non-symlink release archive output/release/${archiveFile}`,
    );
  } else {
    archiveSha256 = sha256File(archivePath);
  }

  let record = options.record;
  if (!record) {
    if (!existsSync(evidencePath)) {
      failures.push(
        `missing ${physicalEvidencePath}; desktop emulation is not physical-device evidence`,
      );
    } else if (!isRegularNonSymlink(evidencePath)) {
      failures.push(
        "physical-device evidence must be a regular non-symlink file",
      );
    } else if ((lstatSync(evidencePath).mode & 0o111) !== 0) {
      failures.push("physical-device evidence must be non-executable");
    } else {
      try {
        record = JSON.parse(
          readFileSync(evidencePath, "utf8"),
        ) as PhysicalDeviceEvidence;
      } catch {
        failures.push("physical-device evidence is not valid JSON");
      }
    }
  }

  if (record && distSha256 && archiveSha256) {
    failures.push(
      ...validatePhysicalDeviceEvidence(record, {
        reviewedCandidateSha: options.reviewedCandidateSha,
        releaseTag: `v${options.version}`,
        version: options.version,
        distSha256,
        archiveFile,
        archiveSha256,
        now: options.now,
      }),
    );
  }
  if (options.requireSignature === true && record) {
    const signaturePath = join(cwd, physicalEvidenceSignaturePath);
    if (!isRegularNonSymlink(signaturePath)) {
      failures.push(
        "physical-device evidence signature must be a regular non-symlink file",
      );
    } else if ((lstatSync(signaturePath).mode & 0o111) !== 0) {
      failures.push(
        "physical-device evidence signature must be non-executable",
      );
    } else if (!isRegularNonSymlink(evidencePath)) {
      failures.push(
        "physical-device signed evidence must be a regular non-symlink file",
      );
    } else {
      const evidence = readFileSync(evidencePath);
      const signature = readFileSync(signaturePath);
      if (
        signature.byteLength === 0 ||
        signature.byteLength > maximumSignatureBytes
      ) {
        failures.push("physical-device evidence signature size is invalid");
      } else {
        failures.push(
          ...verifyPhysicalEvidenceSignature(
            cwd,
            evidence,
            signature,
            record,
            options.reviewedCandidateSha,
          ),
        );
      }
    }
  }

  return { failures, bindings: { distSha256, archiveSha256 } };
}

export interface ImportPhysicalDeviceEvidenceOptions extends Omit<
  PhysicalDeviceEvidenceFileOptions,
  "record"
> {
  inputPath: string;
  signaturePath: string;
  expectedSha256: string;
}

export interface ImportPhysicalDeviceEvidenceResult {
  expectedSha256: string;
  distSha256: string;
  archiveSha256: string;
  destination: string;
  signatureDestination: string;
}

function readExternalFile(
  path: string,
  label: string,
  maximumBytes: number,
): Buffer {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const status = fstatSync(descriptor);
    if (!status.isFile()) {
      throw new Error(`${label} must be a regular file`);
    }
    if ((status.mode & 0o111) !== 0) {
      throw new Error(`${label} must be non-executable`);
    }
    if (status.size <= 0 || status.size > maximumBytes) {
      throw new Error(`${label} must be 1-${maximumBytes} bytes`);
    }
    return readFileSync(descriptor);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ELOOP") {
      throw new Error(`${label} must not be a symlink`);
    }
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function atomicWrite(path: string, content: Buffer): void {
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      temporaryPath,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporaryPath, path);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}

export function importPhysicalDeviceEvidenceFile(
  options: ImportPhysicalDeviceEvidenceOptions,
): ImportPhysicalDeviceEvidenceResult {
  if (!/^[0-9a-f]{64}$/u.test(options.expectedSha256)) {
    throw new Error("expected physical-device evidence SHA-256 is invalid");
  }
  const cwd = options.cwd ?? process.cwd();
  const input = readExternalFile(
    options.inputPath,
    "physical-device evidence input",
    maximumEvidenceBytes,
  );
  const actualSha256 = createHash("sha256").update(input).digest("hex");
  if (
    !timingSafeEqual(
      Buffer.from(actualSha256, "hex"),
      Buffer.from(options.expectedSha256, "hex"),
    )
  ) {
    throw new Error("physical-device evidence digest does not match input");
  }

  let record: PhysicalDeviceEvidence;
  try {
    record = JSON.parse(input.toString("utf8")) as PhysicalDeviceEvidence;
  } catch {
    throw new Error("physical-device evidence input is not valid JSON");
  }
  const validation = validatePhysicalDeviceEvidenceFiles({
    cwd,
    record,
    reviewedCandidateSha: options.reviewedCandidateSha,
    version: options.version,
    now: options.now,
  });
  if (validation.failures.length > 0) {
    throw new Error(
      `physical-device evidence import blocked:\n- ${validation.failures.join("\n- ")}`,
    );
  }
  const signature = readExternalFile(
    options.signaturePath,
    "physical-device evidence signature input",
    maximumSignatureBytes,
  );
  const signatureFailures = verifyPhysicalEvidenceSignature(
    cwd,
    input,
    signature,
    record,
    options.reviewedCandidateSha,
  );
  if (signatureFailures.length > 0) {
    throw new Error(
      `physical-device evidence import blocked:\n- ${signatureFailures.join("\n- ")}`,
    );
  }

  const destination = join(cwd, physicalEvidencePath);
  const signatureDestination = join(cwd, physicalEvidenceSignaturePath);
  mkdirSync(join(cwd, "output/release"), { recursive: true, mode: 0o700 });
  atomicWrite(signatureDestination, signature);
  atomicWrite(destination, input);

  const stored = validatePhysicalDeviceEvidenceFiles({
    cwd,
    reviewedCandidateSha: options.reviewedCandidateSha,
    version: options.version,
    now: options.now,
    requireSignature: true,
  });
  if (
    stored.failures.length > 0 ||
    sha256File(destination) !== options.expectedSha256
  ) {
    throw new Error("stored physical-device evidence failed revalidation");
  }

  return {
    expectedSha256: options.expectedSha256,
    distSha256: stored.bindings.distSha256,
    archiveSha256: stored.bindings.archiveSha256,
    destination: physicalEvidencePath,
    signatureDestination: physicalEvidenceSignaturePath,
  };
}
