import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAT_NOCONTROL_CANONICAL_APP_BASE } from "../../app/build-info";
import type { ContactSaveMutation } from "../../app/contact-save-queue";
import { EncryptTextFlow } from "../../flows/encrypt/text";
import { messages, type Locale } from "../../i18n";
import { formatLocalNumber } from "../../i18n/format";
import { checksum16 } from "../../protocol/checksum";
import { parseMessageLinkHash } from "../../protocol/message-link";
import { parseEncryptedQrText } from "../../protocol/ppxq-outer";
import {
  encodeEncryptedTextHeader,
  parseEncryptedTextOuter,
} from "../../protocol/ppxt-outer";
import type {
  DerivedIdentity,
  EncryptedQrTextObject,
  EncryptedTextObject,
  EncryptQrTextInput,
  EncryptTextInput,
  PublicContact,
} from "../../protocol/types";
import type { MessageOutputMode } from "../../storage/settings";
import type { CryptoWorkerJob } from "../../workers/crypto-client";
import {
  canonicalProtocolBytes,
  canonicalQrTextBytes,
} from "../helpers/canonical-protocol";

const workerMocks = vi.hoisted(() => ({
  startEncryptTextJob:
    vi.fn<(input: EncryptTextInput) => CryptoWorkerJob<EncryptedTextObject>>(),
  startEncryptQrTextJob:
    vi.fn<
      (input: EncryptQrTextInput) => CryptoWorkerJob<EncryptedQrTextObject>
    >(),
}));

vi.mock("../../workers/crypto-client", () => workerMocks);

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

function contactFixture(fill: number, pseudonym: string): PublicContact {
  return {
    magic: "PPXC",
    formatVersion: 1,
    suite: 1,
    creationTime: 0n,
    pseudonym,
    kemPublicKey: new Uint8Array(800).fill(fill),
    x25519PublicKey: new Uint8Array(32).fill(fill),
    signingPublicKey: new Uint8Array(32).fill(fill),
    selfSignature: new Uint8Array(64),
    checksum: new Uint8Array(16),
    fingerprint: new Uint8Array(32).fill(fill),
    identityId: new Uint8Array(20).fill(fill),
  };
}

const sender = contactFixture(8, "Alice");
const recipient = contactFixture(9, "Bob");
type ContactsChange = (mutation: ContactSaveMutation) => Promise<boolean>;

async function prepareWorkers({
  compact = "resolve",
  largeFull = false,
}: {
  compact?: "resolve" | "reject" | "pending";
  largeFull?: boolean;
} = {}) {
  const parsedPpxt = parseEncryptedTextOuter(
    (await canonicalProtocolBytes()).ppxt,
  );
  const largeCiphertext = new Uint8Array(1_500).fill(7);
  const largeBase = {
    ...parsedPpxt,
    ciphertextLength: largeCiphertext.byteLength,
    ciphertext: largeCiphertext,
  };
  const largeHeader = encodeEncryptedTextHeader(largeBase);
  const largePayload = new Uint8Array(
    largeHeader.length + largeCiphertext.length,
  );
  largePayload.set(largeHeader);
  largePayload.set(largeCiphertext, largeHeader.length);
  const ppxt = largeFull
    ? { ...largeBase, checksum: checksum16(largePayload) }
    : parsedPpxt;
  const ppxq = parseEncryptedQrText(canonicalQrTextBytes());
  workerMocks.startEncryptTextJob.mockReturnValue({
    requestId: "ppxt",
    promise: Promise.resolve(ppxt),
    cancel: vi.fn(),
  });
  workerMocks.startEncryptQrTextJob.mockImplementation(() => ({
    requestId: "ppxq",
    promise:
      compact === "resolve"
        ? Promise.resolve(ppxq)
        : compact === "reject"
          ? Promise.reject(new Error("compact-too-large"))
          : new Promise(() => undefined),
    cancel: vi.fn(),
  }));
  return { ppxt, ppxq };
}

