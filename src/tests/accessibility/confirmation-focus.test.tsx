import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "preact/hooks";
import { afterEach, describe, expect, it } from "vitest";
import { ConfirmationDialog } from "../../components/dialogs/confirmation";
import { messages } from "../../i18n";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open confirmation
      </button>
      {open && (
        <ConfirmationDialog
          t={(key) => messages.en[key]}
          title="Delete contact?"
          body="Delete local contact?"
          onCancel={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CustomReturnFocusHarness() {
  const [open, setOpen] = useState(false);
  const password = useRef<HTMLInputElement>(null);
  return (
    <>
      <label for="return-password">Password</label>
      <input id="return-password" ref={password} />
      <button type="button" onClick={() => setOpen(true)}>
        Review weak password
      </button>
      {open && (
        <ConfirmationDialog
          t={(key) => messages.en[key]}
          title="Use a weak password?"
          body="This password is weak."
          cancelLabel="Change password"
          returnFocus={() => password.current}
          confirmLabel="Use weak password"
          onCancel={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      )}
    </>
  );
}

describe("confirmation dialog focus", () => {
  afterEach(cleanup);

  it("traps focus, closes with Escape, and restores invoking focus", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open confirmation" });
    await user.click(trigger);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(document.activeElement).toBe(cancel);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(confirm);
    await user.tab();
    expect(document.activeElement).toBe(cancel);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("supports a safe-action label and explicit return-focus target", async () => {
    const user = userEvent.setup();
    render(<CustomReturnFocusHarness />);
    await user.click(
      screen.getByRole("button", { name: "Review weak password" }),
    );
    const changePassword = screen.getByRole("button", {
      name: "Change password",
    });
    expect(document.activeElement).toBe(changePassword);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText("Password"));
  });
});
