import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdentityImport } from "../../flows/identity/import";
import type { MessageKey } from "../../i18n";

const labels: Partial<Record<MessageKey, string>> = {
  importIdentity: "Import identity",
  recoveryWordsTitle: "24 recovery words",
  pseudonym: "Pseudonym",
  recoveryFile: "Private recovery file",
  selectedFile: "Selected file",
  importFile: "Import private file",
  recoveryHint: "Dangerous PPXR",
  recoveryImportWarning: "Unencrypted recovery",
  vaultWarning: "Encrypted vault",
  passphrase: "Vault passphrase",
  passphraseHint: "Passphrase hint",
  importScannedQr: "Import scanned QR",
  importError: "Could not import this identity",
  importErrorSummaryTitle: "Check identity import",
  back: "Back",
  scanQrTitle: "Scan a QR code",
  qrImage: "QR image",
  scanWithCamera: "Scan with camera",
  cameraPreview: "Camera preview",
};

afterEach(cleanup);

describe("private-file selection ownership", () => {
  it("ignores a slow stale file after a newer file wins", async () => {
    let resolveFirst: ((magic: string) => void) | undefined;
    const readMagic = vi.fn((file: File) => {
      if (file.name === "first.ppxrecovery") {
        return new Promise<string>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve("PPXV");
    });
    render(
      <IdentityImport
        t={(key) => labels[key] ?? key}
        onBack={vi.fn()}
        onReady={vi.fn()}
        readPrivateFileMagic={readMagic}
      />,
    );
    const input = screen.getByLabelText("Private recovery file");
    await userEvent.upload(
      input,
      new File(["first"], "first.ppxrecovery", {
        type: "application/x-ppx-recovery",
      }),
    );
    await userEvent.upload(
      input,
      new File(["second"], "second.ppxvault", {
        type: "application/x-ppx-vault",
      }),
    );
    await screen.findByText("Selected file: second.ppxvault");
    resolveFirst?.("PPXR");
    await waitFor(() =>
      expect(screen.queryByText("Selected file: first.ppxrecovery")).toBeNull(),
    );
    expect(screen.getByText("Encrypted vault")).not.toBeNull();
    expect(screen.queryByText("Unencrypted recovery")).toBeNull();
  });

  it("announces and focuses a generic import failure", async () => {
    render(
      <IdentityImport
        t={(key) => labels[key] ?? key}
        onBack={vi.fn()}
        onReady={vi.fn()}
        readPrivateFileMagic={vi.fn().mockResolvedValue("NOPE")}
      />,
    );

    await userEvent.upload(
      screen.getByLabelText("Private recovery file"),
      new File(["NOPE"], "invalid.ppxrecovery", {
        type: "application/x-ppx-recovery",
      }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Check identity import");
    expect(alert.textContent).toContain("Could not import this identity");
    await waitFor(() => expect(document.activeElement).toBe(alert));
  });
});
