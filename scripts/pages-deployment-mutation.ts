import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  findSuccessfulPagesDeployment,
  type RecordedPagesDeployment,
} from "./github-deployment-evidence";

export type PagesMutationState = "MUTATED" | "NOT_MUTATED" | "UNKNOWN";

interface DetectPagesMutationOptions {
  actionOutcome: string;
  actionPageUrl: string;
  findDeployment: () => Promise<RecordedPagesDeployment>;
}

const noDeploymentMessage =
  "Release blocked: no exact successful GitHub Pages deployment was found";

export async function detectPagesMutation(
  options: DetectPagesMutationOptions,
): Promise<PagesMutationState> {
  const pageUrl = options.actionPageUrl.trim();
  if (pageUrl) {
    try {
      if (new URL(pageUrl).protocol !== "https:") return "UNKNOWN";
      return "MUTATED";
    } catch {
      return "UNKNOWN";
    }
  }
  try {
    await options.findDeployment();
    return "MUTATED";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message === noDeploymentMessage &&
      (options.actionOutcome === "failure" ||
        options.actionOutcome === "cancelled")
    ) {
      return "NOT_MUTATED";
    }
    return "UNKNOWN";
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
    homepage?: string;
  };
  const deploymentUrl = manifest.homepage?.trim() ?? "";
  if (!deploymentUrl) throw new Error("package homepage is missing");
  const state = await detectPagesMutation({
    actionOutcome: required("DEPLOYMENT_ACTION_OUTCOME"),
    actionPageUrl: process.env.DEPLOYMENT_ACTION_PAGE_URL ?? "",
    findDeployment: () =>
      findSuccessfulPagesDeployment({
        owner: required("REPOSITORY_OWNER"),
        repository: required("REPOSITORY_NAME"),
        tag: required("RELEASE_TAG"),
        commit: required("RELEASE_COMMIT"),
        deploymentUrl,
        deploymentStartedAt: required("DEPLOYMENT_STARTED_AT"),
        deploymentCompletedAt: required("DEPLOYMENT_COMPLETED_AT"),
        token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
      }),
  });
  appendFileSync(required("GITHUB_OUTPUT"), `state=${state}\n`);
  process.stdout.write(`Pages mutation state: ${state}\n`);
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
