import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorSummary } from "../../components/feedback/error-summary";
import { LiveRegion } from "../../components/feedback/live-region";
import { Progress } from "../../components/feedback/progress";
import { TextField } from "../../components/forms/text-field";

describe("accessible form primitives", () => {
  afterEach(cleanup);

  it("binds labels, errors, live status, and progress", () => {
    render(
      <main>
        <TextField
          id="name"
          label="Pseudonym"
          value=""
          error="Pseudonym is required"
          onInput={() => undefined}
        />
        <ErrorSummary
          title="Check the form"
          errors={["Pseudonym is required"]}
        />
        <LiveRegion message="Identity ready" />
        <Progress label="Encrypting" value={25} maximum={100} />
      </main>,
    );
    expect(
      screen.getByLabelText("Pseudonym").getAttribute("aria-invalid"),
    ).toBe("true");
    expect(screen.getByRole("alert").textContent).toContain("Check the form");
    expect(screen.getByRole("status").textContent).toBe("Identity ready");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "25",
    );
  });
});
