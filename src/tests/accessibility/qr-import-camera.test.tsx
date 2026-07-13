import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QrImport } from "../../components/qr/import";
import type { MessageKey } from "../../i18n";

const labels: Partial<Record<MessageKey, string>> = {
  scanQrTitle: "Scan a QR code",
  qrImage: "QR image",
  scanWithCamera: "Scan with camera",
  stopCamera: "Stop camera",
  cameraPreview: "QR camera preview",
};

afterEach(cleanup);

describe("QR camera import", () => {
  it("starts only after explicit activation and stops its scanner control", async () => {
    const stop = vi.fn();
    const createScanner = vi.fn(() =>
      Promise.resolve({
        decodeFromVideoDevice: vi.fn(() => Promise.resolve({ stop })),
      }),
    );
    render(
      <QrImport
        idPrefix="test"
        t={(key) => labels[key] ?? key}
        onDecoded={vi.fn()}
        createScanner={createScanner}
      />,
    );

    expect(createScanner).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Scan with camera" }),
    );
    await waitFor(() => expect(createScanner).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Stop camera" }));
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("stops a scanner that resolves after the user cancels startup", async () => {
    let resolveControls: ((value: { stop(): void }) => void) | undefined;
    const stop = vi.fn();
    const createScanner = vi.fn(() =>
      Promise.resolve({
        decodeFromVideoDevice: vi.fn(
          () =>
            new Promise<{ stop(): void }>((resolve) => {
              resolveControls = resolve;
            }),
        ),
      }),
    );
    render(
      <QrImport
        idPrefix="delayed"
        t={(key) => labels[key] ?? key}
        onDecoded={vi.fn()}
        createScanner={createScanner}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Scan with camera" }),
    );
    await waitFor(() => expect(resolveControls).toBeTypeOf("function"));
    await userEvent.click(screen.getByRole("button", { name: "Stop camera" }));
    resolveControls?.({ stop });
    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Scan with camera",
      }).disabled,
    ).toBe(false);
  });

  it("ignores a stale QR file result", async () => {
    const resolvers: Array<(value: string) => void> = [];
    const decoded = vi.fn();
    render(
      <QrImport
        idPrefix="files"
        t={(key) => labels[key] ?? key}
        onDecoded={decoded}
        classifyPayload={() => Promise.resolve("public-contact")}
        scanFilePayload={() =>
          new Promise<string>((resolve) => resolvers.push(resolve))
        }
      />,
    );
    const input = screen.getByLabelText("QR image");
    await userEvent.upload(
      input,
      new File(["first"], "first.png", { type: "image/png" }),
    );
    await userEvent.upload(
      input,
      new File(["second"], "second.png", { type: "image/png" }),
    );
    resolvers[1]?.("second");
    await waitFor(() => expect(decoded).toHaveBeenCalledWith("second"));
    resolvers[0]?.("first");
    await Promise.resolve();
    expect(decoded).toHaveBeenCalledTimes(1);
  });
});
