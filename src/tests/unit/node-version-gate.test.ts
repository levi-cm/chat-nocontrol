// @vitest-environment node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const checkerUrl = new URL(
  "../../../scripts/check-node-version.ts",
  import.meta.url,
).href;
const checkerPath = fileURLToPath(checkerUrl);

function runChecker(source: string) {
  return spawnSync(process.execPath, ["--import", "tsx", "--eval", source], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

describe("exact Node release gate", () => {
  it("accepts the pinned Node runtime through the real CLI", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", checkerPath],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("rejects every other Node patch version in a subprocess", () => {
    const result = runChecker(
      `import { assertExactNodeVersion } from ${JSON.stringify(checkerUrl)}; assertExactNodeVersion("v22.23.2");`,
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Node.js v22.23.1 is required");
    expect(result.stderr).toContain("received v22.23.2");
  });
});
