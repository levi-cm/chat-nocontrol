import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import { DecryptFileFlow } from "../../flows/decrypt/file";
import { createPublicContact } from "../../protocol/ppxc";
import { createPublicContactV2 } from "../../protocol/ppxc-v2";
import type { DecryptedFileOutput } from "../../protocol/types";
import type { DecryptedFileOutputV2 } from "../../protocol/types-v2";
import { startDecryptFileJob } from "../../workers/file-client";
import { startLegacyFileDecryptJob } from "../../workers/legacy-v1-client";

vi.mock("../../workers/file-client", () => ({
  FileWorkerCancelled: class FileWorkerCancelled extends Error {},
  startDecryptFileJob: vi.fn(),
}));

vi.mock("../../workers/legacy-v1-client", () => ({
  LegacyV1WorkerCancelled: class LegacyV1WorkerCancelled extends Error {},
  startLegacyFileDecryptJob: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const legacyFile = () =>
  new File(
    [Uint8Array.of(0x50, 0x50, 0x58, 0x46, 0x01, 0x01)],
    "legacy.ppxfile",
  );

const cat5File = () =>
  new File([Uint8Array.of(0x50, 0x50, 0x58, 0x46, 0x02, 0x02)], "cat5.ppxfile");

describe("file preview safety", () => {
  it("shows previewUnavailable for legacy authenticated files without blob URLs", async () => {
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(17),
      "Recipient",
    );
    const legacySenderIdentity = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(18),
      "Sender",
    );
    const senderContact = createPublicContact(
      legacySenderIdentity,
      "Sender",
      18n,
    );
    const legacyResult: DecryptedFileOutput = {
      senderContact,
      recipientId: identity.identityId,
      filename: "legacy.png",
      mimeHint: "image/png",
      caption: "",
      fileLength: 4n,
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" }),
      digestValid: true,
      signatureValid: true,
    };
    vi.mocked(startLegacyFileDecryptJob).mockReturnValue({
      requestId: "legacy-file",
      promise: Promise.resolve(legacyResult),
      cancel: vi.fn(),
    });
    const createObjectUrl = vi.spyOn(URL, "createObjectURL");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");

    render(
      <DecryptFileFlow
        t={(key) => key}
        identity={identity}
        contacts={[]}
        onContactsChange={() => Promise.resolve(true)}
        file={legacyFile()}
        startToken={1}
        onBusyChange={vi.fn()}
        cancellationHandle={{ current: null }}
        locale="en"
      />,
    );

    await waitFor(() =>
      expect(startLegacyFileDecryptJob).toHaveBeenCalledOnce(),
    );
    await screen.findByText("previewUnavailable");
    expect(screen.getByText(/authenticatedLegacySenderLabel/u)).toBeDefined();
    expect(screen.queryByLabelText("filePreview")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("audio")).toBeNull();
    expect(screen.queryByRole("video")).toBeNull();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(revokeObjectUrl).not.toHaveBeenCalled();
  });

  it("shows previewUnavailable for unsupported CAT5 V2 mime without blob URLs", async () => {
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(19),
      "Recipient",
    );
    const senderIdentity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(20),
      "Sender",
    );
    const senderContact = createPublicContactV2(
      senderIdentity,
      "Sender",
      20n,
      new Uint8Array(32).fill(21),
    );
    const result: DecryptedFileOutputV2 = {
      senderContact,
      recipientId: identity.identityId,
      filename: "hostile.m3u8",
      mimeHint: "application/vnd.apple.mpegurl",
      caption: "",
      fileLength: 4n,
      blob: new Blob(["#EXTM3U"]),
      digestValid: true,
      signatureValid: true,
    };
    vi.mocked(startDecryptFileJob).mockReturnValue({
      requestId: "cat5-file",
      promise: Promise.resolve(result),
      cancel: vi.fn(),
    });
    const createObjectUrl = vi.spyOn(URL, "createObjectURL");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");

    render(
      <DecryptFileFlow
        t={(key) => key}
        identity={identity}
        contacts={[]}
        onContactsChange={() => Promise.resolve(true)}
        file={cat5File()}
        startToken={1}
        onBusyChange={vi.fn()}
        cancellationHandle={{ current: null }}
        locale="en"
      />,
    );

    await waitFor(() => expect(startDecryptFileJob).toHaveBeenCalledOnce());
    await screen.findByText("previewUnavailable");
    expect(screen.queryByLabelText("filePreview")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("audio")).toBeNull();
    expect(screen.queryByRole("video")).toBeNull();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(revokeObjectUrl).not.toHaveBeenCalled();
  });

  it("revokes CAT5 V2 preview URLs on file change and unmount", async () => {
    const identity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(22),
      "Recipient",
    );
    const senderIdentity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(23),
      "Sender",
    );
    const senderContact = createPublicContactV2(
      senderIdentity,
      "Sender",
      23n,
      new Uint8Array(32).fill(24),
    );
    const firstResult: DecryptedFileOutputV2 = {
      senderContact,
      recipientId: identity.identityId,
      filename: "first.png",
      mimeHint: "image/png",
      caption: "",
      fileLength: 4n,
      blob: new Blob([new Uint8Array([1, 1, 1, 1])], { type: "image/png" }),
      digestValid: true,
      signatureValid: true,
    };
    const secondResult: DecryptedFileOutputV2 = {
      ...firstResult,
      filename: "second.ogg",
      mimeHint: "audio/ogg",
      blob: new Blob([new Uint8Array([2, 2, 2, 2])], { type: "audio/ogg" }),
    };
    vi.mocked(startDecryptFileJob)
      .mockReturnValueOnce({
        requestId: "first-file",
        promise: Promise.resolve(firstResult),
        cancel: vi.fn(),
      })
      .mockReturnValueOnce({
        requestId: "second-file",
        promise: Promise.resolve(secondResult),
        cancel: vi.fn(),
      });
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const revokeObjectUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const view = render(
      <DecryptFileFlow
        t={(key) => key}
        identity={identity}
        contacts={[]}
        onContactsChange={() => Promise.resolve(true)}
        file={cat5File()}
        startToken={1}
        onBusyChange={vi.fn()}
        cancellationHandle={{ current: null }}
        locale="en"
      />,
    );

    await screen.findByRole("img");
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).not.toHaveBeenCalled();

    view.rerender(
      <DecryptFileFlow
        t={(key) => key}
        identity={identity}
        contacts={[]}
        onContactsChange={() => Promise.resolve(true)}
        file={cat5File()}
        startToken={2}
        onBusyChange={vi.fn()}
        cancellationHandle={{ current: null }}
        locale="en"
      />,
    );

    await screen.findByLabelText("filePreview");
    expect(createObjectUrl).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(revokeObjectUrl).toHaveBeenCalledTimes(2);
  });
});
