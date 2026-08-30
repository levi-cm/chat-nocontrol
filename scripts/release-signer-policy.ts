export interface ReleaseSignerEntry {
  principal: string;
  key: string;
}

const policyFailure =
  "allowed signers must contain exactly one namespace-git release signer";

export function parseReleaseSignerPolicy(contents: string): ReleaseSignerEntry {
  const entries: ReleaseSignerEntry[] = [];
  let invalid = false;
  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const match =
      /^(\S+)\s+namespaces="git"\s+((?:ssh-|ecdsa-|sk-)\S*)\s+(\S+)$/u.exec(
        line,
      );
    if (!match || /[,!*?\[\]]/u.test(match[1] ?? "")) {
      invalid = true;
      continue;
    }
    entries.push({
      principal: match[1]!,
      key: `${match[2]} ${match[3]}`,
    });
  }
  if (
    invalid ||
    entries.length !== 1 ||
    new Set(entries.map((entry) => `${entry.principal}\0${entry.key}`)).size !==
      entries.length
  ) {
    throw new Error(policyFailure);
  }
  return entries[0]!;
}

export function validateReleaseSignerPolicy(contents: string): string[] {
  try {
    parseReleaseSignerPolicy(contents);
    return [];
  } catch {
    return [policyFailure];
  }
}

export const validateAllowedSignerRolePolicy = validateReleaseSignerPolicy;
