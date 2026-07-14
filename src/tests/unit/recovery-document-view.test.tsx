import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecoveryPdfPreview } from "../../flows/identity/recovery-document";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("recovery print view", () => {
  it.each([
    ["desktop", false, 1],
    ["mobile", true, 0],
  ] as const)(
    "uses one generated PDF preview on %s",
    (_label, mobile, expectedFrames) => {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: vi.fn(() => ({
          matches: mobile,
          media: "(max-width: 640px)",
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      render(
        <RecoveryPdfPreview
          bytes={new Uint8Array([37, 80, 68, 70])}
          filename="recovery.pdf"
          locale="en"
          onPrint={vi.fn()}
          onDownload={vi.fn()}
        />,
      );

      expect(
        screen.queryAllByTitle("Private recovery PDF preview"),
      ).toHaveLength(expectedFrames);
      expect(
        screen.getByRole("link", { name: "Print / Save as PDF" }),
      ).not.toBeNull();
      expect(
        screen.getByRole("button", { name: "Download recovery PDF" }),
      ).not.toBeNull();
    },
  );

  it("uses byte-identical blobs for preview and download", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: "(max-width: 640px)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    const createUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:preview")
      .mockReturnValueOnce("blob:download");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
    render(
      <RecoveryPdfPreview
        bytes={bytes}
        filename="recovery.pdf"
        locale="en"
        onPrint={vi.fn()}
        onDownload={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Download recovery PDF" }),
    );
    const previewBlob = createUrl.mock.calls[0]?.[0] as Blob;
    const downloadBlob = createUrl.mock.calls[1]?.[0] as Blob;
    expect(new Uint8Array(await previewBlob.arrayBuffer())).toEqual(bytes);
    expect(new Uint8Array(await downloadBlob.arrayBuffer())).toEqual(bytes);
  });
});
