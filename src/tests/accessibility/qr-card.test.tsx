import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivateExportCard } from "../../components/cards/private-export-card";
import { PublicContactCard } from "../../components/cards/public-contact-card";

vi.mock("../../components/qr/generate", () => ({
  generateQrDataUrl: () => Promise.resolve("data:image/png;base64,AA=="),
}));

const visibilityStateDescriptor = Object.getOwnPropertyDescriptor(
  document,
  "visibilityState",
);

describe("QR card semantics", () => {
  afterEach(() => {
    cleanup();
    if (visibilityStateDescriptor) {
      Object.defineProperty(
        document,
        "visibilityState",
        visibilityStateDescriptor,
      );
    }
  });

  it("distinguishes public and private authority without color", async () => {
    const verifyPrivateExport = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    render(
      <main>
        <PublicContactCard
          pseudonym="Alice"
          qrText="PPX1:CONTACT:ABC"
          authorityLabel="Safe to share"
          title="Public contact"
          qrLabel="Public contact QR code"
          qrDownloadLabel="Save contact QR as PNG"
          enlargeQrLabel="Show larger QR"
          closeQrLabel="Close larger QR"
          identityId={new Uint8Array(20)}
          fingerprint={new Uint8Array(32)}
          identityIdLabel="Short identity ID"
          fingerprintLabel="Fingerprint"
          fingerprintGuidance="Verify through a trusted channel."
        />
        <PrivateExportCard
          title="Private recovery card"
          warning="Keep secret. Anyone with this can recover your identity."
          qrText="PPX1:RECOVERY:ABC"
          authorityLabel="Private secret"
          qrLabel="Private recovery QR code"
          qrDownloadLabel="Save private QR as PNG"
          fileBytes={new Uint8Array([1, 2, 3])}
          downloadLabel="Download encrypted vault"
          verification={{
            lockedLabel: "Private exports locked",
            passphraseLabel: "Re-enter vault passphrase",
            revealLabel: "Reveal private exports",
            busyLabel: "Checking password",
            errorLabel: "Password verification failed",
            onVerify: verifyPrivateExport,
          }}
        />
      </main>,
    );
    expect(
      screen.getByRole("heading", { name: "Public contact" }),
    ).not.toBeNull();
    expect(screen.getByText("Safe to share")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Keep secret");
    expect(await screen.findAllByRole("img")).toHaveLength(1);
    expect(
      screen.queryByRole("img", { name: "Private recovery QR code" }),
    ).toBeNull();
    expect(screen.getByText("Private exports locked")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Save contact QR as PNG" }),
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Save private QR as PNG" }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Show larger QR" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Public contact QR code" }),
    ).not.toBeNull();
    const closeLargerQr = screen.getByRole("button", {
      name: "Close larger QR",
    });
    expect(document.activeElement).toBe(closeLargerQr);
    await userEvent.tab();
    expect(document.activeElement).toBe(closeLargerQr);

    await userEvent.type(
      screen.getByLabelText("Re-enter vault passphrase"),
      "wrong password",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reveal private exports" }),
    );
    expect(
      await screen.findByText("Password verification failed"),
    ).not.toBeNull();
    expect(
      screen.queryByRole("img", { name: "Private recovery QR code" }),
    ).toBeNull();

    await userEvent.clear(screen.getByLabelText("Re-enter vault passphrase"));
    await userEvent.type(
      screen.getByLabelText("Re-enter vault passphrase"),
      "correct password",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reveal private exports" }),
    );
    expect(
      await screen.findByRole("img", { name: "Private recovery QR code" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Save private QR as PNG" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Download encrypted vault" }),
    ).not.toBeNull();
    expect(verifyPrivateExport).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() =>
      expect(
        screen.queryByRole("img", { name: "Private recovery QR code" }),
      ).toBeNull(),
    );
  });
});
