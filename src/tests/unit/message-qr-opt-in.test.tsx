import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EncryptTextFlow } from "../../flows/encrypt/text";
import { messages } from "../../i18n";
import { parseEncryptedTextOuter } from "../../protocol/ppxt-outer";
import type { DerivedIdentity, PublicContact } from "../../protocol/types";
import { canonicalProtocolBytes } from "../helpers/canonical-protocol";

const workerMocks = vi.hoisted(() => ({
  startEncryptTextJob: vi.fn(),
  startEncryptQrTextJob: vi.fn(),
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("message QR creation opt-in", () => {
  it.each([
    [false, 0],
    [true, 1],
  ] as const)(
    "starts the PPXQ worker only when creationEnabled=%s",
    async (messageQrCreationEnabled, expectedCalls) => {
      const object = parseEncryptedTextOuter(
        (await canonicalProtocolBytes()).ppxt,
      );
      workerMocks.startEncryptTextJob.mockReturnValue({
        requestId: "ppxt",
        promise: Promise.resolve(object),
        cancel: vi.fn(),
      });
      workerMocks.startEncryptQrTextJob.mockReturnValue({
        requestId: "ppxq",
        promise: new Promise(() => undefined),
        cancel: vi.fn(),
      });
      const sender = contactFixture(8, "Alice");
      const recipient = contactFixture(9, "Bob");
      const user = userEvent.setup();

      render(
        <EncryptTextFlow
          t={(key) => messages.en[key]}
          identity={identityFixture()}
          sender={sender}
          contacts={[{ contact: recipient, nickname: "Bob" }]}
          locale="en"
          messageQrCreationEnabled={messageQrCreationEnabled}
          qrExportMode="both"
        />,
      );
      await user.selectOptions(
        screen.getByLabelText("Recipient"),
        "09".repeat(32),
      );
      await user.type(screen.getByLabelText("Encrypted text"), "hello");
      await user.click(screen.getByRole("button", { name: "Encrypt" }));

      await waitFor(() =>
        expect(workerMocks.startEncryptTextJob).toHaveBeenCalledOnce(),
      );
      expect(workerMocks.startEncryptQrTextJob).toHaveBeenCalledTimes(
        expectedCalls,
      );
      expect(screen.getByLabelText("Encrypted output")).not.toBeNull();
    },
  );
});
