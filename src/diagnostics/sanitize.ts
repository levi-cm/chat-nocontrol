const SECRET_MARKERS = ["BEGIN PPX", "PPX1:PRIVATE:", "PPX1:RECOVERY:"];

export function sanitizeDiagnosticText(value: string): string {
  if (SECRET_MARKERS.some((marker) => value.includes(marker))) {
    return "[sensitive PPX material removed]";
  }
  return value
    .replaceAll(/\b[0-9a-f]{40,}\b/giu, "[fingerprint removed]")
    .slice(0, 2_000);
}
