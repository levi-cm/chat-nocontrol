import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app/App";

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

  it("switches all shell copy and document language to German", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Language"), "de");
    expect(document.documentElement.lang).toBe("de");
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
});
