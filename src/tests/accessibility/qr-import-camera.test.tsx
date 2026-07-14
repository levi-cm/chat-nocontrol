import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QrImport } from "../../components/qr/import";

const labels: Record<string, string> = {
  scanQrTitle: "Scan a QR code",
  qrImage: "QR image",
  scanWithCamera: "Scan with camera",
  stopCamera: "Stop camera",
  cameraPreview: "QR camera preview",
  cameraInsecureContext:
    "Open the HTTPS URL to use the camera, or upload the saved QR image.",
  cameraPermissionDenied:
    "Camera permission was denied. Allow it in browser settings or upload the saved QR image.",
  cameraNotFound:
    "No camera was found. Connect a camera or upload the saved QR image.",
  cameraBusy:
    "The camera is busy in another app. Close it there or upload the saved QR image.",
  cameraUnavailable:
    "The camera could not start. Try again or upload the saved QR image.",
};

const germanLabels: Record<string, string> = {
  ...labels,
  cameraInsecureContext:
    "Öffne die HTTPS-URL für die Kamera oder lade das gespeicherte QR-Bild hoch.",
  cameraPermissionDenied:
    "Der Kamerazugriff wurde abgelehnt. Erlaube ihn in den Browser-Einstellungen oder lade das gespeicherte QR-Bild hoch.",
  cameraNotFound:
    "Keine Kamera gefunden. Schließe eine Kamera an oder lade das gespeicherte QR-Bild hoch.",
  cameraBusy:
    "Die Kamera wird von einer anderen App verwendet. Schließe sie dort oder lade das gespeicherte QR-Bild hoch.",
  cameraUnavailable:
    "Die Kamera konnte nicht gestartet werden. Versuche es erneut oder lade das gespeicherte QR-Bild hoch.",
};

const secureContextDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "isSecureContext",
);
const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "mediaDevices",
);

beforeEach(() => {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn() },
  });
});

afterEach(() => {
  cleanup();
  if (secureContextDescriptor) {
    Object.defineProperty(window, "isSecureContext", secureContextDescriptor);
  } else {
    Reflect.deleteProperty(window, "isSecureContext");
  }
  if (mediaDevicesDescriptor) {
    Object.defineProperty(navigator, "mediaDevices", mediaDevicesDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "mediaDevices");
  }
});

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

  it("explains insecure camera context while preserving file upload", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    const createScanner = vi.fn();
    render(
      <QrImport
        idPrefix="insecure"
        t={(key) => labels[key] ?? key}
        onDecoded={vi.fn()}
        createScanner={createScanner}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Scan with camera" }),
    );
    expect(createScanner).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Open the HTTPS URL to use the camera, or upload the saved QR image.",
      ),
    ).not.toBeNull();
    expect(screen.getByLabelText("QR image")).not.toBeNull();
  });

  it.each([
    [
      "NotAllowedError",
      "Camera permission was denied. Allow it in browser settings or upload the saved QR image.",
    ],
    [
      "NotFoundError",
      "No camera was found. Connect a camera or upload the saved QR image.",
    ],
    [
      "NotReadableError",
      "The camera is busy in another app. Close it there or upload the saved QR image.",
    ],
    [
      "UnknownError",
      "The camera could not start. Try again or upload the saved QR image.",
    ],
  ])("maps %s to distinct guidance", async (name, expected) => {
    const createScanner = vi.fn(() =>
      Promise.resolve({
        decodeFromVideoDevice: vi.fn(() =>
          Promise.reject(new DOMException("camera failed", name)),
        ),
      }),
    );
    render(
      <QrImport
        idPrefix={`error-${name}`}
        t={(key) => labels[key] ?? key}
        onDecoded={vi.fn()}
        createScanner={createScanner}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Scan with camera" }),
    );
    expect(await screen.findByText(expected)).not.toBeNull();
    expect(screen.getByLabelText("QR image")).not.toBeNull();
  });

  it("provides equivalent German camera guidance", async () => {
    const createScanner = vi.fn(() =>
      Promise.resolve({
        decodeFromVideoDevice: vi.fn(() =>
          Promise.reject(new DOMException("abgelehnt", "NotAllowedError")),
        ),
      }),
    );
    render(
      <QrImport
        idPrefix="camera-de"
        t={(key) => germanLabels[key] ?? key}
        onDecoded={vi.fn()}
        createScanner={createScanner}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Scan with camera" }),
    );
    expect(
      await screen.findByText(
        "Der Kamerazugriff wurde abgelehnt. Erlaube ihn in den Browser-Einstellungen oder lade das gespeicherte QR-Bild hoch.",
      ),
    ).not.toBeNull();
  });
});
