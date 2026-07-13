import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

import { releaseArtifactName } from "./release-evidence";

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};
const outputDirectory = "output/release";
const artifact = `${outputDirectory}/${releaseArtifactName(manifest.version)}`;

mkdirSync(outputDirectory, { recursive: true });

const build = spawnSync("npm", ["run", "build"], {
  encoding: "utf8",
  env: { ...process.env, TZ: "UTC" },
});
const buildLog = [
  "$ npm run build",
  build.stdout.trimEnd(),
  build.stderr.trimEnd(),
]
  .filter(Boolean)
  .join("\n");
writeFileSync(`${outputDirectory}/build.log`, `${buildLog}\n`);
process.stdout.write(build.stdout);
process.stderr.write(build.stderr);
if (build.status !== 0) throw new Error("Release build failed");

rmSync(artifact, { force: true });

const result = spawnSync(
  "tar",
  [
    "--sort=name",
    "--mtime=UTC 1970-01-01",
    "--owner=0",
    "--group=0",
    "--numeric-owner",
    "--format=ustar",
    "-czf",
    artifact,
    "dist",
    "LICENSE",
    "README.md",
    "SECURITY.md",
    "SOURCE.md",
  ],
  {
    stdio: "inherit",
  },
);
if (result.status !== 0) throw new Error("Could not package preview artifact");
console.log(`Release artifact stored: ${artifact}`);
