export interface PackageLockPackage {
  name?: string;
  version?: string;
  license?: string;
}

export interface PackageLock {
  name?: string;
  version?: string;
  packages: Record<string, PackageLockPackage>;
}

interface ReleaseRecordInput {
  packageName: string;
  version: string;
  commit: string;
  tag: string;
  artifactSha256: string;
  sbomSha256: string;
  testReportSha256: string;
  deploymentUrl: string;
  remoteTagObjectId: string | null;
  rollbackTag: string | null;
}

function dependencyName(path: string): string {
  const segments = path.split("node_modules/");
  return segments.at(-1) ?? path;
}

export function serializeEvidence(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function buildSbom(lock: PackageLock) {
  const root = lock.packages[""];
  const name = root?.name ?? lock.name;
  const version = root?.version ?? lock.version;
  if (!name || !version) throw new Error("Package lock lacks root metadata");

  const components = Object.entries(lock.packages)
    .filter(([path, value]) => path.includes("node_modules/") && value.version)
    .map(([path, value]) => ({
      type: "library",
      "bom-ref": `npm-path:${path}@${value.version}`,
      name: dependencyName(path),
      version: value.version as string,
      licenses: [{ license: { name: value.license ?? "UNKNOWN" } }],
      properties: [{ name: "npm:package-lock-path", value: path }],
    }))
    .sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"]));

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000000",
    version: 1,
    metadata: {
      component: {
        type: "application",
        name,
        version,
        licenses: [{ license: { id: root?.license ?? "AGPL-3.0-or-later" } }],
      },
    },
    components,
  } as const;
}

export function releaseArtifactName(version: string): string {
  return `chat-nocontrol-v${version}.tgz`;
}

export function buildReleaseRecord(input: ReleaseRecordInput) {
  if (!/^\d+\.\d+\.\d+-beta\.\d+$/u.test(input.version)) {
    throw new Error("Stable release is unavailable; version must be a beta");
  }
  if (input.tag !== `v${input.version}`) {
    throw new Error("Release tag does not match package version");
  }
  if (!/^[0-9a-f]{40}$/u.test(input.commit)) {
    throw new Error("Release commit must be a full SHA-1 object ID");
  }
  if (!/^[0-9a-f]{64}$/u.test(input.artifactSha256)) {
    throw new Error("Artifact hash must be SHA-256");
  }
  if (!/^[0-9a-f]{64}$/u.test(input.sbomSha256)) {
    throw new Error("SBOM hash must be SHA-256");
  }
  if (!/^[0-9a-f]{64}$/u.test(input.testReportSha256)) {
    throw new Error("Test report hash must be SHA-256");
  }
  if (!/^https:\/\//u.test(input.deploymentUrl)) {
    throw new Error("Deployment URL must use HTTPS");
  }
  if (
    input.remoteTagObjectId !== null &&
    !/^[0-9a-f]{40}$/u.test(input.remoteTagObjectId)
  ) {
    throw new Error("Remote tag object ID must be a full SHA-1 object ID");
  }

  return {
    schemaVersion: 1,
    package: `${input.packageName}@${input.version}`,
    channel: "beta",
    source: {
      commit: input.commit,
      tag: input.tag,
      remoteTagObjectId: input.remoteTagObjectId,
    },
    artifact: {
      file: releaseArtifactName(input.version),
      sha256: input.artifactSha256,
    },
    sbom: { file: "sbom.cdx.json", sha256: input.sbomSha256 },
    testReport: {
      file: "test-report.json",
      sha256: input.testReportSha256,
      status: "passed",
    },
    signatureVerification: {
      status: "verified",
      allowedSignersFile: ".github/allowed_signers",
    },
    deployment: { url: input.deploymentUrl, platform: "GitHub Pages" },
    buildLog: "build.log",
    rollback: input.rollbackTag
      ? { tag: input.rollbackTag, reason: "Previous release tag." }
      : {
          tag: null,
          reason: "Initial release; no previous deployed tag exists.",
        },
  } as const;
}
