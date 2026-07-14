import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecoveryPrintView } from "../../flows/identity/recovery-document";
import { createRecoveryDocumentModel } from "../../flows/identity/recovery-artifacts";

afterEach(cleanup);

describe("recovery print view", () => {
  it("shows every private recovery representation and invokes printing", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const model = createRecoveryDocumentModel({
      locale: "en",
      username: "Alice",
      creationTime: 1_782_864_000n,
      recoveryCode: "PPX1:RECOVERY:ABC",
      words: Array.from({ length: 24 }, (_, index) => `word${index + 1}`),
      password: "Vault pass 123!",
      qrDataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
    });
    render(<RecoveryPrintView model={model} onBack={vi.fn()} />);

    expect(screen.getByText("Alice")).not.toBeNull();
    expect(screen.getByText("PPX1:RECOVERY:ABC")).not.toBeNull();
    expect(screen.getByText("Vault pass 123!")).not.toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(24);
    await userEvent.click(
      screen.getByRole("button", { name: "Print / Save as PDF" }),
    );
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });

  it.each([
    ["desktop", false, 1],
    ["mobile", true, 0],
  ] as const)(
    "uses one generated PDF preview on %s",
    async (_label, mobile, expectedFrames) => {
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
      const module = (await import(
        "../../flows/identity/recovery-document"
      )) as unknown as {
        RecoveryPdfPreview?: (props: {
          bytes: Uint8Array;
          filename: string;
          locale: "en" | "de";
          onPrint: () => void;
          onDownload: () => void;
        }) => preact.JSX.Element;
      };
      expect(module.RecoveryPdfPreview).toBeTypeOf("function");
      if (!module.RecoveryPdfPreview) return;
      const Preview = module.RecoveryPdfPreview;
      render(
        <Preview
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
});
