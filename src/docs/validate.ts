function normalizePath(path: string): string {
  const output: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") output.pop();
    else output.push(part);
  }
  return output.join("/");
}

function parent(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function join(base: string, target: string): string {
  return normalizePath(base === "" ? target : `${base}/${target}`);
}

function normalizedLocalTarget(
  source: string,
  rawTarget: string,
): string | null {
  const target = rawTarget.trim().replace(/^<|>$/gu, "");
  if (
    target === "" ||
    target.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/iu.test(target)
  ) {
    return null;
  }
  const pathOnly = decodeURIComponent(target.split("#", 1)[0] ?? "");
  return join(parent(source), pathOnly);
}

export function validateDocumentation(input: {
  files: ReadonlyMap<string, string>;
  availablePaths: ReadonlySet<string>;
}): string[] {
  const failures: string[] = [];
  for (const [path, text] of input.files) {
    if (path.startsWith("docs/") && !text.includes("**Authority:**")) {
      failures.push(`missing authority marker: ${path}`);
    }

    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
      const target = normalizedLocalTarget(path, match[1] ?? "");
      if (target && !input.availablePaths.has(target)) {
        failures.push(`broken local link: ${path} -> ${target}`);
      }
    }

    for (const match of text.matchAll(
      /`((?:\.\.\/)?(?:docs\/)?[^`\n]+\.md)`/gu,
    )) {
      const reference = match[1] ?? "";
      if (reference.includes("*")) continue;
      const relativeTarget = join(parent(path), reference);
      const target = reference.startsWith("docs/")
        ? normalizePath(reference)
        : input.availablePaths.has(reference)
          ? reference
          : relativeTarget;
      if (!input.availablePaths.has(target)) {
        failures.push(`broken documentation dependency: ${path} -> ${target}`);
      }
    }
  }
  return [...new Set(failures)].sort();
}
