import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  type SecurityReviewAttestation,
  validateSecurityReviewAttestation,
} from "./security-review-attestation";
import { validatePhysicalDeviceEvidenceFiles } from "./physical-device-evidence";

const failures: string[] = [];
const recordPath = "docs/security-review-attestation.json";
const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
const commit = head.status === 0 ? head.stdout.trim() : "";
let reviewRecord: SecurityReviewAttestation = {};

if (!existsSync(recordPath)) {
  failures.push(
    `missing ${recordPath}; owner-attested security review evidence is required`,
  );
} else {
  try {
    reviewRecord = JSON.parse(
      readFileSync(recordPath, "utf8"),
    ) as SecurityReviewAttestation;
  } catch {
    failures.push(`${recordPath} is not valid JSON`);
  }
  failures.push(
    ...validateSecurityReviewAttestation(reviewRecord, { head: commit }),
  );
}

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  version?: string;
};
const version = manifest.version ?? "";
failures.push(
  ...validatePhysicalDeviceEvidenceFiles({
    reviewedCandidateSha: reviewRecord.reviewedCommit ?? "",
    version,
  }).failures,
);

const response = await fetch(
  "https://api.github.com/repos/levi-cm/chat-nocontrol/private-vulnerability-reporting",
  { headers: { Accept: "application/vnd.github+json" } },
).catch(() => null);
if (!response?.ok) {
  failures.push("could not verify GitHub private vulnerability reporting");
} else {
  const reporting = (await response.json()) as { enabled?: boolean };
  if (reporting.enabled !== true) {
    failures.push("GitHub private vulnerability reporting is not enabled");
  }
}

if (failures.length > 0) {
  throw new Error(`Public-beta release blocked:\n- ${failures.join("\n- ")}`);
}

console.log(
  `Public-beta prerequisites OK: release HEAD ${commit} is the owner-attested evidence-only child of its reviewed candidate; physical-device evidence matches the exact dist/archive; private reporting enabled.`,
);
