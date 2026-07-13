import { describe, expect, it } from "vitest";
import { createDiagnosticsReport } from "../../diagnostics/report";

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
});
