import type { DiagnosticsReport } from "./report";
import { formatDiagnosticsReport } from "./report";
import { sanitizeDiagnosticText } from "./sanitize";

export function buildIssueDraftUrl(
  report: DiagnosticsReport,
  repositoryUrl?: string,
): string | null {
  if (!repositoryUrl) return null;
  const base = repositoryUrl.replace(/\/$/u, "");
  const issueSafeReport: DiagnosticsReport = {
    ...report,
    sanitizedErrors: report.sanitizedErrors.map(sanitizeDiagnosticText),
  };
  const body = `## Diagnostics\n\n\`\`\`json\n${formatDiagnosticsReport(issueSafeReport)}\n\`\`\``;
  return `${base}/issues/new?title=${encodeURIComponent("Chat NoControl diagnostics")}&body=${encodeURIComponent(body)}`;
}