function renderFlow({
  messageOutputMode = "both",
  messageQrCreationEnabled = false,
  includeSenderContactInLinks = true,
  locale = "en",
  onContactsChange = vi.fn<ContactsChange>().mockResolvedValue(true),
}: {
  messageOutputMode?: MessageOutputMode;
  messageQrCreationEnabled?: boolean;
  includeSenderContactInLinks?: boolean;
  locale?: Locale;
  onContactsChange?: ContactsChange;
} = {}) {
  render(
    <EncryptTextFlow
      t={(key) => messages[locale][key]}
      identity={identityFixture()}
      sender={sender}
      contacts={[
        { contact: recipient, nickname: "Bob", includeSenderContactInLinks },
      ]}
      onContactsChange={onContactsChange}
      locale={locale}
      messageOutputMode={messageOutputMode}
      messageQrCreationEnabled={messageQrCreationEnabled}
      qrExportMode="both"
    />,
  );
  return { onContactsChange };
}

async function encryptMessage(message = "hello", locale: Locale = "en") {
  const user = userEvent.setup();
  await user.selectOptions(
    screen.getByLabelText(messages[locale].recipient),
    "09".repeat(32),
  );
  await user.type(
    screen.getByLabelText(messages[locale].encryptedTextLabel),
    message,
  );
  await user.click(
    screen.getByRole("button", { name: messages[locale].encryptLocally }),
  );
  await waitFor(() =>
    expect(workerMocks.startEncryptTextJob).toHaveBeenCalledOnce(),
  );
  return user;
}

function encryptedLinkField(): HTMLTextAreaElement {
  const element = screen.getByLabelText("Encrypted link");
  if (!(element instanceof HTMLTextAreaElement)) {
    throw new Error("encrypted link field is not a textarea");
  }
  return element;
}

function contactInclusionCheckbox(): HTMLInputElement {
  const element = screen.getByRole("checkbox", {
    name: /include my public contact/i,
  });
  if (!(element instanceof HTMLInputElement)) {
    throw new Error("contact inclusion control is not an input");
  }
  return element;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
});

