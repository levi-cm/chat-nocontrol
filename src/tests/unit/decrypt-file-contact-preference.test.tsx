import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { DecryptFileFlow } from "../../flows/decrypt/file";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import type { DecryptedFileOutputV2 } from "../../protocol/types-v2";
import { startDecryptFileJob } from "../../workers/file-client";

vi.mock("../../workers/file-client", () => ({
  FileWorkerCancelled: class FileWorkerCancelled extends Error {},
  startDecryptFileJob: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const cat5File = () =>
  new File(
    [Uint8Array.of(0x50, 0x50, 0x58, 0x46, 0x02, 0x02, 0x00)],
    "encrypted.ppxf",
  );

describe("decrypted file sender contact preference", () => {
  it("defaults a newly saved authenticated sender to contact-inclusive links", async () => {
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(5),
      "Recipient",
    );
    const senderIdentity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(6),
      "Sender",
    );
    const senderContact = createPublicContactV2(
      senderIdentity,
      "Sender",
      6n,
      new Uint8Array(32).fill(9),
    );
    const decrypted: DecryptedFileOutputV2 = {
      senderContact,
      recipientId: identity.identityId,
      filename: "message.bin",
      mimeHint: "application/octet-stream",
      caption: "",
      fileLength: 1n,
      blob: new Blob([new Uint8Array([1])]),
      digestValid: true,
      signatureValid: true,
    };
    vi.mocked(startDecryptFileJob).mockReturnValue({
      requestId: "file-test",
      promise: Promise.resolve(decrypted),
      cancel: vi.fn(),
    });
    const onContactsChange = vi.fn(() => Promise.resolve(true));
    const cancellationHandle = { current: null as (() => void) | null };

    render(
      <DecryptFileFlow
        t={(key) => key}
        identity={identity}
        contacts={[]}
        onContactsChange={onContactsChange}
        file={cat5File()}
        startToken={1}
        onBusyChange={vi.fn()}
        cancellationHandle={cancellationHandle}
        locale="en"
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "saveSender" }),
    );

    await waitFor(() => expect(onContactsChange).toHaveBeenCalledTimes(1));
    expect(onContactsChange).toHaveBeenCalledWith({
      kind: "add",
      item: {
        contact: senderContact,
        nickname: "",
        includeSenderContactInLinks: true,
      },
    });
  });

  it("exposes synchronous cancellation for an active file worker", async () => {
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(7),
      "Recipient",
    );
    const cancel = vi.fn();
    vi.mocked(startDecryptFileJob).mockReturnValue({
      requestId: "pending-file",
      promise: new Promise(() => undefined),
      cancel,
    });
    const cancellationHandle = { current: null as (() => void) | null };

    render(
      <DecryptFileFlow
        t={(key) => key}
        identity={identity}
        contacts={[]}
        onContactsChange={() => Promise.resolve(true)}
        file={cat5File()}
        startToken={1}
        onBusyChange={vi.fn()}
        cancellationHandle={cancellationHandle}
        locale="en"
      />,
    );

    await waitFor(() => expect(startDecryptFileJob).toHaveBeenCalledOnce());
    const input = vi.mocked(startDecryptFileJob).mock.calls[0]?.[0];
    expect(input?.activeIdentity).toMatchObject({
      suite: 2,
      fingerprint: identity.fingerprint,
      identityId: identity.identityId,
      kemSecretKey: identity.kemSecretKey,
    });
    expect(input?.activeIdentity).not.toHaveProperty("masterEntropy");
    expect(input?.activeIdentity).not.toHaveProperty("signingSecretKey");
    cancellationHandle.current?.();
    expect(cancel).toHaveBeenCalledOnce();
  });
});
