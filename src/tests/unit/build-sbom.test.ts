// @vitest-environment node

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../../..");
const script = join(projectRoot, "scripts/build-sbom.ts");
const tsx = join(projectRoot, "node_modules/tsx/dist/cli.mjs");
const temporaryDirectories: string[] = [];

function createFixture(options?: {
  packageName?: string;
  packageVersion?: string;
  lockName?: string;
  lockVersion?: string;
  lockRootName?: string;
  lockRootVersion?: string;
}) {
  const cwd = mkdtempSync(join(tmpdir(), "chat-nocontrol-sbom-"));
  temporaryDirectories.push(cwd);
  const packageName = options?.packageName ?? "chat-nocontrol";
  const packageVersion = options?.packageVersion ?? "0.2.0-beta.1";
  const lockName = options?.lockName ?? packageName;
  const lockVersion = options?.lockVersion ?? packageVersion;
  const lockRootName = options?.lockRootName ?? lockName;
  const lockRootVersion = options?.lockRootVersion ?? lockVersion;
  const dependencies = Object.fromEntries(
    Array.from({ length: 100 }, (_, index) => [
      `node_modules/dependency-${String(index).padStart(3, "0")}`,
      { version: "1.0.0", license: "MIT" },
    ]),
  );

  writeFileSync(
    join(cwd, "package.json"),
    `${JSON.stringify({ name: packageName, version: packageVersion })}\n`,
  );
  writeFileSync(
    join(cwd, "package-lock.json"),
    `${JSON.stringify({
      name: lockName,
      version: lockVersion,
      lockfileVersion: 3,
      packages: {
        "": {
          name: lockRootName,
          version: lockRootVersion,
          license: "AGPL-3.0-or-later",
        },
        ...dependencies,
      },
    })}\n`,
  );
  return cwd;
}

function run(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [tsx, script, ...args], {
    cwd,
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const path of temporaryDirectories.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe("SBOM build gate", () => {
  it("prepares immutable release bytes before validating external evidence", () => {
    const manifest = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(manifest.scripts["release:prepare"]).toBe(
      "tsx scripts/package-release.ts && tsx scripts/build-sbom.ts",
    );
    expect(manifest.scripts["release:physical-evidence-bindings"]).toBe(
      "tsx scripts/print-physical-device-evidence-bindings.ts",
    );
    expect(manifest.scripts["release:physical-test-kit"]).toBe(
      "tsx scripts/generate-physical-device-test-kit.ts",
    );
    expect(manifest.scripts["release:physical-server"]).toBe(
      "tsx scripts/physical-device-server.ts",
    );
    expect(manifest.scripts["test:sbom"]).toBe(
      "tsx scripts/build-sbom.ts --verify",
    );
    expect(manifest.scripts["test:release"]).toBe(
      "tsx scripts/build-sbom.ts --verify && tsx scripts/verify-release.ts",
    );
    expect(manifest.scripts["verify:prepared"]).toBe(
      "npm run test:release-prerequisites && npm run test:release && npm run test:reproducibility && npm run test:release-prerequisites && npm run test:release && npm run test:sbom",
    );
    expect(manifest.scripts.verify).toBe(
      "npm run verify:quality && npm run release:prepare && npm run verify:prepared",
    );
  });

  it("verifies the existing deterministic artifact without rewriting it", () => {
    const cwd = createFixture();
    expect(run(cwd).status).toBe(0);
    const output = join(cwd, "output/release/sbom.cdx.json");
    const stored = readFileSync(output, "utf8");
    const oldTimestamp = new Date("2020-01-01T00:00:00.000Z");
    utimesSync(output, oldTimestamp, oldTimestamp);
    const before = statSync(output).mtimeMs;

    const result = run(cwd, "--verify");

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(output, "utf8")).toBe(stored);
    expect(statSync(output).mtimeMs).toBe(before);
  });

  it("rejects and preserves a stale stored artifact in verify mode", () => {
    const cwd = createFixture();
    const output = join(cwd, "output/release/sbom.cdx.json");
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, '{"stale":true}\n');

    const result = run(cwd, "--verify");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Stored SBOM differs from deterministic package-lock evidence",
    );
    expect(readFileSync(output, "utf8")).toBe('{"stale":true}\n');
  });

  it("rejects a missing stored artifact in verify mode", () => {
    const cwd = createFixture();
    const output = join(cwd, "output/release/sbom.cdx.json");

    const result = run(cwd, "--verify");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Stored SBOM is missing");
    expect(() => statSync(output)).toThrow();
  });

  it("rejects package-lock root metadata that differs from package.json", () => {
    const cwd = createFixture({ lockRootVersion: "0.1.0-beta.1" });

    const result = run(cwd);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "package-lock.json root version must match package.json",
    );
  });

  it.each([
    {
      label: "top-level name",
      options: { lockName: "wrong-name" },
      message: "package-lock.json name must match package.json",
    },
    {
      label: "top-level version",
      options: { lockVersion: "0.1.0-beta.1" },
      message: "package-lock.json version must match package.json",
    },
    {
      label: "root name",
      options: { lockRootName: "wrong-name" },
      message: "package-lock.json root name must match package.json",
    },
  ])("rejects a mismatched package-lock $label", ({ options, message }) => {
    const cwd = createFixture(options);

    const result = run(cwd);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(message);
  });

  it("rejects metadata that is not the CAT5 release version", () => {
    const cwd = createFixture({ packageVersion: "0.3.0-beta.1" });

    const result = run(cwd);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "package.json version must be 0.2.0-beta.1",
    );
  });
});
