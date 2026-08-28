import { readFileSync } from "node:fs";

import { getPhysicalDeviceEvidenceBindings } from "./physical-device-evidence";

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  version?: string;
};
const review = JSON.parse(
  readFileSync("docs/independent-security-review.json", "utf8"),
) as { reviewedCommit?: string };

const bindings = getPhysicalDeviceEvidenceBindings({
  reviewedCandidateSha: review.reviewedCommit ?? "",
  version: manifest.version ?? "",
});
process.stdout.write(`${JSON.stringify(bindings, null, 2)}\n`);
