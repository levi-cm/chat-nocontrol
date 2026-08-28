import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { encryptText } from "../../crypto/text";
import { encryptQrText } from "../../crypto/qr-text";
import { DecryptFlow } from "../../flows/decrypt";
import {
  createPublicContact,
  encodePublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import { encodeQrMessageText } from "../../protocol/ppxq";
import { encodeEncryptedQrText } from "../../protocol/ppxq-outer";
import { encodeTextArmor } from "../../protocol/ppxt-armor";
import { encodeMessageLink } from "../../protocol/message-link";
import type {
  DecryptedFileOutput,
  DecryptedQrTextOutput,
  DecryptedTextOutput,
  DerivedIdentity,
  EncryptedTextObject,
  PublicContact,
} from "../../protocol/types";
import type { DerivedIdentityV2 } from "../../protocol/types-v2";
import {
  startLegacyFileDecryptJob,
  startLegacyCompactTextDecryptJob,
  startLegacyTextDecryptJob,
} from "../../workers/legacy-v1-client";

vi.mock("../../workers/legacy-v1-client", () => ({
  LegacyV1WorkerCancelled: class LegacyV1WorkerCancelled extends Error {},
  startLegacyFileDecryptJob: vi.fn(),
  startLegacyCompactTextDecryptJob: vi.fn(),
  startLegacyTextDecryptJob: vi.fn(),
}));

const bytes = (length: number, value: number) =>
  new Uint8Array(length).fill(value);

describe("legacy V1 decrypt UX", () => {
  let identity: DerivedIdentityV2;
  let legacyIdentity: DerivedIdentity;
  let legacySender: PublicContact;
  let legacyObject: EncryptedTextObject;
  let legacyCompressedObject: EncryptedTextObject;
  let legacyTextOutput: DecryptedTextOutput;
  let legacyCompactText: string;
  let legacyCompactBytes: Uint8Array;
  let legacyCompactOutput: DecryptedQrTextOutput;

  beforeAll(async () => {
    identity = await deriveIdentityV2FromEntropy(bytes(32, 0x51), "Recipient");
    legacyIdentity = await deriveIdentityFromEntropy(
      bytes(32, 0x51),
      "Recipient",
    );
    const senderIdentity = await deriveIdentityFromEntropy(
      bytes(32, 0x52),
      "Legacy Sender",
    );
    legacySender = createPublicContact(senderIdentity, "Legacy Sender", 1n);
    const recipient = createPublicContact(legacyIdentity, "Recipient", 2n);
    legacyObject = await encryptText({
      sender: legacySender,
      senderSigningCapability: createSenderSigningCapability(senderIdentity),
      recipient,
      plaintext: "old plaintext",
      messageId: bytes(16, 0x53),
      sentAt: 3n,
      createdAt: 4n,
    });
    legacyCompressedObject = await encryptText({
      sender: legacySender,
      senderSigningCapability: createSenderSigningCapability(senderIdentity),
      recipient,
      plaintext: "compressible ".repeat(600),
      messageId: bytes(16, 0x54),
      sentAt: 4n,
      createdAt: 5n,
    });
    legacyTextOutput = {
      senderContact: legacySender,
      recipientId: legacyIdentity.identityId,
      messageId: bytes(16, 0x53),
      sentAt: 3n,
      createdAt: 4n,
      plaintext: "old plaintext",
      signatureValid: true,
    };
    const compactObject = await encryptQrText({
      sender: legacySender,
      senderSigningCapability: createSenderSigningCapability(senderIdentity),
      recipient,
      plaintext: "old compact plaintext",
      messageId: bytes(16, 0x55),
      sentAt: 5n,
      createdAt: 6n,
    });
    legacyCompactText = encodeQrMessageText(compactObject);
    legacyCompactBytes = encodeEncryptedQrText(compactObject);
    legacyCompactOutput = {
      senderContact: legacySender,
      recipientId: legacyIdentity.identityId,
      messageId: bytes(16, 0x55),
      sentAt: 5n,
      createdAt: 6n,
      plaintext: "old compact plaintext",
      signatureValid: true,
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  function renderFlow(props: Partial<Parameters<typeof DecryptFlow>[0]> = {}) {
    return render(
      <DecryptFlow
        t={(key) => key}
        identity={identity}
        contacts={[]}
        onContactsChange={() => Promise.resolve(true)}
        locale="en"
        autoDecryptIncomingMessages={false}
        pendingIncomingIntent={null}
        onPendingIncomingConsumed={() => undefined}
        cancellationHandle={{ current: null }}
        {...props}
      />,
    );
  }

  it("decrypts full V1 text with a legacy label, copy, and no sender save", async () => {
    vi.mocked(startLegacyTextDecryptJob).mockReturnValue({
      requestId: "legacy-text",
      promise: Promise.resolve(legacyTextOutput),
      cancel: vi.fn(),
    });
    renderFlow();
    const armor = encodeTextArmor(legacyObject);

    fireEvent.input(screen.getByLabelText("encryptedItem"), {
      currentTarget: { value: armor },
      target: { value: armor },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "decryptLocally" }),
    );

    await waitFor(() =>
      expect(startLegacyTextDecryptJob).toHaveBeenCalledOnce(),
    );
    expect(
      vi.mocked(startLegacyTextDecryptJob).mock.calls[0]?.[0],
    ).toMatchObject({
      object: legacyObject,
      masterEntropy: identity.masterEntropy,
    });
    expect(await screen.findByText("legacyContentNotice")).toBeDefined();
    expect(screen.queryByText("previewUnavailable")).toBeNull();
    expect(screen.getByDisplayValue("old plaintext")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "copyDecryptedText" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "saveSender" })).toBeNull();
  });

  it("keeps V1 files download-only with no sender save or media preview", async () => {
    const output: DecryptedFileOutput = {
      senderContact: legacySender,
      recipientId: legacyIdentity.identityId,
      filename: "old.png",
      mimeHint: "image/png",
      caption: "legacy image",
      fileLength: 3n,
      blob: new Blob([bytes(3, 0x54)], { type: "image/png" }),
      digestValid: true,
      signatureValid: true,
    };
    vi.mocked(startLegacyFileDecryptJob).mockReturnValue({
      requestId: "legacy-file",
      promise: Promise.resolve(output),
      cancel: vi.fn(),
    });
    renderFlow();

    await userEvent.upload(
      screen.getByLabelText("encryptedFile"),
      new File(
        [bytes(6, 0).map((_, index) => [80, 80, 88, 70, 1, 1][index] ?? 0)],
        "old.ppxfile",
      ),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "decryptLocally" }),
    );

    await waitFor(() =>
      expect(startLegacyFileDecryptJob).toHaveBeenCalledOnce(),
    );
    expect(await screen.findByText("previewUnavailable")).toBeDefined();
    expect(screen.getByText(/authenticatedLegacySenderLabel/u)).toBeDefined();
    expect(
      screen.getByRole("button", { name: "downloadDecryptedFile" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "saveSender" })).toBeNull();
    expect(screen.queryByLabelText("filePreview")).toBeNull();
  });

  it("guides compact V1 users to import a temporary sender contact", async () => {
    renderFlow();
    fireEvent.input(screen.getByLabelText("encryptedItem"), {
      currentTarget: { value: legacyCompactText },
      target: { value: legacyCompactText },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "decryptLocally" }),
    );

    expect(
      await screen.findByText("legacyCompactContactRequired"),
    ).toBeDefined();
    const contactInput = screen.getByLabelText("temporaryLegacyContact");
    await waitFor(() => expect(document.activeElement).toBe(contactInput));
    expect(contactInput.closest("details")?.open).toBe(true);
    expect(contactInput.getAttribute("aria-describedby")).toBe(
      "temporary-legacy-contact-help temporary-legacy-contact-error",
    );
    expect(contactInput.getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByText("incomingMessageReady")).toBeNull();
    expect(startLegacyTextDecryptJob).not.toHaveBeenCalled();
    expect(startLegacyCompactTextDecryptJob).not.toHaveBeenCalled();
  });

  it("clears the temporary contact when the identity object is replaced with the same fingerprint", async () => {
    const rendered = renderFlow();
    fireEvent.input(screen.getByLabelText("temporaryLegacyContact"), {
      currentTarget: { value: encodePublicContactQr(legacySender) },
      target: { value: encodePublicContactQr(legacySender) },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "useTemporaryLegacyContact" }),
    );
    expect(screen.getByText("temporaryLegacyContactReady")).toBeDefined();

    rendered.rerender(
      <DecryptFlow
        t={(key) => key}
        identity={{ ...identity }}
        contacts={[]}
        onContactsChange={() => Promise.resolve(true)}
        locale="en"
        autoDecryptIncomingMessages={false}
        pendingIncomingIntent={null}
        onPendingIncomingConsumed={() => undefined}
        cancellationHandle={{ current: null }}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByText("temporaryLegacyContactReady")).toBeNull(),
    );
    expect(
      screen.queryByRole("button", { name: "clearTemporaryLegacyContact" }),
    ).toBeNull();
  });

  it("retains the temporary contact across Decrypt navigation and operation cancellation", async () => {
    const sessionContact = { current: null as Uint8Array | null };
    const cancellation = { current: null as (() => void) | null };
    const rendered = renderFlow({
      cancellationHandle: cancellation,
      legacySenderContactHandle: sessionContact,
    });
    fireEvent.input(screen.getByLabelText("temporaryLegacyContact"), {
      currentTarget: { value: encodePublicContactQr(legacySender) },
      target: { value: encodePublicContactQr(legacySender) },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "useTemporaryLegacyContact" }),
    );
    expect(sessionContact.current).toEqual(encodePublicContact(legacySender));

    cancellation.current?.();
    expect(sessionContact.current).toEqual(encodePublicContact(legacySender));
    rendered.unmount();
    expect(sessionContact.current).toEqual(encodePublicContact(legacySender));

    vi.mocked(startLegacyCompactTextDecryptJob).mockReturnValue({
      requestId: "legacy-after-navigation",
      promise: Promise.resolve(legacyCompactOutput),
      cancel: vi.fn(),
    });
    renderFlow({ legacySenderContactHandle: sessionContact });
    fireEvent.input(screen.getByLabelText("encryptedItem"), {
      currentTarget: { value: legacyCompactText },
      target: { value: legacyCompactText },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "decryptLocally" }),
    );
    await waitFor(() =>
      expect(startLegacyCompactTextDecryptJob).toHaveBeenCalledOnce(),
    );
  });

  it("decrypts compact V1 using one temporary canonical contact without persistence", async () => {
    const onContactsChange = vi.fn(() => Promise.resolve(true));
    vi.mocked(startLegacyCompactTextDecryptJob).mockReturnValue({
      requestId: "legacy-compact",
      promise: Promise.resolve(legacyCompactOutput),
      cancel: vi.fn(),
    });
    renderFlow({ onContactsChange });

    fireEvent.input(screen.getByLabelText("temporaryLegacyContact"), {
      currentTarget: { value: encodePublicContactQr(legacySender) },
      target: { value: encodePublicContactQr(legacySender) },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "useTemporaryLegacyContact" }),
    );
    fireEvent.input(screen.getByLabelText("encryptedItem"), {
      currentTarget: { value: legacyCompactText },
      target: { value: legacyCompactText },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "decryptLocally" }),
    );

    await waitFor(() =>
      expect(startLegacyCompactTextDecryptJob).toHaveBeenCalledOnce(),
    );
    expect(startLegacyCompactTextDecryptJob).toHaveBeenCalledWith({
      ppxqBytes: legacyCompactBytes,
      senderContactBytes: encodePublicContact(legacySender),
      masterEntropy: identity.masterEntropy,
    });
    expect(
      await screen.findByDisplayValue("old compact plaintext"),
    ).toBeDefined();
    expect(onContactsChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "saveSender" })).toBeNull();
  });

  it("auto-decrypts shared full V1 armor through the legacy worker", async () => {
    vi.mocked(startLegacyTextDecryptJob).mockReturnValue({
      requestId: "legacy-shared",
      promise: Promise.resolve(legacyTextOutput),
      cancel: vi.fn(),
    });

    renderFlow({
      autoDecryptIncomingMessages: true,
      incomingSharedText: encodeTextArmor(legacyObject),
    });

    await waitFor(() =>
      expect(startLegacyTextDecryptJob).toHaveBeenCalledOnce(),
    );
    expect(await screen.findByText("legacyContentNotice")).toBeDefined();
    expect(screen.queryByText("incomingMessageReady")).toBeNull();
  });

  it("decrypts an old full-message link through the full V1 worker", async () => {
    vi.mocked(startLegacyTextDecryptJob).mockReturnValue({
      requestId: "legacy-link",
      promise: Promise.resolve(legacyTextOutput),
      cancel: vi.fn(),
    });
    renderFlow();
    const link = encodeMessageLink(
      { kind: "ppxt", object: legacyObject },
      "https://example.test/app/",
    );

    fireEvent.input(screen.getByLabelText("encryptedItem"), {
      currentTarget: { value: link },
      target: { value: link },
    });

    await userEvent.click(
      screen.getByRole("button", { name: "decryptLocally" }),
    );
    await waitFor(() =>
      expect(startLegacyTextDecryptJob).toHaveBeenCalledOnce(),
    );
    expect(await screen.findByDisplayValue("old plaintext")).toBeDefined();
  });

  it("dispatches compressed format-2 Suite-1 #/m text to the full V1 worker", async () => {
    vi.mocked(startLegacyTextDecryptJob).mockReturnValue({
      requestId: "legacy-compressed-link",
      promise: Promise.resolve(legacyTextOutput),
      cancel: vi.fn(),
    });
    renderFlow();
    const link = encodeMessageLink(
      { kind: "ppxt", object: legacyCompressedObject },
      "https://example.test/app/",
    );

    fireEvent.input(screen.getByLabelText("encryptedItem"), {
      currentTarget: { value: link },
      target: { value: link },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "decryptLocally" }),
    );

    await waitFor(() =>
      expect(startLegacyTextDecryptJob).toHaveBeenCalledWith({
        object: legacyCompressedObject,
        masterEntropy: identity.masterEntropy,
      }),
    );
  });
});
