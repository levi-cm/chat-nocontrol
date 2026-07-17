import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { EncryptFileFlow } from "../../flows/encrypt/file";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import { startEncryptFileJob } from "../../workers/file-client";

vi.mock("../../workers/file-client", () => ({
  FileWorkerCancelled: class FileWorkerCancelled extends Error {},
  startEncryptFileJob: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Cat-5 file encryption flow", () => {
  it("starts V2 encryption with only a signing capability", async () => {
    const senderIdentity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(11),
      "Sender",
    );
    const recipientIdentity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(12),
      "Recipient",
    );
    const sender = createPublicContactV2(
      senderIdentity,
      "Sender",
      11n,
      new Uint8Array(32).fill(13),
    );
    const recipient = createPublicContactV2(
      recipientIdentity,
      "Recipient",
      12n,
      new Uint8Array(32).fill(14),
    );
    vi.mocked(startEncryptFileJob).mockReturnValue({
      requestId: "encrypt-v2",
      promise: Promise.resolve({
        blob: new Blob([new Uint8Array([1, 2])]),
        plaintextLength: 1n,
        encodedLength: 2n,
      }),
      cancel: vi.fn(),
    });

    render(
      <EncryptFileFlow
        t={(key) => key}
        identity={senderIdentity}
        sender={sender}
        recipient={recipient}
        locale="en"
        onBusyChange={vi.fn()}
      />,
    );

    await userEvent.upload(
      screen.getByLabelText("fileToEncrypt"),
      new File([new Uint8Array([42])], "secret.bin", {
        type: "application/octet-stream",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "encryptFileLocally" }),
    );

    await waitFor(() => expect(startEncryptFileJob).toHaveBeenCalledOnce());
    const input = vi.mocked(startEncryptFileJob).mock.calls[0]?.[0];
    expect(input).toMatchObject({ sender, recipient, filename: "secret.bin" });
    expect(input?.senderSigningCapability).toMatchObject({
      suite: 2,
      fingerprint: senderIdentity.fingerprint,
      signingPublicKey: senderIdentity.signingPublicKey,
      signingSecretKey: senderIdentity.signingSecretKey,
    });
    expect(input?.senderSigningCapability).not.toHaveProperty("masterEntropy");
    expect(input?.senderSigningCapability).not.toHaveProperty("kemSecretKey");
  });
});
