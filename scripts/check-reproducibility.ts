import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";

import { releaseArtifactName } from "./release-evidence";

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};
const artifactPath = `output/release/${releaseArtifactName(manifest.version)}`;

function build(): void {
  const result = spawnSync("npx", ["tsx", "scripts/package-release.ts"], {
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

function artifactHash(): string {
  const files = readdirSync("dist", { recursive: true })
    .map(String)
    .filter((path) => statSync(join("dist", path)).isFile())
    .sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relative("dist", join("dist", file)));
    hash.update(readFileSync(join("dist", file)));
  }
  return hash.digest("hex");
}

function fileHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

build();
const first = artifactHash();
const firstArchive = fileHash(artifactPath);
build();
const second = artifactHash();
const secondArchive = fileHash(artifactPath);
if (first !== second)
  throw new Error(`Rebuild mismatch: ${first} != ${second}`);
if (firstArchive !== secondArchive) {
  throw new Error(
    `Release archive mismatch: ${firstArchive} != ${secondArchive}`,
  );
}
const record = JSON.parse(
  readFileSync("output/release/release-record.json", "utf8"),
) as { artifact?: { sha256?: string } };
if (record.artifact?.sha256 !== secondArchive) {
  throw new Error("Rebuilt archive hash differs from the release record");
}
console.log(
  `Reproducibility verified: dist-sha256=${first} artifact-sha256=${firstArchive}`,
);
