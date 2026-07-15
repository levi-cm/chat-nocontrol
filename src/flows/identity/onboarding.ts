export type IdentityCreationStep =
  | "username"
  | "password"
  | "digital-backups"
  | "recovery-document"
  | "qr-practice"
  | "file-word-practice"
  | "storage";

export const identityCreationSteps: readonly IdentityCreationStep[] = [
  "username",
  "password",
  "digital-backups",
  "recovery-document",
  "qr-practice",
  "file-word-practice",
  "storage",
];

export const identityCreationProgress = [30, 42, 54, 66, 78, 90, 100] as const;

export interface BackupCompletion {
  qrDownloaded: boolean;
  recoveryFileDownloaded: boolean;
  qrStored: boolean;
  recoveryFileStored: boolean;
}

export interface RecoveryPracticeState {
  qrVerified: boolean;
  recoveryFileVerified: boolean;
  recoveryWordsVerified: boolean;
  failedWordSubmissions: number;
}

export type PrintableVaultPasswordError =
  "empty" | "surrounding-space" | "non-ascii" | "too-long";

export function validatePrintableVaultPassword(
  value: string,
): PrintableVaultPasswordError | null {
  if (value.length === 0) return "empty";
  if (value.startsWith(" ") || value.endsWith(" ")) {
    return "surrounding-space";
  }
  if (!/^[\x20-\x7e]+$/u.test(value)) return "non-ascii";
  if (new TextEncoder().encode(value).byteLength > 256) return "too-long";
  return null;
}

export function chooseRecoveryWordPositions(random: Uint8Array): number[] {
  const positions: number[] = [];
  for (const value of random) {
    const position = value % 24;
    if (!positions.includes(position)) positions.push(position);
    if (positions.length === 4) break;
  }
  for (let position = 0; positions.length < 4; position += 1) {
    if (!positions.includes(position)) positions.push(position);
  }
  return positions.sort((left, right) => left - right);
}

export function normalizeRecoveryWordAnswer(value: string): string | null {
  const normalized = value.normalize("NFKD").trim().toLowerCase();
  if (normalized === "" || /\s/u.test(normalized)) return null;
  return normalized;
}
