import { pathToFileURL } from "node:url";

export const REQUIRED_NODE_VERSION = "v22.23.1";

export function assertExactNodeVersion(actualVersion: string): void {
  if (actualVersion !== REQUIRED_NODE_VERSION) {
    throw new Error(
      `Node.js ${REQUIRED_NODE_VERSION} is required; received ${actualVersion}.`,
    );
  }
}

function isMainModule(): boolean {
  const entryPath = process.argv[1];
  return (
    entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href
  );
}

if (isMainModule()) {
  try {
    assertExactNodeVersion(process.version);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
