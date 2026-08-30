import { readFileSync } from "node:fs";

import { importPhysicalDeviceEvidenceFile } from "./physical-device-evidence";

function parseArguments(argv: string[]): {
  input: string;
  sha256: string;
  ownerActor: string;
} {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (
      (key !== "--input" && key !== "--sha256" && key !== "--owner-actor") ||
      !value ||
      value.startsWith("--") ||
      values.has(key)
    ) {
      throw new Error(
        "Usage: import-physical-device-evidence.ts --input <file> --sha256 <lowercase-sha256> --owner-actor <github-login>",
      );
    }
    values.set(key, value);
  }
  if (values.size !== 3) {
    throw new Error(
      "Usage: import-physical-device-evidence.ts --input <file> --sha256 <lowercase-sha256> --owner-actor <github-login>",
    );
  }
  return {
    input: values.get("--input")!,
    sha256: values.get("--sha256")!,
    ownerActor: values.get("--owner-actor")!,
  };
}

const { input, sha256, ownerActor } = parseArguments(process.argv.slice(2));
const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  version?: string;
};
const review = JSON.parse(
  readFileSync("docs/security-review-attestation.json", "utf8"),
) as { reviewedCommit?: string };
const result = importPhysicalDeviceEvidenceFile({
  inputPath: input,
  expectedSha256: sha256,
  ownerActor,
  reviewedCandidateSha: review.reviewedCommit ?? "",
  version: manifest.version ?? "",
});

console.log(
  `Physical-device evidence imported: sha256=${result.expectedSha256} dist-sha256=${result.distSha256} archive-sha256=${result.archiveSha256}`,
);
