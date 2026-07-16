const SECRET_MARKERS = [
  "BEGIN PPX",
  "PPX1:PRIVATE:",
  "PPX1:RECOVERY:",
  "PPX1:MESSAGE:",
  "#/decrypt/qr/",
  "#/m/",
];

const LIKELY_ENCRYPTED_LINK_PAYLOAD = /[A-Za-z0-9_-]{256,}/u;

export function sanitizeDiagnosticText(value: string): string {
  if (
    SECRET_MARKERS.some((marker) => value.includes(marker)) ||
    LIKELY_ENCRYPTED_LINK_PAYLOAD.test(value)
  ) {
    return "[sensitive PPX material removed]";
  }
  return value
    .replaceAll(/\b[0-9a-f]{40,}\b/giu, "[fingerprint removed]")
    .slice(0, 2_000);
}
