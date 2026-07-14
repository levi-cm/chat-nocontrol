import type { Locale } from "../../i18n";

export interface RecoveryArtifactModel {
  locale: Locale;
  username: string;
  localizedDate: string;
  isoDate: string;
  recoveryCode: string;
  words: readonly string[];
  password: string;
  passwordLength: number;
  qrDataUrl: string;
  usernameImageDataUrl?: string;
}

export type RecoveryDocumentModel = RecoveryArtifactModel;

export const privateRecoveryCardLayout = {
  width: 1024,
  height: 1280,
  border: { x: 36, y: 36, width: 952, height: 1208, lineWidth: 12 },
  header: { x: 60, y: 60, width: 904, height: 180 },
  headerText: {
    username: { x: 72, y: 64, width: 880, height: 54, baseline: 91 },
    title: { x: 72, y: 122, width: 880, height: 58, baseline: 151 },
    warning: { x: 72, y: 184, width: 880, height: 44, baseline: 206 },
  },
  qrTop: 256,
  qrSize: 768,
  footerBaseline: 1130,
  dark: "#7f1d1d",
  light: "#ffffff",
} as const;

interface RecoveryDocumentInput {
  locale: Locale;
  username: string;
  creationTime: bigint;
  recoveryCode: string;
  words: readonly string[];
  password: string;
  qrDataUrl: string;
  usernameImageDataUrl?: string;
}

export function createRecoveryDocumentModel(
  input: RecoveryDocumentInput,
): RecoveryDocumentModel {
  if (input.words.length !== 24) {
    throw new Error("A recovery document requires exactly 24 words");
  }
  const date = new Date(Number(input.creationTime) * 1000);
  const isoDate = date.toISOString().slice(0, 10);
  return {
    locale: input.locale,
    username: input.username,
    localizedDate: new Intl.DateTimeFormat(
      input.locale === "de" ? "de-DE" : "en-GB",
      { dateStyle: "long", timeZone: "UTC" },
    ).format(date),
    isoDate,
    recoveryCode: input.recoveryCode,
    words: [...input.words],
    password: input.password,
    passwordLength: input.password.length,
    qrDataUrl: input.qrDataUrl,
    usernameImageDataUrl: input.usernameImageDataUrl,
  };
}

export function splitPrintablePassword(
  value: string,
  maximumLineLength = 64,
): string[] {
  if (maximumLineLength < 1) throw new Error("Invalid password line length");
  const lines: string[] = [];
  for (let offset = 0; offset < value.length; offset += maximumLineLength) {
    lines.push(value.slice(offset, offset + maximumLineLength));
  }
  return lines;
}

export function recoveryArtifactFilename(
  username: string,
  isoDate: string,
  extension: "pdf" | "png" | "ppxrecovery",
): string {
  const safeUsername = username
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 48);
  const owner = safeUsername || "identity";
  return `chat-nocontrol-${owner}-recovery-${isoDate}.${extension}`;
}
