import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { DecryptFlow } from "../../flows/decrypt";

afterEach(cleanup);

describe("incoming decrypt cancellation", () => {
  it("invalidates pending async file routing before stale content can win", async () => {
    const identity = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(91),
      "Recipient",
    );
    let releasePrefix!: (value: ArrayBuffer) => void;
    const prefix = new Promise<ArrayBuffer>((resolve) => {
      releasePrefix = resolve;
    });
    const file = new File([new Uint8Array([1])], "slow.ppxmessage");
    Object.defineProperty(file, "slice", {
      value: () => ({ arrayBuffer: () => prefix }),
    });
    const cancellationHandle = { current: null as (() => void) | null };

    render(
      <DecryptFlow
        t={(key) => key}
        identity={identity}
        contacts={[]}
        onContactsChange={() => Promise.resolve(true)}
        locale="en"
        qrImportControls="image"
        autoDecryptIncomingMessages
        pendingIncomingIntent={null}
        onPendingIncomingConsumed={() => undefined}
        cancellationHandle={cancellationHandle}
      />,
    );

    fireEvent.drop(screen.getByTestId("smart-decrypt-input"), {
      dataTransfer: {
        files: { item: () => file },
        getData: () => "",
      },
    });
    await waitFor(() => expect(cancellationHandle.current).not.toBeNull());
    cancellationHandle.current?.();
    releasePrefix(
      new TextEncoder().encode("-----BEGIN PPX ENCRYPTED TEXT-----").buffer,
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(
      screen.getByLabelText<HTMLTextAreaElement>("encryptedItem").value,
    ).toBe("");
    expect(screen.queryByText(/slow\.ppxmessage/u)).toBeNull();
  });
});
