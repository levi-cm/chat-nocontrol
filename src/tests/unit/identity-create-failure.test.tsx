import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CryptoProvider } from "../../crypto/provider";
import { IdentityCreate } from "../../flows/identity/create";
import type { MessageKey } from "../../i18n";
import { messages } from "../../i18n";
import type {
  DerivedIdentity,
  LockedVaultObject,
  PublicContact,
} from "../../protocol/types";

const labels: Partial<Record<MessageKey, string>> = {
  createIdentity: "Create new identity",
  importIdentity: "Import identity",
  pseudonym: "Pseudonym",
  generateIdentity: "Generate identity",
  setupError: "Identity setup failed.",
  recoveryWordsTitle: "24 recovery words",
};

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
    fingerprint: new Uint8Array(32),
    identityId: new Uint8Array(20),
    pseudonym: "",
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
    fingerprint: new Uint8Array(32),
    identityId: new Uint8Array(20),
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

function renderCreate(overrides: {
  randomBytes: (length: number) => Uint8Array;
  autoLockMs?: number;
  onReady?: (
    identity: DerivedIdentity,
    contact: PublicContact,
    vault?: unknown,
    signal?: AbortSignal,
  ) => Promise<void> | void;
  identityProvider?: Pick<
    CryptoProvider,
    "deriveIdentity" | "createPublicContact"
  >;
  lockVaultJobFactory?: () => {
    requestId: string;
    promise: Promise<LockedVaultObject>;
    cancel: () => void;
  };
  privateCardGenerator?: () => Promise<string>;
}) {
  render(
    <IdentityCreate
      t={(key) => labels[key] ?? messages.en[key]}
      identity={null}
      contact={null}
      onReady={vi.fn()}
      {...overrides}
    />,
  );
}

async function openAndGenerate() {
  await userEvent.click(
    screen.getByRole("button", { name: "Create new identity" }),
  );
  await userEvent.type(screen.getByLabelText("Username"), "Alice");
  await userEvent.click(
    screen.getByRole("button", { name: "Generate identity" }),
  );
}

afterEach(cleanup);

