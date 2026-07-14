import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import appSource from "../../app/App.tsx?raw";
import createSource from "../../flows/identity/create.tsx?raw";

describe("approved UI change request", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.location.hash = "";
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-accent");
    document.documentElement.removeAttribute("data-translucency");
  });

  it("keeps language, theme, accent, and translucent effects in Settings", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole("link", { name: "Open settings" }),
    );
    expect(
      screen.getByRole("heading", { name: "Settings", exact: true }),
    ).not.toBeNull();
    expect(screen.getByLabelText("Language")).not.toBeNull();
    await user.selectOptions(screen.getByLabelText("Theme"), "dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.selectOptions(screen.getByLabelText("Accent color"), "purple");
    expect(document.documentElement.dataset.accent).toBe("purple");
    await user.click(
      screen.getByRole("checkbox", {
        name: /Translucent interface effects/u,
      }),
    );
    expect(document.documentElement.dataset.translucency).toBe("off");
  });

  it("uses real icons in primary navigation while keeping accessible names", async () => {
    render(<App />);
    await screen.findByRole("navigation", { name: "Primary" });
    expect(document.querySelectorAll(".nav-link .nav-icon svg")).toHaveLength(
      5,
    );
    expect(screen.getByRole("link", { name: "Encrypt" })).not.toBeNull();
  });

  it("offers an explicit Paste action on the contact text input", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue("PPX text") },
    });
    window.location.hash = "#/contacts";
    render(<App />);
    expect(await screen.findByRole("button", { name: "Paste" })).not.toBeNull();
  });

  it("does not show the removed generic public-beta sentence", async () => {
    window.location.hash = "#/help";
    render(<App />);
    await screen.findByRole("heading", { name: "Help", exact: true });
    expect(
      screen.queryByText(
        "Public beta software. Stable security is not claimed.",
      ),
    ).toBeNull();
  });

  it("keeps storage and unlocked identity content in explicit layout flows", () => {
    expect(createSource).toContain('class="flow-panel storage-flow"');
    expect(appSource).toContain('"identity-page"');
    expect(appSource).toContain('class="identity-exports"');
    expect(appSource).toContain('class="local-data-toolbar"');
    expect(appSource.indexOf('class="identity-exports"')).toBeLessThan(
      appSource.indexOf('class="local-data-toolbar"'),
    );
  });
});
