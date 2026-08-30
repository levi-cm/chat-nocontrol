import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseReleaseSignerPolicy } from "./release-signer-policy";

export interface OwnerAttestation {
  githubActor?: string;
  releaseSignerPrincipal?: string;
  statement?: string;
  attestedAt?: string;
}

const allowedProperties = new Set([
  "githubActor",
  "releaseSignerPrincipal",
  "statement",
  "attestedAt",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalUtc(value: string | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value
    ? timestamp
    : null;
}

export function repositoryOwner(cwd: string): string {
  const packageJson = JSON.parse(
    readFileSync(join(cwd, "package.json"), "utf8"),
  ) as { repository?: string | { url?: string } };
  const repository =
    typeof packageJson.repository === "string"
      ? packageJson.repository
      : packageJson.repository?.url;
  const match = /github\.com[/:]([^/]+)\/[^/]+?(?:\.git)?$/u.exec(
    repository ?? "",
  );
  if (!match?.[1]) throw new Error("repository owner could not be determined");
  return match[1];
}

export function validateOwnerAttestation(
  value: unknown,
  options: {
    cwd: string;
    completedAt?: string;
    expectedStatement: string;
    now: number;
    ownerActor?: string;
  },
): string[] {
  const failures: string[] = [];
  if (!isPlainRecord(value)) return ["owner attestation must be an object"];
  for (const property of Object.keys(value).sort()) {
    if (!allowedProperties.has(property))
      failures.push(`owner attestation contains unknown property ${property}`);
  }
  const attestation = value as OwnerAttestation;
  let expectedOwner = "";
  try {
    expectedOwner = repositoryOwner(options.cwd);
  } catch {
    failures.push("repository owner could not be determined");
  }
  if (attestation.githubActor !== expectedOwner) {
    failures.push("owner attestation GitHub actor must equal repository owner");
  }
  if (
    options.ownerActor !== undefined &&
    options.ownerActor !== expectedOwner
  ) {
    failures.push("authenticated workflow actor must equal repository owner");
  }
  let signerPrincipal = "";
  try {
    signerPrincipal = parseReleaseSignerPolicy(
      readFileSync(join(options.cwd, ".github/allowed_signers"), "utf8"),
    ).principal;
  } catch {
    failures.push(
      "allowed signers must contain exactly one namespace-git release signer",
    );
  }
  if (attestation.releaseSignerPrincipal !== signerPrincipal) {
    failures.push(
      "owner attestation principal must equal the sole Git release signer",
    );
  }
  if (attestation.statement !== options.expectedStatement) {
    failures.push("owner attestation statement is invalid");
  }
  const attestedAt = canonicalUtc(attestation.attestedAt);
  const completedAt = canonicalUtc(options.completedAt);
  if (attestedAt === null || attestedAt > options.now) {
    failures.push(
      "owner attestation time must be canonical ISO-8601 UTC and not future",
    );
  } else if (completedAt !== null && attestedAt < completedAt) {
    failures.push("owner attestation cannot predate completed work");
  }
  return failures;
}
