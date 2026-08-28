import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { lockVault } from "../../crypto/vault";
import { IdentityImport } from "../../flows/identity/import";
import { encodeBase45Upper } from "../../protocol/base45";
import { encodeRecoveryObject } from "../../protocol/ppxr";
import { encodeLockedVault } from "../../protocol/ppxv";

const qrState = vi.hoisted(() => ({ value: "" }));

vi.mock("../../components/qr/import", () => ({
  QrImport: ({ onDecoded }: { onDecoded: (value: string) => void }) => (
    <button type="button" onClick={() => onDecoded(qrState.value)}>
      scan legacy QR
    </button>
  ),
}));

const labels = {
  importScannedQr: "Import scanned QR",
  passphrase: "Vault passphrase",
} as const;

afterEach(() => {
  cleanup();
  qrState.value = "";
});

describe("legacy V1 private QR migration routing", () => {
  it("routes a V1 PPXR QR through recovery migration", async () => {
    const entropy = new Uint8Array(32).fill(24);
    const payload = encodeRecoveryObject({
      magic: "PPXR",
      formatVersion: 1,
      suite: 1,
      flags: 0,
      masterEntropy: entropy,
      creationTime: 24n,
      pseudonym: "QR Recovery",
      checksum: new Uint8Array(16),
    });
    qrState.value = `PPX1:RECOVERY:${encodeBase45Upper(payload)}`;
    const expected = await deriveIdentityV2FromEntropy(
      entropy,
      "QR Recovery",
      24n,
    );
    const onReady = vi.fn();
    const migrate = vi.fn((bytes: Uint8Array) => {
      void bytes;
      return {
        requestId: "qr-recovery",
        promise: Promise.resolve(expected),
        cancel: vi.fn(),
      };
    });
    render(
      <IdentityImport
        t={(key) => labels[key as keyof typeof labels] ?? key}
        onBack={vi.fn()}
        onReady={onReady}
        legacyRecoveryMigrationJobFactory={migrate}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "scan legacy QR" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Import scanned QR" }),
    );

    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    expect(migrate).toHaveBeenCalledOnce();
    expect(onReady.mock.calls[0]?.[0]).toMatchObject({
      suite: 2,
      pseudonym: "QR Recovery",
      creationTime: 24n,
    });
  });

  it("routes a V1 PPXV QR through password-gated vault migration", async () => {
    const passphrase = "five random words make safer vaults";
    const legacy = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(25),
      "QR Vault",
      25n,
    );
    const payload = encodeLockedVault(
      await lockVault({ identity: legacy, passphrase }),
    );
    qrState.value = `PPX1:PRIVATE:${encodeBase45Upper(payload)}`;
    const expected = await deriveIdentityV2FromEntropy(
      legacy.masterEntropy,
      legacy.pseudonym,
      legacy.creationTime,
    );
    const onReady = vi.fn();
    const migrate = vi.fn(
      (input: { bytes: Uint8Array; passphrase: string }) => {
        void input;
        return {
          requestId: "qr-vault",
          promise: Promise.resolve(expected),
          cancel: vi.fn(),
        };
      },
    );
    render(
      <IdentityImport
        t={(key) => labels[key as keyof typeof labels] ?? key}
        onBack={vi.fn()}
        onReady={onReady}
        legacyVaultMigrationJobFactory={migrate}
      />,
    );

    await userEvent.type(screen.getByLabelText("Vault passphrase"), passphrase);
    await userEvent.click(
      screen.getByRole("button", { name: "scan legacy QR" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Import scanned QR" }),
    );

    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    expect(migrate).toHaveBeenCalledOnce();
    expect(migrate.mock.calls[0]?.[0].passphrase).toBe(passphrase);
    expect(onReady.mock.calls[0]?.[0]).toMatchObject({
      suite: 2,
      pseudonym: "QR Vault",
      creationTime: 25n,
    });
  });
});
