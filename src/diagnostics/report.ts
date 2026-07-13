export interface DiagnosticsReport {
  appVersion: string;
  locale: "en" | "de";
  storageMode: "persistent" | "session-only";
  capabilities: string[];
  sanitizedErrors: string[];
}

export function createDiagnosticsReport(input: {
  locale: "en" | "de";
  storageMode: "persistent" | "session-only";
  errors?: string[];
}): DiagnosticsReport {
  const capabilities = [
    `WebCrypto:${String(Boolean(globalThis.crypto?.subtle))}`,
    `IndexedDB:${String("indexedDB" in globalThis)}`,
    `ServiceWorker:${String("serviceWorker" in navigator)}`,
  ];
  return {
    appVersion: `Chat NoControl ${CHAT_NOCONTROL_VERSION}`,
    locale: input.locale,
    storageMode: input.storageMode,
    capabilities,
    sanitizedErrors: (input.errors ?? []).map((error) =>
      sanitizeDiagnosticText(error).slice(0, 160),
    ),
  };
}

export function formatDiagnosticsReport(report: DiagnosticsReport): string {
  return JSON.stringify(report, null, 2);
}
import { CHAT_NOCONTROL_VERSION } from "../app/build-info";
import { sanitizeDiagnosticText } from "./sanitize";
