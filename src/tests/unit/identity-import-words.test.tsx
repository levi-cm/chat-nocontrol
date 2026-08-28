import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IdentityImport,
  importRecoveryWords,
} from "../../flows/identity/import";
import { messages } from "../../i18n";
import type {
  DerivedIdentityV2,
  PublicContactV2,
} from "../../protocol/types-v2";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("recovery-word identity import", () => {
  it("consumes the explicit recovery-word import contract", async () => {
    const output = await importRecoveryWords({
      words: [...new Array<string>(23).fill("abandon"), "art"],
      pseudonym: "Recovered Alice",
      importedAt: 1_800_000_000n,
    });

    expect(output.importedAt).toBe(1_800_000_000n);
    expect(output.identity.creationTime).toBe(0n);
    expect(output.publicContact.creationTime).toBe(0n);
  });

  it("keeps importedAt local and signs unknown original creation time as zero", async () => {
    const importedAt = 1_800_000_000n;
    vi.spyOn(Date, "now").mockReturnValue(Number(importedAt) * 1000);
    const onReady =
      vi.fn<
        (
          identity: DerivedIdentityV2,
          contact: PublicContactV2,
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

  it("wipes imported identity secrets when handoff rejects before acceptance", async () => {
    let rejectedIdentity: DerivedIdentityV2 | undefined;
    const onReady = vi.fn(
      (
        identity: DerivedIdentityV2,
        _contact: PublicContactV2,
        _importedAt?: bigint,
        acceptOwnership?: () => boolean,
      ) => {
        rejectedIdentity = identity;
        expect(acceptOwnership).toBeTypeOf("function");
        throw new Error("injected handoff failure");
      },
    );
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
    expect(rejectedIdentity?.masterEntropy).toEqual(new Uint8Array(32));
    expect(rejectedIdentity?.kemSecretKey).toEqual(new Uint8Array(3168));
    expect(rejectedIdentity?.signingSecretKey).toEqual(new Uint8Array(4896));
  });
});
