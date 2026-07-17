import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdentityImport } from "../../flows/identity/import";
import { messages } from "../../i18n";
import type { DerivedIdentity, PublicContact } from "../../protocol/types";
import identityImportSource from "../../flows/identity/import.tsx?raw";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("recovery-word identity import", () => {
  it("consumes the explicit recovery-word import contract in the live path", () => {
    expect(identityImportSource).toContain("input: RecoveryWordsImportInput");
    expect(identityImportSource).toContain(
      "Promise<RecoveryWordsImportOutput>",
    );
  });

  it("keeps importedAt local and signs unknown original creation time as zero", async () => {
    const importedAt = 1_800_000_000n;
    vi.spyOn(Date, "now").mockReturnValue(Number(importedAt) * 1000);
    const onReady =
      vi.fn<
        (
          identity: DerivedIdentity,
          contact: PublicContact,
          importedAt?: bigint,
        ) => void
      >();
    const user = userEvent.setup();
    render(
      <IdentityImport
        t={(key) => messages.en[key]}
        onBack={vi.fn()}
        onReady={onReady}
      />,
    );

    await user.type(screen.getByLabelText("Pseudonym"), "Recovered Alice");
    await user.type(
      screen.getByLabelText("24 recovery words"),
      `${"abandon ".repeat(23)}art`,
    );
    await user.click(
      screen.getByRole("button", { name: "Import recovery words" }),
    );

    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    const call = onReady.mock.calls[0];
    if (!call) throw new Error("expected imported identity");
    const [identity, contact, localImportedAt] = call;
    expect(identity.creationTime).toBe(0n);
    expect(identity.importedAt).toBe(importedAt);
    expect(contact.creationTime).toBe(0n);
    expect(localImportedAt).toBe(importedAt);
  });
});
