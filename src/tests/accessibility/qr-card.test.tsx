import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivateExportCard } from "../../components/cards/private-export-card";
import { PublicContactCard } from "../../components/cards/public-contact-card";

vi.mock("../../components/qr/generate", () => ({
  generateQrDataUrl: () => Promise.resolve("data:image/png;base64,AA=="),
}));

describe("QR card semantics", () => {
  afterEach(cleanup);

  it("distinguishes public and private authority without color", async () => {
    render(
      <main>
        <PublicContactCard
          pseudonym="Alice"
          qrText="PPX1:CONTACT:ABC"
          authorityLabel="Safe to share"
          title="Public contact"
          qrLabel="Public contact QR code"
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
        />
      </main>,
    );
    expect(
      screen.getByRole("heading", { name: "Public contact" }),
    ).not.toBeNull();
    expect(screen.getByText("Safe to share")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Keep secret");
    expect(await screen.findAllByRole("img")).toHaveLength(2);
  });
});
