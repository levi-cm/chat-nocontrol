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
  createSenderSigningCapabilityV2,
  deriveIdentityV2FromEntropy,
} from "../../crypto/identity-v2";
import { encryptTextV2 } from "../../crypto/text-v2";
import { DecryptFlow } from "../../flows/decrypt";
import decryptFlowSource from "../../flows/decrypt/index.tsx?raw";
import { encodeMessageLinkV2 } from "../../protocol/message-link-v2";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import { encodeTextArmorV2 } from "../../protocol/ppxt-armor-v2";
import type {
  DecryptedTextOutputV2,
  DerivedIdentityV2,
  EncryptedTextObjectV2,
  PublicContactV2,
} from "../../protocol/types-v2";
import { startDecryptTextJob } from "../../workers/crypto-client";

vi.mock("../../workers/crypto-client", () => ({
  startDecryptTextJob: vi.fn(),
}));

const bytes = (length: number, value: number) =>
  new Uint8Array(length).fill(value);

describe("Cat-5 decrypt text flow", () => {
  let identity: DerivedIdentityV2;
  let sender: PublicContactV2;
  let full: EncryptedTextObjectV2;
  let compact: EncryptedTextObjectV2;
  let output: DecryptedTextOutputV2;

  beforeAll(async () => {
    const senderIdentity = await deriveIdentityV2FromEntropy(bytes(32, 0x31));
    identity = await deriveIdentityV2FromEntropy(bytes(32, 0x32));
    sender = createPublicContactV2(
      senderIdentity,
      "Sender",
      1n,
      bytes(32, 0x33),
    );
    const recipient = createPublicContactV2(
      identity,
      "Recipient",
      2n,
      bytes(32, 0x34),
    );
    const encrypt = (compactInput: boolean) =>
      encryptTextV2({
        compact: compactInput,
        sender,
        senderSigningCapability:
          createSenderSigningCapabilityV2(senderIdentity),
        recipient,
        plaintext: "verified plaintext",
        messageId: bytes(16, 0x35),
        sentAt: 3n,
        createdAt: 4n,
      });
    full = await encrypt(false);
    compact = await encrypt(true);
    output = {
      senderContact: sender,
      recipientId: identity.identityId,
      messageId: bytes(16, 0x35),
      sentAt: 3n,
      createdAt: 4n,
      plaintext: "verified plaintext",
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
        contacts={[
          {
            contact: sender,
            nickname: "",
            includeSenderContactInLinks: true,
          },
        ]}
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

  it("decodes PPXT V2 armor and sends only decapsulation authority", async () => {
    vi.mocked(startDecryptTextJob).mockReturnValue({
      requestId: "full-v2",
      promise: Promise.resolve(output),
      cancel: vi.fn(),
    });
    renderFlow();

    fireEvent.input(screen.getByLabelText("encryptedItem"), {
      currentTarget: { value: encodeTextArmorV2(full) },
      target: { value: encodeTextArmorV2(full) },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "decryptLocally" }),
    );

    await waitFor(() => expect(startDecryptTextJob).toHaveBeenCalledOnce());
    const input = vi.mocked(startDecryptTextJob).mock.calls[0]?.[0];
    expect(input?.object).toEqual(full);
    expect(input?.knownSenders).toEqual([sender]);
    expect(input?.activeIdentity).toMatchObject({
      suite: 2,
      fingerprint: identity.fingerprint,
      identityId: identity.identityId,
      kemSecretKey: identity.kemSecretKey,
    });
    expect(input?.activeIdentity).not.toHaveProperty("masterEntropy");
    expect(input?.activeIdentity).not.toHaveProperty("signingSecretKey");
    expect(await screen.findByDisplayValue("verified plaintext")).toBeDefined();
  });

  it("auto-decrypts incoming PPXM with known saved contacts", async () => {
    vi.mocked(startDecryptTextJob).mockReturnValue({
      requestId: "compact-v2",
      promise: Promise.resolve(output),
      cancel: vi.fn(),
    });
    const consumed = vi.fn();
    const intent = { kind: "ppxm" as const, object: compact, capturedAt: 9 };
    renderFlow({
      autoDecryptIncomingMessages: true,
      pendingIncomingIntent: intent,
      onPendingIncomingConsumed: consumed,
    });

    await waitFor(() => expect(startDecryptTextJob).toHaveBeenCalledOnce());
    expect(vi.mocked(startDecryptTextJob).mock.calls[0]?.[0]).toMatchObject({
      object: compact,
      knownSenders: [sender],
    });
    await waitFor(() => expect(consumed).toHaveBeenCalledWith(intent));
  });

  it("loads shared V2 text, replaces plaintext, and honors manual policy", async () => {
    vi.mocked(startDecryptTextJob).mockReturnValue({
      requestId: "initial-v2",
      promise: Promise.resolve(output),
      cancel: vi.fn(),
    });
    const view = renderFlow();
    fireEvent.input(screen.getByLabelText("encryptedItem"), {
      currentTarget: { value: encodeTextArmorV2(full) },
      target: { value: encodeTextArmorV2(full) },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "decryptLocally" }),
    );
    expect(await screen.findByDisplayValue("verified plaintext")).toBeDefined();

    const shared = encodeMessageLinkV2(
      { kind: "ppxm", object: compact },
      "https://example.test/app/",
    );
    view.rerender(
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
        incomingSharedText={shared}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByDisplayValue("verified plaintext")).toBeNull(),
    );
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "decryptLocally",
      }).disabled,
    ).toBe(false);
  });

  it("auto-decrypts shared PPXT armor only through the verified worker", async () => {
    let release!: (value: DecryptedTextOutputV2) => void;
    const promise = new Promise<DecryptedTextOutputV2>((resolve) => {
      release = resolve;
    });
    const cancel = vi.fn();
    vi.mocked(startDecryptTextJob).mockReturnValue({
      requestId: "shared-auto-v2",
      promise,
      cancel,
    });
    const consumed = vi.fn();
    const view = renderFlow({
      autoDecryptIncomingMessages: true,
      incomingSharedText: encodeTextArmorV2(full),
      onIncomingSharedTextConsumed: consumed,
    });

    await waitFor(() => expect(startDecryptTextJob).toHaveBeenCalledOnce());
    expect(consumed).toHaveBeenCalledOnce();
    view.rerender(
      <DecryptFlow
        t={(key) => key}
        identity={identity}
        contacts={[
          {
            contact: sender,
            nickname: "",
            includeSenderContactInLinks: true,
          },
        ]}
        onContactsChange={() => Promise.resolve(true)}
        locale="en"
        autoDecryptIncomingMessages
        pendingIncomingIntent={null}
        onPendingIncomingConsumed={() => undefined}
        cancellationHandle={{ current: null }}
        incomingSharedText={null}
        onIncomingSharedTextConsumed={consumed}
      />,
    );
    expect(cancel).not.toHaveBeenCalled();
    release(output);
    expect(vi.mocked(startDecryptTextJob).mock.calls[0]?.[0].object).toEqual(
      full,
    );
    expect(await screen.findByDisplayValue("verified plaintext")).toBeDefined();
  });

  it("has no legacy PPXQ or message scanner reachability", () => {
    expect(decryptFlowSource).not.toMatch(
      /PPXQ|ppxq|QrImport|startDecryptQr|parseQr/u,
    );
    expect(decryptFlowSource).not.toContain("qrImportControls");
  });
});
