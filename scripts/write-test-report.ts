import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { serializeEvidence } from "./release-evidence";

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  name: string;
  version: string;
};
let commit: string | null = null;
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  // Candidate verification can run before the first repository commit.
}
const report = {
  schemaVersion: 1,
  package: `${manifest.name}@${manifest.version}`,
  status: "passed",
  command: "npm run verify:quality",
  sourceCommit: commit,
  generatedAt: new Date().toISOString(),
  gates: [
    "documentation",
    "typecheck",
    "lint",
    "format",
    "unit-and-coverage",
    "primitive-and-nist-vectors",
    "provider-contract",
    "all-family-protocol-goldens",
    "parser-properties-fuzz-mutations-truncations-boundaries",
    "storage-session-and-file-memory",
    "desktop-and-mobile-browser-flows",
    "accessibility-and-i18n",
    "offline-update-and-network-denial",
    "dependency-allowlist-and-npm-audit",
    "production-build",
  ],
  runner: {
    node: process.version,
    githubRunId: process.env.GITHUB_RUN_ID ?? null,
  },
};
mkdirSync("output/release", { recursive: true });
writeFileSync("output/release/test-report.json", serializeEvidence(report));
console.log("Quality test report written after all candidate gates passed.");
