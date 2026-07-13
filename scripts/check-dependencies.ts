import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};
const approved = JSON.parse(
  readFileSync("scripts/approved-dependencies.json", "utf8"),
) as typeof manifest;

const dependencyDiff = (["dependencies", "devDependencies"] as const).flatMap(
  (section) => {
    const actual = manifest[section];
    const expected = approved[section];
    return [
      ...Object.keys(actual)
        .filter((name) => !(name in expected))
        .map((name) => `${section}:unexpected:${name}@${actual[name]}`),
      ...Object.keys(expected)
        .filter((name) => !(name in actual))
        .map((name) => `${section}:missing:${name}@${expected[name]}`),
      ...Object.keys(expected)
        .filter((name) => name in actual && actual[name] !== expected[name])
        .map(
          (name) =>
            `${section}:changed:${name}:${expected[name]}->${actual[name]}`,
        ),
    ];
  },
);
const unpinned = Object.entries({
  ...manifest.dependencies,
  ...manifest.devDependencies,
}).filter(
  ([, version]) =>
    !/^\d+\.\d+\.\d+$/u.test(version) && !version.startsWith("npm:"),
);

if (dependencyDiff.length > 0 || unpinned.length > 0) {
  throw new Error(
    `Dependency review failed: approval-diff=${dependencyDiff.join(",")} unpinned=${unpinned
      .map(([name]) => name)
      .join(",")}`,
  );
}

const audit = spawnSync(
  "npm",
  ["audit", "--audit-level=high", "--omit=optional"],
  { encoding: "utf8" },
);
if (audit.status !== 0) {
  throw new Error(
    `Dependency audit failed:\n${audit.stdout.trim()}\n${audit.stderr.trim()}`,
  );
}

console.log(
  `Dependency review and npm high-severity audit OK: ${Object.keys(manifest.dependencies).length} runtime, ${Object.keys(manifest.devDependencies).length} dev; TS6 alias is ESLint-only compatibility for pinned TS7.`,
);
