import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdentityCreate } from "../../flows/identity/create";
import { messages } from "../../i18n";
import type {
  DerivedIdentity,
  LockedVaultObject,
  PublicContact,
} from "../../protocol/types";

function identityFixture(): DerivedIdentity {
  return {
    suite: 1,
    creationTime: 0n,
    masterEntropy: new Uint8Array(32).fill(3),
    kemPublicKey: new Uint8Array(800),
    kemSecretKey: new Uint8Array(1632).fill(4),
    x25519PublicKey: new Uint8Array(32),
    x25519SecretKey: new Uint8Array(32).fill(5),
    signingPublicKey: new Uint8Array(32),
    signingSecretKey: new Uint8Array(32).fill(6),
    fingerprint: new Uint8Array(32).fill(8),
    identityId: new Uint8Array(20).fill(8),
    pseudonym: "Alice",
  };
}

function contactFixture(): PublicContact {
  return {
    magic: "PPXC",
    formatVersion: 1,
    suite: 1,
    creationTime: 0n,
    pseudonym: "Alice",
    kemPublicKey: new Uint8Array(800),
    x25519PublicKey: new Uint8Array(32),
    signingPublicKey: new Uint8Array(32),
    selfSignature: new Uint8Array(64),
    checksum: new Uint8Array(16),
    fingerprint: new Uint8Array(32).fill(8),
    identityId: new Uint8Array(20).fill(8),
  };
}

