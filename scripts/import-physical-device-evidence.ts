import { readFileSync } from "node:fs";

import { importPhysicalDeviceEvidenceFile } from "./physical-device-evidence";

function parseArguments(argv: string[]): {
  input: string;
  signature: string;
  sha256: string;
} {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (
      (key !== "--input" && key !== "--signature" && key !== "--sha256") ||
      !value ||
      value.startsWith("--") ||
      values.has(key)
    ) {
      throw new Error(
        "Usage: import-physical-device-evidence.ts --input <file> --signature <file.sig> --sha256 <lowercase-sha256>",
      );
    }
    values.set(key, value);
  }
  if (values.size !== 3) {
    throw new Error(
      "Usage: import-physical-device-evidence.ts --input <file> --signature <file.sig> --sha256 <lowercase-sha256>",
    );
  }
  return {
    input: values.get("--input")!,
    signature: values.get("--signature")!,
    sha256: values.get("--sha256")!,
  };
}

const { input, signature, sha256 } = parseArguments(process.argv.slice(2));
const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  version?: string;
};
const review = JSON.parse(
  readFileSync("docs/independent-security-review.json", "utf8"),
) as { reviewedCommit?: string };
const result = importPhysicalDeviceEvidenceFile({
  inputPath: input,
  signaturePath: signature,
  expectedSha256: sha256,
  reviewedCandidateSha: review.reviewedCommit ?? "",
  version: manifest.version ?? "",
});

console.log(
  `Physical-device evidence imported: sha256=${result.expectedSha256} dist-sha256=${result.distSha256} archive-sha256=${result.archiveSha256}`,
);
