import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";

import {
  type OwnerAttestation,
  validateOwnerAttestation,
} from "./owner-attestation";

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
  operator?: { name?: string };
  environments?: PhysicalDeviceEnvironment[];
  ownerAttestation?: OwnerAttestation;
}

export interface PhysicalDeviceValidationOptions {
  cwd?: string;
  ownerActor?: string;
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
  "ownerAttestation",
]);
const allowedArchiveProperties = new Set(["file", "sha256"]);
const allowedOperatorProperties = new Set(["name"]);
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
    if (check.supported !== undefined && typeof check.supported !== "boolean") {
      failures.push(
        `${id} check ${String(checkId) || "<missing>"} supported must be boolean when present`,
      );
    }
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

  if (record.schemaVersion !== 3) {
    failures.push("physical evidence schemaVersion must be 3");
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
  const completionTimes = [
    record.completedAt,
    ...(Array.isArray(record.environments)
      ? record.environments.map((environment) => environment.completedAt)
      : []),
  ]
    .map((value) => (typeof value === "string" ? Date.parse(value) : NaN))
    .filter((value) => !Number.isNaN(value));
  const latestCompletion =
    completionTimes.length > 0
      ? new Date(Math.max(...completionTimes)).toISOString()
      : record.completedAt;
  failures.push(
    ...validateOwnerAttestation(record.ownerAttestation, {
      cwd: options.cwd ?? process.cwd(),
      completedAt: latestCompletion,
      expectedStatement:
        "I attest that the listed checks were performed on the identified physical devices against the exact release bytes and that the recorded results are accurate.",
      now,
      ownerActor: options.ownerActor,
    }),
  );

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
  ownerActor?: string;
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
const maximumEvidenceBytes = 1024 * 1024;

function isRegularNonSymlink(path: string): boolean {
  if (!existsSync(path)) return false;
  const status = lstatSync(path);
  return status.isFile() && !status.isSymbolicLink();
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
        cwd,
        reviewedCandidateSha: options.reviewedCandidateSha,
        releaseTag: `v${options.version}`,
        version: options.version,
        distSha256,
        archiveFile,
        archiveSha256,
        now: options.now,
        ownerActor: options.ownerActor,
      }),
    );
  }
  return { failures, bindings: { distSha256, archiveSha256 } };
}

export interface ImportPhysicalDeviceEvidenceOptions extends Omit<
  PhysicalDeviceEvidenceFileOptions,
  "record"
> {
  inputPath: string;
  expectedSha256: string;
  ownerActor: string;
}

export interface ImportPhysicalDeviceEvidenceResult {
  expectedSha256: string;
  distSha256: string;
  archiveSha256: string;
  destination: string;
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
    ownerActor: options.ownerActor,
  });
  if (validation.failures.length > 0) {
    throw new Error(
      `physical-device evidence import blocked:\n- ${validation.failures.join("\n- ")}`,
    );
  }
  const destination = join(cwd, physicalEvidencePath);
  mkdirSync(join(cwd, "output/release"), { recursive: true, mode: 0o700 });
  const legacySignature = join(cwd, physicalEvidenceSignaturePath);
  if (existsSync(legacySignature)) {
    if (!isRegularNonSymlink(legacySignature)) {
      throw new Error(
        "legacy physical-device signature path must be a regular non-symlink file",
      );
    }
    unlinkSync(legacySignature);
  }
  atomicWrite(destination, input);

  const stored = validatePhysicalDeviceEvidenceFiles({
    cwd,
    reviewedCandidateSha: options.reviewedCandidateSha,
    version: options.version,
    now: options.now,
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
  };
}