describe("identity creation failure ownership", () => {
  it("keeps password setup recoverable after vault creation fails", async () => {
    const lockVaultJobFactory = vi
      .fn()
      .mockImplementationOnce(() => ({
        requestId: "vault-failure",
        promise: Promise.reject(new Error("injected vault failure")),
        cancel: vi.fn(),
      }))
      .mockImplementationOnce(() => ({
        requestId: "vault-retry",
        promise: Promise.resolve(vaultFixture()),
        cancel: vi.fn(),
      }));
    renderCreate({
      identityProvider: {
        deriveIdentity: vi.fn().mockResolvedValue(identityFixture()),
        createPublicContact: () => contactFixture(),
      },
      randomBytes: (length) => new Uint8Array(length).fill(7),
      lockVaultJobFactory,
    });
    await openAndGenerate();
    const password = screen.getByLabelText<HTMLInputElement>(
      "Browser-vault password",
    );
    const confirmation = screen.getByLabelText<HTMLInputElement>(
      "Confirm browser-vault password",
    );
    await userEvent.type(password, "Vault pass 123!");
    await userEvent.type(confirmation, "Vault pass 123!");
    await userEvent.click(
      screen.getByRole("button", { name: "Create encrypted vault" }),
    );

    const summary = await screen.findByRole("alert");
    expect(summary.textContent).toContain("Browser vault could not be created");
    expect(summary.textContent).toContain(
      "Nothing was saved. Your identity setup is still open.",
    );
    expect(document.activeElement).toBe(summary);
    expect(password.value).toBe("Vault pass 123!");
    expect(confirmation.value).toBe("Vault pass 123!");

    await userEvent.click(
      screen.getByRole("button", { name: "Create encrypted vault" }),
    );
    expect(await screen.findByText("Step 3 of 7")).not.toBeNull();
    expect(lockVaultJobFactory).toHaveBeenCalledTimes(2);
  });

  it("clears recovery state after transfer without wiping the active identity", async () => {
    const identity = identityFixture();
    const onReady = vi.fn();
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:recovery-test");
    const revokeObjectUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    try {
      renderCreate({
        onReady,
        identityProvider: {
          deriveIdentity: vi.fn().mockResolvedValue(identity),
          createPublicContact: () => contactFixture(),
        },
        randomBytes: (length) => new Uint8Array(length).fill(7),
        lockVaultJobFactory: () => ({
          requestId: "vault-test",
          promise: Promise.resolve(vaultFixture()),
          cancel: vi.fn(),
        }),
        privateCardGenerator: () =>
          Promise.resolve("data:image/png;base64,AA=="),
      });
      await openAndGenerate();
      await userEvent.type(
        screen.getByLabelText("Browser-vault password"),
        "Vault pass 123!",
      );
      await userEvent.type(
        screen.getByLabelText("Confirm browser-vault password"),
        "Vault pass 123!",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Create encrypted vault" }),
      );
      await userEvent.click(
        await screen.findByRole("button", { name: "Save private QR as PNG" }),
      );
      await userEvent.click(
        screen.getByRole("checkbox", {
          name: "I stored the private QR safely",
        }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Download .ppxrecovery file" }),
      );
      await userEvent.click(
        screen.getByRole("checkbox", {
          name: "I stored the .ppxrecovery file safely",
        }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Continue to recovery words" }),
      );
      await userEvent.click(
        await screen.findByRole("link", { name: "Print / Save as PDF" }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Download recovery PDF" }),
      );
      await userEvent.click(
        screen.getByRole("checkbox", { name: "I wrote down all 24 words" }),
      );
      await userEvent.click(
        screen.getByRole("checkbox", {
          name: "I printed and safely stored the recovery document",
        }),
      );
      await userEvent.click(
        screen.getByRole("checkbox", {
          name: "I safely stored the recovery PDF",
        }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Continue to restore practice" }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "I know what I’m doing" }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Skip practice" }),
      );
      await userEvent.click(
        screen.getByRole("radio", { name: /No, use session only/u }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Finish identity setup" }),
      );

      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      await screen.findByRole("button", { name: "Create new identity" });
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
      expect(identity.masterEntropy).toEqual(new Uint8Array(32).fill(3));
      expect(identity.kemSecretKey).toEqual(new Uint8Array(1632).fill(4));
      expect(identity.x25519SecretKey).toEqual(new Uint8Array(32).fill(5));
      expect(identity.signingSecretKey).toEqual(new Uint8Array(32).fill(6));
    } finally {
      createObjectUrl.mockRestore();
      revokeObjectUrl.mockRestore();
      anchorClick.mockRestore();
    }
  });

  it("wipes an unfinished recovery setup after an expired visibility resume", async () => {
    const identity = identityFixture();
    let now = 1_000;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
      renderCreate({
        autoLockMs: 1_000,
        identityProvider: {
          deriveIdentity: vi.fn().mockResolvedValue(identity),
          createPublicContact: () => contactFixture(),
        },
        randomBytes: (length) => new Uint8Array(length).fill(7),
      });

      await openAndGenerate();
      await screen.findByLabelText("Browser-vault password");
      now = 2_001;
      document.dispatchEvent(new Event("visibilitychange"));

      await screen.findByRole("button", { name: "Create new identity" });
      expect(identity.masterEntropy).toEqual(new Uint8Array(32));
      expect(identity.kemSecretKey).toEqual(new Uint8Array(1632));
      expect(identity.x25519SecretKey).toEqual(new Uint8Array(32));
      expect(identity.signingSecretKey).toEqual(new Uint8Array(32));
      expect(screen.queryByLabelText("Browser-vault password")).toBeNull();
    } finally {
      clock.mockRestore();
    }
  });

  it("recovers the form when initial entropy generation fails", async () => {
    renderCreate({
      randomBytes: () => {
        throw new Error("injected initial RNG failure");
      },
    });

    await openAndGenerate();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Identity setup failed.",
    );
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Generate identity",
      }).disabled,
    ).toBe(false);
    expect(screen.queryByText("24 recovery words")).toBeNull();
  });

  it("wipes derived secrets when confirmation RNG fails", async () => {
    const identity = identityFixture();
    const deriveIdentity = vi.fn().mockResolvedValue(identity);
    let randomCalls = 0;
    renderCreate({
      identityProvider: {
        deriveIdentity,
        createPublicContact: () => contactFixture(),
      },
      randomBytes: (length) => {
        randomCalls += 1;
        if (randomCalls === 1) return new Uint8Array(length).fill(7);
        throw new Error("injected confirmation RNG failure");
      },
    });

    await openAndGenerate();
    await screen.findByRole("alert");

    await waitFor(() => expect(deriveIdentity).toHaveBeenCalledOnce());
    expect(identity.masterEntropy).toEqual(new Uint8Array(32));
    expect(identity.kemSecretKey).toEqual(new Uint8Array(1632));
    expect(identity.x25519SecretKey).toEqual(new Uint8Array(32));
    expect(identity.signingSecretKey).toEqual(new Uint8Array(32));
    expect(screen.queryByText("24 recovery words")).toBeNull();
  });
});
