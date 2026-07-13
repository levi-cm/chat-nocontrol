import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  buildSbom,
  type PackageLock,
  serializeEvidence,
} from "./release-evidence";

const lock = JSON.parse(
  readFileSync("package-lock.json", "utf8"),
) as PackageLock;
const sbom = buildSbom(lock);
const serialized = serializeEvidence(sbom);
const digest = createHash("sha256").update(serialized).digest("hex");
const output = "output/release/sbom.cdx.json";

if (sbom.components.length < 100)
  throw new Error("SBOM dependency set is unexpectedly small");
mkdirSync("output/release", { recursive: true });
writeFileSync(output, serialized);
if (readFileSync(output, "utf8") !== serialized) {
  throw new Error("Stored SBOM differs from generated evidence");
}
console.log(
  `SBOM verified and stored: ${sbom.components.length} components, sha256=${digest}, path=${output}`,
);
