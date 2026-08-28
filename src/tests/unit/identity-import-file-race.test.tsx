import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { migrateLegacyRecoveryV1 } from "../../crypto/legacy-v1-reader";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { lockVault } from "../../crypto/vault";
import { IdentityImport } from "../../flows/identity/import";
import type { MessageKey } from "../../i18n";
import { encodeRecoveryObject } from "../../protocol/ppxr";
import { encodeLockedVault } from "../../protocol/ppxv";

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
  it("accepts a legacy V1 recovery file and migrates it to V2", async () => {
    const onReady = vi.fn();
    const entropy = new Uint8Array(32).fill(17);
    const bytes = encodeRecoveryObject({
      magic: "PPXR",
      formatVersion: 1,
      suite: 1,
      flags: 0,
      masterEntropy: entropy,
      creationTime: 17n,
      pseudonym: "Legacy Alice",
      checksum: new Uint8Array(16),
    });
    render(
      <IdentityImport
        t={(key) => labels[key] ?? key}
        onBack={vi.fn()}
        onReady={onReady}
        legacyRecoveryMigrationJobFactory={(ownedBytes) => ({
          requestId: "test-legacy-recovery",
          promise: migrateLegacyRecoveryV1(ownedBytes),
          cancel: vi.fn(),
        })}
      />,
    );

    await userEvent.upload(
      screen.getByLabelText("Private recovery file"),
      new File([bytes.slice().buffer], "v1.ppxrecovery", {
        type: "application/x-ppx-recovery",
      }),
    );

    expect(
      await screen.findByText("Selected file: v1.ppxrecovery"),
    ).not.toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Import private file" }),
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    expect(onReady.mock.calls[0]?.[0]).toMatchObject({
      suite: 2,
      pseudonym: "Legacy Alice",
      creationTime: 17n,
    });
  });

  it("routes a legacy V1 vault file through the isolated migration worker", async () => {
    const passphrase = "five random words make safer vaults";
    const legacy = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(18),
      "Legacy Vault Alice",
      18n,
    );
    const expected = await deriveIdentityV2FromEntropy(
      legacy.masterEntropy,
      legacy.pseudonym,
      legacy.creationTime,
    );
    const vaultBytes = encodeLockedVault(
      await lockVault({ identity: legacy, passphrase }),
    );
    const onReady = vi.fn();
    let receivedPassphrase = "";
    let receivedBytes: Uint8Array | undefined;
    render(
      <IdentityImport
        t={(key) => labels[key] ?? key}
        onBack={vi.fn()}
        onReady={onReady}
        legacyVaultMigrationJobFactory={(input) => {
          receivedPassphrase = input.passphrase;
          receivedBytes = Uint8Array.from(input.bytes);
          return {
            requestId: "test-legacy-vault",
            promise: Promise.resolve(expected),
            cancel: vi.fn(),
          };
        }}
      />,
    );

    await userEvent.upload(
      screen.getByLabelText("Private recovery file"),
      new File([vaultBytes.slice().buffer], "v1.ppxvault", {
        type: "application/x-ppx-vault",
      }),
    );
    await userEvent.type(screen.getByLabelText("Vault passphrase"), passphrase);
    await userEvent.click(
      screen.getByRole("button", { name: "Import private file" }),
    );

    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    expect(receivedPassphrase).toBe(passphrase);
    expect(receivedBytes).toEqual(vaultBytes);
    expect(onReady.mock.calls[0]?.[0]).toMatchObject({
      suite: 2,
      pseudonym: "Legacy Vault Alice",
      creationTime: 18n,
    });
  });

  it("ignores a slow stale file after a newer file wins", async () => {
    let resolveFirst: ((magic: string) => void) | undefined;
    const readMagic = vi.fn((file: File) => {
      if (file.name === "first.ppxrecovery") {
        return new Promise<string>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve("PPXV\u0002\u0002");
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
    resolveFirst?.("PPXR\u0002\u0002");
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
