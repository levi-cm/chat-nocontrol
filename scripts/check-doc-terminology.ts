import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateDocumentation } from "../src/docs/validate";

const root = resolve(import.meta.dirname, "..");
const required = [
  ".node-version",
  "Chat_NoControl_full_plan.md",
  "docs/implementation-plan.md",
  "docs/protocol-v1.md",
  "docs/security-architecture.md",
  "docs/apple-visual-spec.md",
];
const terms = [
  "identity",
  "public contact",
  "private recovery card",
  "encrypted text",
  "encrypted file",
];

async function collectAvailablePaths(): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile()) paths.push(entry.name);
  }
  const visit = async (directory: string, prefix: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = posix.join(prefix, entry.name);
      if (entry.isDirectory())
        await visit(resolve(directory, entry.name), path);
      else if (entry.isFile()) paths.push(path);
    }
  };
  await visit(resolve(root, "docs"), "docs");
  return paths;
}

async function main(): Promise<void> {
  const failures: string[] = [];
  for (const path of required) {
    try {
      await access(resolve(root, path), constants.R_OK);
    } catch {
      failures.push(`missing required file: ${path}`);
    }
  }

  const docs = (await readdir(resolve(root, "docs")))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `docs/${name}`);
  const documentationPaths = ["Chat_NoControl_full_plan.md", ...docs];
  const availablePaths = new Set<string>(await collectAvailablePaths());
  const files = new Map<string, string>();
  for (const path of documentationPaths) {
    files.set(path, await readFile(resolve(root, path), "utf8"));
  }
  failures.push(...validateDocumentation({ files, availablePaths }));

  const master = (files.get("Chat_NoControl_full_plan.md") ?? "").toLowerCase();
  for (const term of terms) {
    if (!master.includes(term)) failures.push(`missing required term: ${term}`);
  }

  if (failures.length > 0) {
    console.error([...new Set(failures)].sort().join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      `Docs contract OK: ${required.length} required files, ${docs.length} authority docs, ${terms.length} terms, local links and dependencies resolved.`,
    );
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) await main();
