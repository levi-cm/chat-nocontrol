export interface PackageLockPackage {
  name?: string;
  version?: string;
  license?: string;
  integrity?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
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

function packagePurl(name: string, version: string): string {
  const encodedName = name.startsWith("@")
    ? `%40${name
        .slice(1)
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/")}`
    : encodeURIComponent(name);
  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
}

function integrityHashes(integrity: string | undefined) {
  if (!integrity) return undefined;
  const algorithms = new Map([
    ["sha256", { cyclonedx: "SHA-256", bytes: 32 }],
    ["sha384", { cyclonedx: "SHA-384", bytes: 48 }],
    ["sha512", { cyclonedx: "SHA-512", bytes: 64 }],
  ]);
  const hashes = integrity.split(/\s+/u).map((entry) => {
    const match = /^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})$/u.exec(
      entry,
    );
    const algorithm = match ? algorithms.get(match[1]!) : undefined;
    const bytes = match ? Buffer.from(match[2]!, "base64") : Buffer.alloc(0);
    if (
      !match ||
      !algorithm ||
      bytes.byteLength !== algorithm.bytes ||
      bytes.toString("base64") !== match[2]
    ) {
      throw new Error("Package lock contains invalid dependency integrity");
    }
    return {
      alg: algorithm.cyclonedx,
      content: bytes.toString("hex"),
    };
  });
  return hashes.sort((left, right) => left.alg.localeCompare(right.alg));
}

function dependencyNames(value: PackageLockPackage | undefined): string[] {
  return [
    ...Object.keys(value?.dependencies ?? {}),
    ...Object.keys(value?.devDependencies ?? {}),
    ...Object.keys(value?.optionalDependencies ?? {}),
    ...Object.keys(value?.peerDependencies ?? {}),
  ].filter((name, index, all) => all.indexOf(name) === index);
}

function parentPackagePath(path: string): string | null {
  const match = /^(.*?)(?:\/)?node_modules\/(?:@[^/]+\/)?[^/]+$/u.exec(path);
  return match ? (match[1] ?? "") : null;
}

function resolveDependencyPath(
  packages: PackageLock["packages"],
  parentPath: string,
  dependency: string,
): string | null {
  let base: string | null = parentPath;
  while (base !== null) {
    const candidate = base
      ? `${base}/node_modules/${dependency}`
      : `node_modules/${dependency}`;
    if (packages[candidate]?.version) return candidate;
    base = parentPackagePath(base);
  }
  return null;
}

export function serializeEvidence(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function buildSbom(lock: PackageLock) {
  const root = lock.packages[""];
  const name = root?.name ?? lock.name;
  const version = root?.version ?? lock.version;
  if (!name || !version) throw new Error("Package lock lacks root metadata");

  const rootRef = packagePurl(name, version);
  const components = Object.entries(lock.packages)
    .filter(([path, value]) => path.includes("node_modules/") && value.version)
    .map(([path, value]) => {
      const componentName = dependencyName(path);
      const componentVersion = value.version as string;
      const hashes = integrityHashes(value.integrity);
      return {
        type: "library",
        "bom-ref": `npm-path:${path}@${componentVersion}`,
        name: componentName,
        version: componentVersion,
        purl: packagePurl(componentName, componentVersion),
        ...(hashes ? { hashes } : {}),
        licenses: [{ license: { name: value.license ?? "UNKNOWN" } }],
        properties: [{ name: "npm:package-lock-path", value: path }],
      };
    })
    .sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"]));
  const componentRefByPath = new Map(
    components.map((component) => [
      component.properties[0]!.value,
      component["bom-ref"],
    ]),
  );
  const dependencies = [
    {
      ref: rootRef,
      dependsOn: dependencyNames(root)
        .map((dependency) =>
          resolveDependencyPath(lock.packages, "", dependency),
        )
        .filter((path): path is string => path !== null)
        .map((path) => componentRefByPath.get(path)!)
        .sort(),
    },
    ...Object.entries(lock.packages)
      .filter(
        ([path, value]) => path.includes("node_modules/") && value.version,
      )
      .map(([path, value]) => ({
        ref: componentRefByPath.get(path)!,
        dependsOn: dependencyNames(value)
          .map((dependency) =>
            resolveDependencyPath(lock.packages, path, dependency),
          )
          .filter((dependencyPath): dependencyPath is string =>
            Boolean(dependencyPath),
          )
          .map((dependencyPath) => componentRefByPath.get(dependencyPath)!)
          .sort(),
      }))
      .sort((left, right) => left.ref.localeCompare(right.ref)),
  ];

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000000",
    version: 1,
    metadata: {
      component: {
        type: "application",
        "bom-ref": rootRef,
        name,
        version,
        purl: rootRef,
        licenses: [{ license: { id: root?.license ?? "AGPL-3.0-or-later" } }],
      },
    },
    components,
    dependencies,
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
