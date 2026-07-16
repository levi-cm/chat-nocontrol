import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { DecryptFileFlow } from "../../flows/decrypt/file";
import { createPublicContact } from "../../protocol/ppxc";
import type { DecryptedFileOutput } from "../../protocol/types";
import { startDecryptFileJob } from "../../workers/file-client";

vi.mock("../../workers/file-client", () => ({
  FileWorkerCancelled: class FileWorkerCancelled extends Error {},
  startDecryptFileJob: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("decrypted file sender contact preference", () => {
  it("defaults a newly saved authenticated sender to contact-inclusive links", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(5),
      "Recipient",
    );
    const senderIdentity = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(6),
      "Sender",
    );
    const senderContact = createPublicContact(senderIdentity, "Sender", 6n);
    const decrypted: DecryptedFileOutput = {
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
        file={new File([new Uint8Array([1])], "encrypted.ppxf")}
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
    expect(onContactsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        contact: senderContact,
        includeSenderContactInLinks: true,
      }),
    ]);
  });

  it("exposes synchronous cancellation for an active file worker", async () => {
    const identity = await deriveIdentityFromEntropy(
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
        file={new File([new Uint8Array([1])], "encrypted.ppxf")}
        startToken={1}
        onBusyChange={vi.fn()}
        cancellationHandle={cancellationHandle}
        locale="en"
      />,
    );

    await waitFor(() => expect(startDecryptFileJob).toHaveBeenCalledOnce());
    cancellationHandle.current?.();
    expect(cancel).toHaveBeenCalledOnce();
  });
});