function vaultFixture(): LockedVaultObject {
  return {
    magic: "PPXV",
    formatVersion: 1,
    suite: 1,
    flags: 1,
    kdfId: 1,
    scryptN: 65_536,
    scryptR: 8,
    scryptP: 2,
    salt: new Uint8Array(16),
    nonce: new Uint8Array(12),
    ciphertextLength: 16,
    ciphertext: new Uint8Array(16),
    checksum: new Uint8Array(16),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("seven-screen identity wizard", () => {
  it("uses calm username guidance without a danger panel", async () => {
    const user = userEvent.setup();
    render(
      <IdentityCreate
        t={(key) => messages.en[key]}
        locale="en"
        identity={null}
        contact={null}
        onReady={vi.fn()}
        identityProvider={{
          deriveIdentity: vi.fn().mockResolvedValue(identityFixture()),
          createPublicContact: () => contactFixture(),
        }}
        randomBytes={(length) => new Uint8Array(length).fill(7)}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Create new identity" }),
    );

    const guidance = screen.getByText(
      "People will see this username in their contacts. Do not use your real name or anything that can be traced back to you. Choose a made-up name instead.",
    );
    expect(guidance.classList.contains("username-guidance")).toBe(true);
    expect(guidance.closest(".warning-panel")).toBeNull();
    expect(
      screen.queryByRole("heading", {
        name: "Public username, not a secret",
      }),
    ).toBeNull();
  });

  it("starts at 30 percent and requires a confirmed printable password", async () => {
    const user = userEvent.setup();
    render(
      <IdentityCreate
        t={(key) => messages.en[key]}
        locale="en"
        identity={null}
        contact={null}
        onReady={vi.fn()}
        identityProvider={{
          deriveIdentity: vi.fn().mockResolvedValue(identityFixture()),
          createPublicContact: () => contactFixture(),
        }}
        randomBytes={(length) => new Uint8Array(length).fill(7)}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Create new identity" }),
    );
    expect(screen.getByText("Step 1 of 7")).not.toBeNull();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "30",
    );
    await user.type(screen.getByLabelText("Username"), "Alice");
    await user.click(screen.getByRole("button", { name: "Generate identity" }));

    expect(await screen.findByText("Step 2 of 7")).not.toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", {
        name: "Create your browser-vault password",
      }),
    );
    expect(screen.getByLabelText("Browser-vault password")).not.toBeNull();
    expect(
      screen.getByLabelText("Confirm browser-vault password"),
    ).not.toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Create encrypted vault",
      }).disabled,
    ).toBe(true);

    await user.type(screen.getByLabelText("Browser-vault password"), " valid");
    await user.type(
      screen.getByLabelText("Confirm browser-vault password"),
      " valid",
    );
    expect(
      screen.getByText(/must not start or end with a space/u),
    ).not.toBeNull();
    await user.clear(screen.getByLabelText("Browser-vault password"));
    await user.clear(screen.getByLabelText("Confirm browser-vault password"));
    await user.type(
      screen.getByLabelText("Browser-vault password"),
      "CaseSensitive",
    );
    await user.type(
      screen.getByLabelText("Confirm browser-vault password"),
      "casesensitive",
    );
    expect(screen.getByText("The two passwords do not match.")).not.toBeNull();
  });

  it("creates the encrypted vault before enabling required digital backups", async () => {
    const user = userEvent.setup();
    const lockVaultJobFactory = vi.fn(() => ({
      requestId: "vault-test",
      promise: Promise.resolve(vaultFixture()),
      cancel: vi.fn(),
    }));
    render(
      <IdentityCreate
        t={(key) => messages.en[key]}
        locale="en"
        identity={null}
        contact={null}
        onReady={vi.fn()}
        identityProvider={{
          deriveIdentity: vi.fn().mockResolvedValue(identityFixture()),
          createPublicContact: () => contactFixture(),
        }}
        lockVaultJobFactory={lockVaultJobFactory}
        randomBytes={(length) => new Uint8Array(length).fill(7)}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Create new identity" }),
    );
    await user.type(screen.getByLabelText("Username"), "Alice");
    await user.click(screen.getByRole("button", { name: "Generate identity" }));
    await user.type(
      screen.getByLabelText("Browser-vault password"),
      "Vault pass 123!",
    );
    await user.type(
      screen.getByLabelText("Confirm browser-vault password"),
      "Vault pass 123!",
    );
    await user.click(
      screen.getByRole("button", { name: "Create encrypted vault" }),
    );

    expect(await screen.findByText("Step 3 of 7")).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(lockVaultJobFactory).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Save private QR as PNG" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Download .ppxrecovery file" }),
    ).not.toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Continue to recovery words",
      }).disabled,
    ).toBe(true);
  });

  it("requires all three recovery-document confirmations", async () => {
    const user = userEvent.setup();
    const download = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(
      <IdentityCreate
        t={(key) => messages.en[key]}
        locale="en"
        identity={null}
        contact={null}
        onReady={vi.fn()}
        identityProvider={{
          deriveIdentity: vi.fn().mockResolvedValue(identityFixture()),
          createPublicContact: () => contactFixture(),
        }}
        lockVaultJobFactory={() => ({
          requestId: "recovery-confirmations",
          promise: Promise.resolve(vaultFixture()),
          cancel: vi.fn(),
        })}
        privateCardGenerator={() =>
          Promise.resolve("data:image/png;base64,AA==")
        }
        recoveryQrGenerator={() =>
          Promise.resolve("data:image/png;base64,AA==")
        }
        pdfGenerator={() => Promise.resolve(new Uint8Array([37, 80, 68, 70]))}
        randomBytes={(length) => new Uint8Array(length).fill(7)}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Create new identity" }),
    );
    await user.type(screen.getByLabelText("Username"), "Alice");
    await user.click(screen.getByRole("button", { name: "Generate identity" }));
    await user.type(
      screen.getByLabelText("Browser-vault password"),
      "Vault pass 123!",
    );
    await user.type(
      screen.getByLabelText("Confirm browser-vault password"),
      "Vault pass 123!",
    );
    await user.click(
      screen.getByRole("button", { name: "Create encrypted vault" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Save private QR as PNG" }),
    );
    await user.click(
      await screen.findByRole("checkbox", {
        name: "I stored the private QR safely",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Download .ppxrecovery file" }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "I stored the .ppxrecovery file safely",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to recovery words" }),
    );

    const continueButton = await screen.findByRole<HTMLButtonElement>(
      "button",
      { name: "Continue to restore practice" },
    );
    const written = screen.getByRole("checkbox", {
      name: "I wrote down all 24 words",
    });
    const printed = screen.getByRole("checkbox", {
      name: "I printed and safely stored the recovery document",
    });
    const pdf = screen.getByRole("checkbox", {
      name: "I safely stored the recovery PDF",
    });
    expect(continueButton.disabled).toBe(true);
    await user.click(written);
    expect(continueButton.disabled).toBe(true);
    expect(printed).toBeDisabled();
    expect(pdf).toBeDisabled();
    expect(download).toHaveBeenCalledTimes(2);
  });

  it("requires explicit confirmation before creating a weak-password vault", async () => {
    const user = userEvent.setup();
    const lockVaultJobFactory = vi.fn(() => ({
      requestId: "weak-vault-test",
      promise: Promise.resolve(vaultFixture()),
      cancel: vi.fn(),
    }));
    render(
      <IdentityCreate
        t={(key) => messages.en[key]}
        locale="en"
        identity={null}
        contact={null}
        onReady={vi.fn()}
        identityProvider={{
          deriveIdentity: vi.fn().mockResolvedValue(identityFixture()),
          createPublicContact: () => contactFixture(),
        }}
        lockVaultJobFactory={lockVaultJobFactory}
        randomBytes={(length) => new Uint8Array(length).fill(7)}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Create new identity" }),
    );
    await user.type(screen.getByLabelText("Username"), "Alice");
    await user.click(screen.getByRole("button", { name: "Generate identity" }));
    const password = screen.getByLabelText("Browser-vault password");
    await user.type(password, "1234");
    await user.type(
      screen.getByLabelText("Confirm browser-vault password"),
      "1234",
    );
    await user.click(
      screen.getByRole("button", { name: "Create encrypted vault" }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Use a weak browser-vault password?",
      }),
    ).not.toBeNull();
    expect(lockVaultJobFactory).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Change password" }),
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(password);

    await user.click(
      screen.getByRole("button", { name: "Create encrypted vault" }),
    );
    await user.click(screen.getByRole("button", { name: "Use weak password" }));

    expect(await screen.findByText("Step 3 of 7")).not.toBeNull();
    expect(lockVaultJobFactory).toHaveBeenCalledOnce();
  });

  it("does not resurrect a private QR download after confirmed restart", async () => {
    const user = userEvent.setup();
    let resolveCard: (value: string) => void = vi.fn();
    const pendingCard = new Promise<string>((resolve) => {
      resolveCard = resolve;
    });
    const download = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(
      <IdentityCreate
        t={(key) => messages.en[key]}
        locale="en"
        identity={null}
        contact={null}
        onReady={vi.fn()}
        identityProvider={{
          deriveIdentity: vi.fn().mockResolvedValue(identityFixture()),
          createPublicContact: () => contactFixture(),
        }}
        lockVaultJobFactory={() => ({
          requestId: "vault-test",
          promise: Promise.resolve(vaultFixture()),
          cancel: vi.fn(),
        })}
        privateCardGenerator={() => pendingCard}
        randomBytes={(length) => new Uint8Array(length).fill(7)}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Create new identity" }),
    );
    await user.type(screen.getByLabelText("Username"), "Alice");
    await user.click(screen.getByRole("button", { name: "Generate identity" }));
    await user.type(
      screen.getByLabelText("Browser-vault password"),
      "Vault pass 123!",
    );
    await user.type(
      screen.getByLabelText("Confirm browser-vault password"),
      "Vault pass 123!",
    );
    await user.click(
      screen.getByRole("button", { name: "Create encrypted vault" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Save private QR as PNG" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Restart identity creation" }),
    );
    await user.click(
      screen.getAllByRole("button", { name: "Restart identity creation" })[1]!,
    );
    resolveCard("data:image/png;base64,AA==");
    await Promise.resolve();
    await Promise.resolve();

    expect(
      await screen.findByText("Create identity or import identity"),
    ).not.toBeNull();
    expect(download).not.toHaveBeenCalled();
    download.mockRestore();
  });
});