describe("sender message outputs", () => {
  it.each([
    ["text", false, 0],
    ["text", true, 1],
    ["link", false, 1],
    ["both", false, 1],
  ] as const)(
    "%s output with QR=%s starts compact worker %s time(s)",
    async (messageOutputMode, messageQrCreationEnabled, expectedCalls) => {
      await prepareWorkers({ compact: "pending" });
      renderFlow({ messageOutputMode, messageQrCreationEnabled });
      await encryptMessage();

      expect(workerMocks.startEncryptQrTextJob).toHaveBeenCalledTimes(
        expectedCalls,
      );
      expect(screen.queryByLabelText("Encrypted link") !== null).toBe(
        messageOutputMode !== "text",
      );
      expect(screen.queryByLabelText("Encrypted output") !== null).toBe(
        messageOutputMode !== "link",
      );
    },
  );

  it("passes identical message metadata to PPXT and PPXQ workers", async () => {
    await prepareWorkers();
    renderFlow({ messageOutputMode: "both" });
    await encryptMessage("emoji 😀");
    await waitFor(() =>
      expect(workerMocks.startEncryptQrTextJob).toHaveBeenCalledOnce(),
    );

    const full = workerMocks.startEncryptTextJob.mock.calls[0]?.[0];
    const compact = workerMocks.startEncryptQrTextJob.mock.calls[0]?.[0];
    if (!full || !compact)
      throw new Error("encryption workers were not called");
    expect(compact.messageId).toEqual(full.messageId);
    expect(compact.sentAt).toBe(full.sentAt);
    expect(compact.createdAt).toBe(full.createdAt);
    expect(compact.plaintext).toBe("emoji 😀");
  });

  it("does not reveal QR actions when compact output exists only for links", async () => {
    await prepareWorkers();
    renderFlow({ messageOutputMode: "both", messageQrCreationEnabled: false });
    await encryptMessage();

    expect(
      screen.queryByRole("button", { name: /download .*message qr/i }),
    ).toBeNull();
  });

  it("uses PPXT for contact-included canonical links and reports exact length", async () => {
    await prepareWorkers({ compact: "pending" });
    renderFlow({
      messageOutputMode: "both",
      includeSenderContactInLinks: true,
    });
    await encryptMessage();

    await screen.findByLabelText("Encrypted link");
    const link = encryptedLinkField();
    expect(link.value.startsWith(CHAT_NOCONTROL_CANONICAL_APP_BASE)).toBe(true);
    expect(parseMessageLinkHash(new URL(link.value).hash).kind).toBe("ppxt");
    expect(
      screen.getByText(
        `Link length: ${formatLocalNumber(link.value.length, "en")} characters`,
      ),
    ).not.toBeNull();
  });

  it("warns without disabling links above 2,000 characters", async () => {
    await prepareWorkers({ compact: "pending", largeFull: true });
    renderFlow({
      messageOutputMode: "link",
      includeSenderContactInLinks: true,
    });
    await encryptMessage();

    await screen.findByLabelText("Encrypted link");
    const link = encryptedLinkField();
    expect(link.value.length).toBeGreaterThan(2_000);
    expect(screen.getByText(/longer than 2,000 characters/i)).not.toBeNull();
    const copyButton = screen.getByRole("button", {
      name: "Copy encrypted link",
    });
    if (!(copyButton instanceof HTMLButtonElement)) {
      throw new Error("copy encrypted link control is not a button");
    }
    expect(copyButton.disabled).toBe(false);
  });

  it.each([
    ["en", /show encrypted text fallback/i],
    ["de", /verschlüsselten text als ausweichmöglichkeit anzeigen/i],
  ] as const)(
    "reveals the encrypted-text fallback for long Link-only output in %s",
    async (locale, fallbackLabel) => {
      await prepareWorkers({ compact: "pending", largeFull: true });
      renderFlow({
        messageOutputMode: "link",
        includeSenderContactInLinks: true,
        locale,
      });
      const user = await encryptMessage("hello", locale);

      await screen.findByLabelText(messages[locale].encryptedLink);
      expect(
        screen.queryByLabelText(messages[locale].encryptedOutput),
      ).toBeNull();
      await user.click(screen.getByRole("button", { name: fallbackLabel }));

      const fallback = screen.getByLabelText(messages[locale].encryptedOutput);
      expect(fallback).toBeInstanceOf(HTMLTextAreaElement);
      if (!(fallback instanceof HTMLTextAreaElement)) {
        throw new Error("encrypted text fallback is not a textarea");
      }
      expect(fallback.readOnly).toBe(true);
      expect(fallback.value).toContain("-----BEGIN PPX ENCRYPTED TEXT-----");
      expect(
        screen.getByRole("button", { name: messages[locale].copyOutput }),
      ).not.toBeNull();
      expect(screen.queryByRole("button", { name: fallbackLabel })).toBeNull();
    },
  );

  it("does not add a redundant long-link fallback action in Both mode", async () => {
    await prepareWorkers({ compact: "pending", largeFull: true });
    renderFlow({ messageOutputMode: "both" });
    await encryptMessage();

    await screen.findByLabelText("Encrypted link");
    expect(screen.getByLabelText("Encrypted output")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /show encrypted text fallback/i }),
    ).toBeNull();
  });

  it("uses PPXQ when contact inclusion is off and shows known-contact guidance", async () => {
    await prepareWorkers();
    renderFlow({
      messageOutputMode: "link",
      includeSenderContactInLinks: false,
    });
    await encryptMessage();

    await screen.findByLabelText("Encrypted link");
    const link = encryptedLinkField();
    expect(parseMessageLinkHash(new URL(link.value).hash).kind).toBe("ppxq");
    expect(
      screen.getAllByText(/must already have your public contact/i).length,
    ).toBeGreaterThan(0);
  });

  it("persists contact inclusion changes immediately", async () => {
    await prepareWorkers();
    const { onContactsChange } = renderFlow({ messageOutputMode: "link" });
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByLabelText("Recipient"),
      "09".repeat(32),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /include my public contact/i }),
    );

    expect(onContactsChange).toHaveBeenCalledWith({
      kind: "update",
      fingerprint: recipient.fingerprint,
      patch: { includeSenderContactInLinks: false },
    });
  });

  it("keeps committed PPXT visible and disables transport actions until opt-out saves", async () => {
    await prepareWorkers();
    const save = deferred<boolean>();
    const onContactsChange = vi.fn<ContactsChange>(() => save.promise);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    renderFlow({ messageOutputMode: "link", onContactsChange });
    const user = await encryptMessage();
    const checkbox = contactInclusionCheckbox();

    await user.click(checkbox);

    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
    expect(
      parseMessageLinkHash(new URL(encryptedLinkField().value).hash).kind,
    ).toBe("ppxt");
    expect(
      screen
        .getByRole("button", { name: "Copy encrypted link" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Share encrypted link" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(onContactsChange).toHaveBeenCalledOnce();

    save.resolve(true);
    await waitFor(() => expect(contactInclusionCheckbox().checked).toBe(false));
    expect(contactInclusionCheckbox().disabled).toBe(false);
    expect(
      parseMessageLinkHash(new URL(encryptedLinkField().value).hash).kind,
    ).toBe("ppxq");
  });

  it.each(["false", "throw"] as const)(
    "rolls back a %s preference save and reports localized safe storage status",
    async (failure) => {
      await prepareWorkers();
      const onContactsChange = vi.fn<ContactsChange>(() =>
        failure === "false"
          ? Promise.resolve(false)
          : Promise.reject(new Error("storage-failed")),
      );
      renderFlow({ messageOutputMode: "link", onContactsChange });
      const user = await encryptMessage();

      await user.click(contactInclusionCheckbox());

      expect(
        await screen.findByText(
          "Persistent storage became unavailable. This session continues in memory.",
        ),
      ).not.toBeNull();
      expect(contactInclusionCheckbox().checked).toBe(true);
      expect(contactInclusionCheckbox().disabled).toBe(false);
      expect(
        parseMessageLinkHash(new URL(encryptedLinkField().value).hash).kind,
      ).toBe("ppxt");
    },
  );

  it("prevents a second preference action while the first save is pending", async () => {
    await prepareWorkers();
    const save = deferred<boolean>();
    const onContactsChange = vi.fn<ContactsChange>(() => save.promise);
    renderFlow({ messageOutputMode: "link", onContactsChange });
    const user = await encryptMessage();
    const checkbox = contactInclusionCheckbox();

    await user.click(checkbox);
    await user.click(checkbox);

    expect(checkbox.disabled).toBe(true);
    expect(onContactsChange).toHaveBeenCalledOnce();
    save.resolve(false);
  });

  it("offers contact inclusion and encrypted-text fallback after compact failure", async () => {
    await prepareWorkers({ compact: "reject" });
    renderFlow({
      messageOutputMode: "link",
      includeSenderContactInLinks: false,
    });
    const user = await encryptMessage();

    expect(
      await screen.findByText(/compact encrypted link could not be created/i),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: /include my public contact/i }),
    ).not.toBeNull();
    await user.click(
      screen.getByRole("button", { name: /show encrypted text fallback/i }),
    );
    expect(screen.getByLabelText("Encrypted output")).not.toBeNull();
  });

  it("copy fallback selects the whole encrypted link", async () => {
    await prepareWorkers();
    renderFlow({ messageOutputMode: "link" });
    const user = await encryptMessage();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
        readText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    await user.click(
      screen.getByRole("button", { name: "Copy encrypted link" }),
    );
    expect(
      await screen.findByText(/complete link is selected/i),
    ).not.toBeNull();
  });

  it.each(["resolve", "cancel"] as const)(
    "shares URL-only when Web Share will %s",
    async (result) => {
      const share = vi
        .fn()
        .mockImplementation(() =>
          result === "resolve"
            ? Promise.resolve()
            : Promise.reject(new DOMException("cancelled", "AbortError")),
        );
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: share,
      });
      await prepareWorkers();
      renderFlow({ messageOutputMode: "link" });
      const user = await encryptMessage();
      await user.click(
        screen.getByRole("button", { name: "Share encrypted link" }),
      );

      const link = encryptedLinkField().value;
      expect(share).toHaveBeenCalledWith({ url: link });
      expect(screen.getByLabelText("Encrypted link")).not.toBeNull();
    },
  );

  it("hides Web Share action when unavailable", async () => {
    await prepareWorkers();
    renderFlow({ messageOutputMode: "link" });
    await encryptMessage();
    expect(
      screen.queryByRole("button", { name: "Share encrypted link" }),
    ).toBeNull();
  });
});
