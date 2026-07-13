import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CryptoProvider } from "../../crypto/provider";
import { IdentityCreate } from "../../flows/identity/create";
import type { MessageKey } from "../../i18n";
import type { DerivedIdentity, PublicContact } from "../../protocol/types";

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
}) {
  render(
    <IdentityCreate
      t={(key) => labels[key] ?? key}
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
  await userEvent.type(screen.getByLabelText("Pseudonym"), "Alice");
  await userEvent.click(
    screen.getByRole("button", { name: "Generate identity" }),
  );
}

afterEach(cleanup);

describe("identity creation failure ownership", () => {
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
      });
      await openAndGenerate();
      const words = await screen.findAllByRole("listitem");
      const recoveryWords = words.map((item) => item.textContent ?? "");
      fireEvent.click(screen.getByRole("button", { name: "downloadRecovery" }));
      await userEvent.type(
        screen.getByLabelText("confirmationLabel"),
        "confirmationPhrase",
      );
      const confirmations = document.querySelectorAll<HTMLInputElement>(
        'input[id^="recovery-word-confirmation-"]',
      );
      for (const input of confirmations) {
        const position = Number(input.id.split("-").at(-1));
        await userEvent.type(input, recoveryWords[position - 1] ?? "");
      }
      await userEvent.click(
        screen.getByRole("button", { name: "confirmRecovery" }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "useSessionOnly" }),
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
      await screen.findByText("24 recovery words");
      now = 2_001;
      document.dispatchEvent(new Event("visibilitychange"));

      await screen.findByRole("button", { name: "Create new identity" });
      expect(identity.masterEntropy).toEqual(new Uint8Array(32));
      expect(identity.kemSecretKey).toEqual(new Uint8Array(1632));
      expect(identity.x25519SecretKey).toEqual(new Uint8Array(32));
      expect(identity.signingSecretKey).toEqual(new Uint8Array(32));
      expect(screen.queryByText("24 recovery words")).toBeNull();
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
