import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  type ReviewRecord,
  validateIndependentReviewEvidence,
} from "./independent-review-evidence";

const failures: string[] = [];
const recordPath = "docs/independent-security-review.json";
const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
const commit = head.status === 0 ? head.stdout.trim() : "";

if (!existsSync(recordPath)) {
  failures.push(
    `missing ${recordPath}; an implementation-team or AI review is not independent review`,
  );
} else {
  let record: ReviewRecord = {};
  try {
    record = JSON.parse(readFileSync(recordPath, "utf8")) as ReviewRecord;
  } catch {
    failures.push(`${recordPath} is not valid JSON`);
  }
  failures.push(...validateIndependentReviewEvidence(record, { head: commit }));
}

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
  `Public-beta prerequisites OK: release HEAD ${commit} is the evidence-only child of its reviewed candidate; private reporting enabled.`,
);
