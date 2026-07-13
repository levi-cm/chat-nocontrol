import type { DiagnosticsReport } from "./report";
import { formatDiagnosticsReport } from "./report";

export function buildIssueDraftUrl(
  report: DiagnosticsReport,
  repositoryUrl?: string,
): string | null {
  if (!repositoryUrl) return null;
  const base = repositoryUrl.replace(/\/$/u, "");
  const body = `## Diagnostics\n\n\`\`\`json\n${formatDiagnosticsReport(report)}\n\`\`\``;
  return `${base}/issues/new?title=${encodeURIComponent("Chat NoControl diagnostics")}&body=${encodeURIComponent(body)}`;
}
