import { describe, expect, it } from "vitest";
import { buildIssueDraftUrl } from "../../diagnostics/issue-link";
import {
  createDiagnosticsReport,
  formatDiagnosticsReport,
} from "../../diagnostics/report";
import { sanitizeDiagnosticText } from "../../diagnostics/sanitize";
import { encodeBase45Upper } from "../../protocol/base45";
import { PPXR_V2_MAXIMUM_BASE45_CHARS } from "../../protocol/ppxr-v2";
import { PPXV_V2_MAXIMUM_BASE45_CHARS } from "../../protocol/ppxv-v2";

describe("sanitized local diagnostics", () => {
  it("removes private PPX material and fingerprints before issue review", () => {
    const report = createDiagnosticsReport({
      locale: "en",
      storageMode: "session-only",
      errors: ["PPX1:RECOVERY:SECRET", `sender ${"ab".repeat(32)}`],
    });

    expect(report.appVersion).toBe("Chat NoControl 0.2.0-beta.1");
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

  it.each([
    "PPX1:MESSAGE:",
    "PPX2:MESSAGE:",
    "PPX1:FILE:",
    "PPX2:FILE:",
    "PPX1:RECOVERY:",
    "PPX2:RECOVERY:",
    "PPX1:PRIVATE:",
    "PPX2:PRIVATE:",
  ])("removes every V1/V2 private transport marker %s", (marker) => {
    const shortSecret = `${marker}A`;
    const longSecret = `${marker}${"Z".repeat(10_000)}`;

    expect(sanitizeDiagnosticText(shortSecret)).toBe(
      "[sensitive PPX material removed]",
    );
    expect(sanitizeDiagnosticText(longSecret)).toBe(
      "[sensitive PPX material removed]",
    );
  });

  it.each([
    "PPXT\u0001\u0001",
    "PPXT\u0002\u0001",
    "PPXT\u0002\u0002",
    "PPXQ\u0001\u0001",
    "PPXM\u0002\u0002",
    "PPXF\u0001\u0001",
    "PPXF\u0002\u0002",
    "PPXR\u0001\u0001",
    "PPXR\u0002\u0002",
    "PPXV\u0001\u0001",
    "PPXV\u0002\u0002",
  ])("removes V1/V2 private canonical object header %s", (header) => {
    expect(sanitizeDiagnosticText(`Parser rejected ${header}SECRET`)).toBe(
      "[sensitive PPX material removed]",
    );
  });

  it("removes full-size CAT5 recovery and private-vault text", () => {
    const recovery = `PPX2:RECOVERY:${"R".repeat(PPXR_V2_MAXIMUM_BASE45_CHARS)}`;
    const privateVault = `PPX2:PRIVATE:${"V".repeat(PPXV_V2_MAXIMUM_BASE45_CHARS)}`;
    const report = createDiagnosticsReport({
      locale: "en",
      storageMode: "session-only",
      errors: [recovery, privateVault],
    });

    expect(report.sanitizedErrors).toEqual([
      "[sensitive PPX material removed]",
      "[sensitive PPX material removed]",
    ]);
  });

  it("sanitizes issue-draft errors again before URL serialization", () => {
    const recovery = `PPX2:RECOVERY:${"R".repeat(PPXR_V2_MAXIMUM_BASE45_CHARS)}`;
    const privateVault = `PPX2:PRIVATE:${"V".repeat(PPXV_V2_MAXIMUM_BASE45_CHARS)}`;
    const report = createDiagnosticsReport({
      locale: "en",
      storageMode: "session-only",
    });
    report.sanitizedErrors = [recovery, privateVault];

    const issueUrl = buildIssueDraftUrl(
      report,
      "https://github.com/levi-cm/chat-nocontrol",
    );
    expect(issueUrl).not.toBeNull();
    const body = new URL(issueUrl ?? "https://invalid.test").searchParams.get(
      "body",
    );

    expect(body).not.toContain("PPX2:RECOVERY:");
    expect(body).not.toContain("PPX2:PRIVATE:");
    expect(body).not.toContain("R".repeat(32));
    expect(body).not.toContain("V".repeat(32));
    expect(body?.match(/\[sensitive PPX material removed\]/gu)).toHaveLength(2);
  });

  it.each([
    "ppx1:recovery:SECRET",
    "PpX2:PrIvAtE:SECRET",
    "PPX2%3APRIVATE%3ASECRET",
    "%23%2Fm%2FUFBYVAECAwQ",
    "PPXR\\u0001\\u0001SECRET",
    "-----begin ppx encrypted message-----",
  ])("removes normalized or escaped PPX material %s", (value) => {
    expect(sanitizeDiagnosticText(value)).toBe(
      "[sensitive PPX material removed]",
    );
  });

  it("removes common encodings of canonical PPX objects", () => {
    const recoveryHeader = Uint8Array.of(0x50, 0x50, 0x58, 0x52, 0x01, 0x01);
    const binary = String.fromCharCode(...recoveryHeader);
    const base64 = btoa(binary);
    const base45 = encodeBase45Upper(recoveryHeader);
    const hex = [...recoveryHeader]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const nodeBuffer = `<Buffer ${[...recoveryHeader]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(" ")}>`;

    for (const encoded of [base64, base45, hex, nodeBuffer]) {
      expect(sanitizeDiagnosticText(`Parser rejected ${encoded}`)).toBe(
        "[sensitive PPX material removed]",
      );
    }
  });

  it("redacts contact transports and canonical contact objects", () => {
    expect(sanitizeDiagnosticText("PPX2:CONTACT:PUBLIC-METADATA")).toBe(
      "[sensitive PPX material removed]",
    );
    expect(sanitizeDiagnosticText("PPXC\u0002\u0002PUBLIC-METADATA")).toBe(
      "[sensitive PPX material removed]",
    );
  });

  it("sanitizes every diagnostics serialization sink", () => {
    const report = createDiagnosticsReport({
      locale: "en",
      storageMode: "session-only",
    });
    report.appVersion = "PPX2:PRIVATE:SECRET";
    report.capabilities = ["PPX2%3ARECOVERY%3ASECRET"];
    report.sanitizedErrors = ["UFBYUQEBAgM="];

    const serialized = formatDiagnosticsReport(report);
    expect(serialized).not.toContain("SECRET");
    expect(serialized).not.toContain("UFBYUQEBAgM=");
    expect(
      serialized.match(/\[sensitive PPX material removed\]/gu),
    ).toHaveLength(3);
  });

  it("keeps benign diagnostics useful", () => {
    expect(
      sanitizeDiagnosticText("Clipboard permission denied at decrypt"),
    ).toBe("Clipboard permission denied at decrypt");
  });
});
