import { describe, expect, it } from "vitest";
import { createDiagnosticsReport } from "../../diagnostics/report";
import { sanitizeDiagnosticText } from "../../diagnostics/sanitize";

describe("sanitized local diagnostics", () => {
  it("removes private PPX material and fingerprints before issue review", () => {
    const report = createDiagnosticsReport({
      locale: "en",
      storageMode: "session-only",
      errors: ["PPX1:RECOVERY:SECRET", `sender ${"ab".repeat(32)}`],
    });

    expect(report.appVersion).toBe("Chat NoControl 0.1.0-beta.1");
    expect(report.sanitizedErrors).toEqual([
      "[sensitive PPX material removed]",
      "sender [fingerprint removed]",
    ]);
  });

  it.each([
    "Failed to open https://levi-cm.github.io/chat-nocontrol/#/decrypt/qr/ABC123",
    "Failed to open https://levi-cm.github.io/chat-nocontrol/#/m/UFBYVAECAwQ",
    "Parser rejected PPX1:MESSAGE:TOP-SECRET",
    `Decode failed for ${"Ab0_-".repeat(80)}`,
    new Error(
      "Navigation failed: https://levi-cm.github.io/chat-nocontrol/#/m/UFBYVAECAwQ",
    ).toString(),
  ])("removes encrypted message transport from diagnostic %s", (value) => {
    expect(sanitizeDiagnosticText(value)).toBe(
      "[sensitive PPX material removed]",
    );
  });

  it("keeps benign diagnostics useful", () => {
    expect(
      sanitizeDiagnosticText("Clipboard permission denied at decrypt"),
    ).toBe("Clipboard permission denied at decrypt");
  });
});
