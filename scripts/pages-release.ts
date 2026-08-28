import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const BINDING_SCHEMA = "chat-nocontrol-pages-artifact-binding/v1";
const ARTIFACT_NAME = "github-pages";
const ARTIFACT_FILE = "artifact.tar";
const MAX_DIST_FILES = 10_000;
const MAX_DIST_BYTES = 512 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 24 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/u;
const ARTIFACT_DIGEST = /^sha256:[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const ARTIFACT_ID = /^[1-9][0-9]*$/u;
const BETA_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+-beta\.[0-9]+$/u;

interface DistEntry {
  path: string;
  sha256: string;
  size: number;
}

export interface PagesArtifactBinding {
  schema: typeof BINDING_SCHEMA;
  artifactName: typeof ARTIFACT_NAME;
  artifactFile: typeof ARTIFACT_FILE;
  artifactId: string;
  artifactDigest: string;
  artifactTarSha256: string;
  distTreeSha256: string;
  distFileCount: number;
  distBytes: number;
  commit: string;
  tag: string;
  version: string;
}

interface BindingInput {
  distDirectory: string;
  artifactTar: string;
  artifactId: string;
  artifactDigest: string;
  commit: string;
  tag: string;
  version: string;
}

interface BindingVerificationInput {
  artifactTar: string;
  binding: PagesArtifactBinding;
  expectedArtifactId: string;
  expectedArtifactDigest: string;
  expectedCommit: string;
  expectedTag: string;
}

interface ArtifactMetadataExpectation {
  artifactId: string;
  artifactDigest: string;
  commit: string;
  runId: string;
}

interface LiveAcceptanceOptions {
  deploymentUrl: string;
  version: string;
  attempts: number;
  intervalMs: number;
  requestTimeoutMs: number;
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface LiveAcceptanceResult {
  attempt: number;
  deploymentUrl: string;
  modulePath: string;
  version: string;
}

function requireMatch(value: string, pattern: RegExp, label: string): void {
  if (!pattern.test(value)) throw new Error(`${label} is invalid`);
}

function validateReleaseIdentity(input: {
  artifactId: string;
  artifactDigest: string;
  commit: string;
  tag: string;
  version: string;
}): void {
  requireMatch(input.artifactId, ARTIFACT_ID, "Pages artifact ID");
  requireMatch(input.artifactDigest, ARTIFACT_DIGEST, "Pages artifact digest");
  requireMatch(input.commit, COMMIT, "release commit");
  requireMatch(input.version, BETA_VERSION, "release version");
  if (input.tag !== `v${input.version}`) {
    throw new Error("release tag does not match version");
  }
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256File(path: string): string {
  const size = statSync(path).size;
  if (size > MAX_DIST_BYTES) throw new Error("Pages artifact exceeds size cap");
  return sha256(readFileSync(path));
}

function walkDist(directory: string): DistEntry[] {
  const root = resolve(directory);
  const entries: DistEntry[] = [];
  const pending = [root];
  let totalBytes = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    for (const name of readdirSync(current).sort().reverse()) {
      const path = join(current, name);
      const metadata = lstatSync(path);
      if (metadata.isSymbolicLink()) {
        throw new Error("Pages dist must not contain symbolic links");
      }
      if (metadata.isDirectory()) {
        pending.push(path);
        continue;
      }
      if (!metadata.isFile()) {
        throw new Error("Pages dist contains a non-file entry");
      }
      const normalizedPath = relative(root, path).split(sep).join("/");
      if (
        normalizedPath.length === 0 ||
        normalizedPath.includes("\0") ||
        normalizedPath.split("/").some((part) => part === "..")
      ) {
        throw new Error("Pages dist contains an unsafe path");
      }
      totalBytes += metadata.size;
      if (totalBytes > MAX_DIST_BYTES) {
        throw new Error("Pages dist exceeds size cap");
      }
      entries.push({
        path: normalizedPath,
        sha256: sha256(readFileSync(path)),
        size: metadata.size,
      });
      if (entries.length > MAX_DIST_FILES) {
        throw new Error("Pages dist exceeds file-count cap");
      }
    }
  }
  entries.sort((left, right) => left.path.localeCompare(right.path, "en"));
  const paths = new Set(entries.map((entry) => entry.path));
  if (!paths.has("index.html") || !paths.has("manifest.webmanifest")) {
    throw new Error("Pages dist is missing its required shell files");
  }
  if (![...paths].some((path) => /^assets\/.+\.js$/u.test(path))) {
    throw new Error("Pages dist is missing its module bundle");
  }
  return entries;
}

function treeEvidence(directory: string): {
  bytes: number;
  count: number;
  sha256: string;
} {
  const entries = walkDist(directory);
  return {
    bytes: entries.reduce((sum, entry) => sum + entry.size, 0),
    count: entries.length,
    sha256: sha256(`${JSON.stringify(entries)}\n`),
  };
}

export function createPagesArtifactBinding(
  input: BindingInput,
): PagesArtifactBinding {
  validateReleaseIdentity(input);
  if (basename(input.artifactTar) !== ARTIFACT_FILE) {
    throw new Error(`Pages payload must be named ${ARTIFACT_FILE}`);
  }
  const tree = treeEvidence(input.distDirectory);
  return {
    schema: BINDING_SCHEMA,
    artifactName: ARTIFACT_NAME,
    artifactFile: ARTIFACT_FILE,
    artifactId: input.artifactId,
    artifactDigest: input.artifactDigest,
    artifactTarSha256: sha256File(input.artifactTar),
    distTreeSha256: tree.sha256,
    distFileCount: tree.count,
    distBytes: tree.bytes,
    commit: input.commit,
    tag: input.tag,
    version: input.version,
  };
}

function assertBindingShape(binding: PagesArtifactBinding): void {
  if (
    binding.schema !== BINDING_SCHEMA ||
    binding.artifactName !== ARTIFACT_NAME ||
    binding.artifactFile !== ARTIFACT_FILE
  ) {
    throw new Error("Pages artifact binding identity is invalid");
  }
  validateReleaseIdentity(binding);
  requireMatch(binding.artifactTarSha256, SHA256, "Pages artifact tar digest");
  requireMatch(binding.distTreeSha256, SHA256, "Pages dist tree digest");
  if (
    !Number.isSafeInteger(binding.distFileCount) ||
    binding.distFileCount < 1 ||
    binding.distFileCount > MAX_DIST_FILES ||
    !Number.isSafeInteger(binding.distBytes) ||
    binding.distBytes < 1 ||
    binding.distBytes > MAX_DIST_BYTES
  ) {
    throw new Error("Pages artifact binding bounds are invalid");
  }
}

function validateTarListing(artifactTar: string): void {
  const listing = spawnSync("tar", ["--list", "--file", artifactTar], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (listing.status !== 0) throw new Error("Pages artifact tar is invalid");
  for (const name of listing.stdout.split("\n").filter(Boolean)) {
    const normalized = name.startsWith("./") ? name.slice(2) : name;
    if (
      name.startsWith("/") ||
      name.includes("\\") ||
      normalized.split("/").some((part) => part === "..")
    ) {
      throw new Error("Pages artifact tar contains an unsafe path");
    }
  }
}

export function verifyPagesArtifactBinding(input: BindingVerificationInput): {
  version: string;
} {
  const { binding } = input;
  assertBindingShape(binding);
  if (
    binding.artifactId !== input.expectedArtifactId ||
    binding.artifactDigest !== input.expectedArtifactDigest
  ) {
    throw new Error("Pages artifact ID or digest does not match binding");
  }
  if (
    binding.commit !== input.expectedCommit ||
    binding.tag !== input.expectedTag
  ) {
    throw new Error("Pages artifact release identity does not match binding");
  }
  if (sha256File(input.artifactTar) !== binding.artifactTarSha256) {
    throw new Error("Pages artifact tar digest does not match binding");
  }
  validateTarListing(input.artifactTar);
  const extractionRoot = mkdtempSync(join(tmpdir(), "cat5-pages-verify-"));
  try {
    const extracted = spawnSync(
      "tar",
      [
        "--extract",
        "--file",
        resolve(input.artifactTar),
        "--directory",
        extractionRoot,
        "--no-same-owner",
        "--no-same-permissions",
      ],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    );
    if (extracted.status !== 0) {
      throw new Error("Pages artifact tar could not be extracted");
    }
    const tree = treeEvidence(extractionRoot);
    if (
      tree.sha256 !== binding.distTreeSha256 ||
      tree.count !== binding.distFileCount ||
      tree.bytes !== binding.distBytes
    ) {
      throw new Error("Pages artifact content does not match verified dist");
    }
  } finally {
    rmSync(extractionRoot, { recursive: true, force: true });
  }
  return { version: binding.version };
}

export function validateArtifactMetadata(
  metadata: unknown,
  expected: ArtifactMetadataExpectation,
): { artifactId: string; artifactDigest: string } {
  requireMatch(expected.artifactId, ARTIFACT_ID, "Pages artifact ID");
  requireMatch(
    expected.artifactDigest,
    ARTIFACT_DIGEST,
    "Pages artifact digest",
  );
  requireMatch(expected.commit, COMMIT, "release commit");
  requireMatch(expected.runId, ARTIFACT_ID, "workflow run ID");
  if (!metadata || typeof metadata !== "object") {
    throw new Error("Pages artifact metadata is invalid");
  }
  const artifact = metadata as {
    id?: unknown;
    name?: unknown;
    expired?: unknown;
    digest?: unknown;
    workflow_run?: { id?: unknown; head_sha?: unknown };
  };
  if (String(artifact.id) !== expected.artifactId) {
    throw new Error("Pages artifact metadata has a different ID");
  }
  if (artifact.name !== ARTIFACT_NAME || artifact.expired !== false) {
    throw new Error("Pages artifact metadata is not deployable");
  }
  if (artifact.digest !== expected.artifactDigest) {
    throw new Error("Pages artifact metadata has a different digest");
  }
  if (String(artifact.workflow_run?.id) !== expected.runId) {
    throw new Error("Pages artifact metadata has a different workflow run");
  }
  if (artifact.workflow_run?.head_sha !== expected.commit) {
    throw new Error("Pages artifact metadata has a different release commit");
  }
  return {
    artifactId: expected.artifactId,
    artifactDigest: expected.artifactDigest,
  };
}

function validateDeploymentUrl(raw: string): URL {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    !url.pathname.endsWith("/")
  ) {
    throw new Error("deployment URL must be canonical HTTPS");
  }
  return url;
}

async function boundedText(
  fetcher: typeof fetch,
  url: URL,
  requestTimeoutMs: number,
  expectedContentType: "html" | "javascript",
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetcher(url, {
      cache: "no-store",
      headers: {
        accept:
          expectedContentType === "html"
            ? "text/html"
            : "text/javascript, application/javascript",
        "cache-control": "no-cache, no-store, max-age=0",
        pragma: "no-cache",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes(expectedContentType)) {
      throw new Error(`unexpected ${expectedContentType} content type`);
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_RESPONSE_BYTES
    ) {
      throw new Error("live release response exceeds size cap");
    }
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
      throw new Error("live release response exceeds size cap");
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function moduleSourceFromHtml(html: string): string {
  for (const match of html.matchAll(/<script\b[^>]*>/giu)) {
    const tag = match[0];
    if (!/\btype=["']module["']/iu.test(tag)) continue;
    const source = /\bsrc=["']([^"']+)["']/iu.exec(tag)?.[1];
    if (source) return source;
  }
  throw new Error("live shell has no module bundle");
}

const FORBIDDEN_LIVE_MARKERS: ReadonlyArray<{
  label: string;
  pattern: RegExp;
}> = [
  { label: "legacy release version", pattern: /0\.1\.0-beta\.1/iu },
  {
    label: "legacy update-choice marker",
    pattern: /__PPX_UPDATE_AVAILABLE__|ppx-update-available/iu,
  },
  {
    label: "legacy update-choice copy",
    pattern: /a newer version is available|review later/iu,
  },
  {
    label: "old-app selector copy",
    pattern:
      /\b(?:open|go to|switch to|use)\s+(?:the\s+)?new(?:er)?\s+version\b/iu,
  },
  {
    label: "legacy V1 write UI",
    pattern:
      /offer message QR after text encryption|download (?:in-app message|phone camera link) QR/iu,
  },
];

async function inspectLivePage(input: {
  deploymentUrl: URL;
  version: string;
  requestTimeoutMs: number;
  fetcher: typeof fetch;
}): Promise<Omit<LiveAcceptanceResult, "attempt">> {
  const html = await boundedText(
    input.fetcher,
    input.deploymentUrl,
    input.requestTimeoutMs,
    "html",
  );
  if (!/<div\s+id=["']app["']/iu.test(html)) {
    throw new Error("live shell is not Chat NoControl");
  }
  const source = moduleSourceFromHtml(html);
  const moduleUrl = new URL(source, input.deploymentUrl);
  if (
    moduleUrl.origin !== input.deploymentUrl.origin ||
    !moduleUrl.pathname.startsWith(input.deploymentUrl.pathname) ||
    moduleUrl.search !== "" ||
    moduleUrl.hash !== ""
  ) {
    throw new Error("live module bundle is outside the canonical app base");
  }
  const bundle = await boundedText(
    input.fetcher,
    moduleUrl,
    input.requestTimeoutMs,
    "javascript",
  );
  if (!bundle.includes(input.version)) {
    throw new Error(`live module does not report ${input.version}`);
  }
  if (!/CAT-?5/iu.test(bundle)) {
    throw new Error("live module does not identify CAT5");
  }
  for (const forbidden of FORBIDDEN_LIVE_MARKERS) {
    if (forbidden.pattern.test(`${html}\n${bundle}`)) {
      throw new Error(`live release contains ${forbidden.label}`);
    }
  }
  return {
    deploymentUrl: input.deploymentUrl.href,
    modulePath: moduleUrl.pathname,
    version: input.version,
  };
}

export async function pollLiveAcceptance(
  options: LiveAcceptanceOptions,
): Promise<LiveAcceptanceResult> {
  if (!BETA_VERSION.test(options.version)) {
    throw new Error("live acceptance version is invalid");
  }
  if (
    !Number.isSafeInteger(options.attempts) ||
    options.attempts < 1 ||
    options.attempts > 30 ||
    !Number.isSafeInteger(options.intervalMs) ||
    options.intervalMs < 0 ||
    options.intervalMs > 30_000 ||
    !Number.isSafeInteger(options.requestTimeoutMs) ||
    options.requestTimeoutMs < 100 ||
    options.requestTimeoutMs > 15_000
  ) {
    throw new Error("live acceptance polling bounds are invalid");
  }
  const deploymentUrl = validateDeploymentUrl(options.deploymentUrl);
  const fetcher = options.fetcher ?? fetch;
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolveSleep) =>
        setTimeout(resolveSleep, milliseconds),
      ));
  let lastError = "unknown acceptance failure";
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return {
        ...(await inspectLivePage({
          deploymentUrl,
          version: options.version,
          requestTimeoutMs: options.requestTimeoutMs,
          fetcher,
        })),
        attempt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < options.attempts) await sleep(options.intervalMs);
    }
  }
  throw new Error(
    `Live Pages acceptance failed after ${options.attempts} attempts: ${lastError}`,
  );
}

function readOption(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing --${name}`);
  }
  return value;
}

function readIntegerOption(name: string): number {
  const value = Number(readOption(name));
  if (!Number.isSafeInteger(value)) throw new Error(`Invalid --${name}`);
  return value;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "record") {
    const binding = createPagesArtifactBinding({
      distDirectory: readOption("dist"),
      artifactTar: readOption("tar"),
      artifactId: readOption("artifact-id"),
      artifactDigest: readOption("artifact-digest"),
      commit: readOption("commit"),
      tag: readOption("tag"),
      version: readOption("version"),
    });
    const output = readOption("output");
    mkdirSync(resolve(output, ".."), { recursive: true });
    writeFileSync(output, `${JSON.stringify(binding, null, 2)}\n`);
    console.log(
      `Bound Pages artifact id=${binding.artifactId} tar=${binding.artifactTarSha256} dist=${binding.distTreeSha256}`,
    );
    return;
  }
  if (command === "verify-binding") {
    const binding = JSON.parse(
      readFileSync(readOption("binding"), "utf8"),
    ) as PagesArtifactBinding;
    const result = verifyPagesArtifactBinding({
      artifactTar: readOption("tar"),
      binding,
      expectedArtifactId: readOption("artifact-id"),
      expectedArtifactDigest: readOption("artifact-digest"),
      expectedCommit: readOption("commit"),
      expectedTag: readOption("tag"),
    });
    console.log(`Verified exact Pages artifact for ${result.version}`);
    return;
  }
  if (command === "verify-metadata") {
    const metadata = JSON.parse(
      readFileSync(readOption("metadata"), "utf8"),
    ) as unknown;
    const result = validateArtifactMetadata(metadata, {
      artifactId: readOption("artifact-id"),
      artifactDigest: readOption("artifact-digest"),
      commit: readOption("commit"),
      runId: readOption("run-id"),
    });
    console.log(`Verified immutable Pages artifact ${result.artifactId}`);
    return;
  }
  if (command === "accept") {
    const result = await pollLiveAcceptance({
      deploymentUrl: readOption("url"),
      version: readOption("version"),
      attempts: readIntegerOption("attempts"),
      intervalMs: readIntegerOption("interval-ms"),
      requestTimeoutMs: readIntegerOption("request-timeout-ms"),
    });
    console.log(
      `Live Pages acceptance passed on attempt ${result.attempt}: ${result.deploymentUrl} reports ${result.version}`,
    );
    return;
  }
  throw new Error(
    "Usage: pages-release.ts <record|verify-binding|verify-metadata|accept>",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
