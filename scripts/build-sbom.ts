import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  buildSbom,
  type PackageLock,
  serializeEvidence,
} from "./release-evidence";

interface PackageManifest {
  name?: string;
  version?: string;
}

const expectedPackageName = "chat-nocontrol";
const expectedPackageVersion = "0.2.0-beta.1";
const verify = process.argv.slice(2).includes("--verify");
const unknownArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== "--verify");
if (unknownArguments.length > 0) {
  throw new Error(`Unknown SBOM arguments: ${unknownArguments.join(", ")}`);
}

const manifest = JSON.parse(
  readFileSync("package.json", "utf8"),
) as PackageManifest;
const lock = JSON.parse(
  readFileSync("package-lock.json", "utf8"),
) as PackageLock;

if (manifest.name !== expectedPackageName) {
  throw new Error(`package.json name must be ${expectedPackageName}`);
}
if (manifest.version !== expectedPackageVersion) {
  throw new Error(`package.json version must be ${expectedPackageVersion}`);
}
if (lock.name !== manifest.name) {
  throw new Error("package-lock.json name must match package.json");
}
if (lock.version !== manifest.version) {
  throw new Error("package-lock.json version must match package.json");
}
const lockRoot = lock.packages[""];
if (lockRoot?.name !== manifest.name) {
  throw new Error("package-lock.json root name must match package.json");
}
if (lockRoot.version !== manifest.version) {
  throw new Error("package-lock.json root version must match package.json");
}

const sbom = buildSbom(lock);
const serialized = serializeEvidence(sbom);
const digest = createHash("sha256").update(serialized).digest("hex");
const output = "output/release/sbom.cdx.json";

if (sbom.components.length < 100)
  throw new Error("SBOM dependency set is unexpectedly small");

if (verify) {
  if (!existsSync(output)) throw new Error(`Stored SBOM is missing: ${output}`);
  if (readFileSync(output, "utf8") !== serialized) {
    throw new Error(
      "Stored SBOM differs from deterministic package-lock evidence",
    );
  }
} else {
  mkdirSync("output/release", { recursive: true });
  writeFileSync(output, serialized);
}
console.log(
  `SBOM ${verify ? "verified" : "stored"}: ${sbom.components.length} components, sha256=${digest}, path=${output}`,
);
