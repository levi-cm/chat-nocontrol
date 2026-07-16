import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app/App";
import { syncThemeColor } from "../../app/bootstrap";
import indexHtml from "../../../index.html?raw";
import manifestText from "../../../public/manifest.webmanifest?raw";

describe("app shell", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.location.hash = "";
    localStorage.clear();
    document.documentElement.lang = "";
  });

  it("starts new users on identity setup with accessible primary actions", async () => {
    render(<App />);
    expect(
      await screen.findByRole("heading", {
        name: "Create identity or import identity",
      }),
    ).not.toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Create new identity",
      }).disabled,
    ).toBe(false);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Import identity" })
        .disabled,
    ).toBe(false);
    expect(screen.getByRole("navigation", { name: "Primary" })).not.toBeNull();
  });

  it("scrubs malformed incoming intent into a safe dismissible error", async () => {
    window.location.hash = "#/decrypt";
    render(<App initialIncomingIntent={{ kind: "invalid" }} />);

    expect(
      await screen.findByRole("heading", { name: "Open encrypted message" }),
    ).not.toBeNull();
    expect(
      screen.getByText(
        "This encrypted message link is invalid, incomplete, or too large.",
      ),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Import identity" }),
    ).toBeNull();
  });

  it("uses the supplied Chat NoControl logo in the app header", () => {
    const { container } = render(<App />);
    const logo = container.querySelector<HTMLImageElement>("img.brand-logo");

    expect(logo?.getAttribute("src")).toBe("./icons/app-logo-512.png");
    expect(logo?.getAttribute("alt")).toBe("");
  });

  it("switches all shell copy and document language to German", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("link", { name: "Open settings" }),
    );
    await user.selectOptions(screen.getByLabelText("Language"), "de");
    expect(document.documentElement.lang).toBe("de");
    await user.click(screen.getByRole("link", { name: "Chat NoControl" }));
    expect(
      await screen.findByRole("heading", {
        name: "Identität erstellen oder importieren",
      }),
    ).not.toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Neue Identität erstellen",
      }).disabled,
    ).toBe(false);
  });

  it("routes to Help without a network-backed router", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("link", { name: "Help" }));
    expect(window.location.hash).toBe("#/help");
    expect(
      screen.getByRole("heading", { name: "Help", exact: true }),
    ).not.toBeNull();
  });

  it("keeps message QR creation off until the user opts in", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("link", { name: "Open settings" }),
    );

    const creationToggle = screen.getByRole<HTMLInputElement>("checkbox", {
      name: /^Offer message QR after text encryption/u,
    });
    expect(creationToggle.checked).toBe(false);
    expect(screen.queryByLabelText("Export")).toBeNull();

    await user.click(creationToggle);
    expect(creationToggle.checked).toBe(true);
    expect(screen.getByLabelText("Export")).not.toBeNull();

    await user.selectOptions(screen.getByLabelText("Language"), "de");
    expect(
      screen.getByRole("checkbox", {
        name: /^Nachrichten-QR nach Textverschlüsselung anbieten/u,
      }),
    ).not.toBeNull();
  });

  it("keeps scripts self-only while permitting only the local PDF frame", () => {
    const content = indexHtml.match(
      /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/u,
    )?.[1];

    expect(content).toContain("script-src 'self'");
    expect(content).not.toContain("'unsafe-inline'");
    expect(content).not.toMatch(/'nonce-|sha(?:256|384|512)-/u);
    expect(content).toContain("frame-src 'self' blob:");
    expect(content).not.toMatch(/frame-src[^;]*(?:https?:|data:)/u);
  });

  it("prevents encrypted-link referrer disclosure", () => {
    expect(indexHtml).toMatch(
      /<meta\s+name="referrer"\s+content="no-referrer"\s*\/?>/u,
    );
  });

  it("uses canvas colors for installed and live system chrome", () => {
    const manifest = JSON.parse(manifestText) as {
      background_color: string;
      theme_color: string;
    };
    expect(manifest.background_color).toBe("#f5f7fb");
    expect(manifest.theme_color).toBe("#f5f7fb");

    document.head.innerHTML = '<meta name="theme-color" content="#000000">';
    expect(syncThemeColor("dark", document, false)).toBe("#0e1118");
    expect(
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.content,
    ).toBe("#0e1118");
    expect(syncThemeColor("light", document, true)).toBe("#f5f7fb");
  });
});
