import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactsManage } from "../../flows/contacts/manage";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import type { MessageKey } from "../../i18n";
import {
  createPublicContact,
  encodePublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";

const labels: Partial<Record<MessageKey, string>> = {
  contactsTitle: "Contacts",
  contactPayload: "Public contact payload",
  nickname: "Nickname",
  contactFile: "Public contact file",
  selectedFile: "Selected file",
  saveContact: "Save public contact",
  contactsEmpty: "No contacts yet",
  scanQrTitle: "Scan a QR code",
  qrImage: "QR image",
  scanWithCamera: "Scan with camera",
  cameraPreview: "Camera preview",
};

afterEach(cleanup);

describe("contact import source ownership", () => {
  it("ignores a slow file after a newer contact file wins", async () => {
    const firstIdentity = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(1),
      "First",
    );
    const secondIdentity = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(2),
      "Second",
    );
    const first = createPublicContact(firstIdentity, "First", 1n);
    const second = createPublicContact(secondIdentity, "Second", 2n);
    let resolveFirst: ((bytes: Uint8Array) => void) | undefined;
    const readBytes = vi.fn((file: File) => {
      if (file.name === "first.ppxcontact") {
        return new Promise<Uint8Array>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(encodePublicContact(second));
    });
    render(
      <ContactsManage
        t={(key) => labels[key] ?? key}
        contacts={[]}
        onChange={() => true}
        readContactFileBytes={readBytes}
      />,
    );
    const input = screen.getByLabelText("Public contact file");
    await userEvent.upload(
      input,
      new File(["first"], "first.ppxcontact", {
        type: "application/x-ppx-contact",
      }),
    );
    await userEvent.upload(
      input,
      new File(["second"], "second.ppxcontact", {
        type: "application/x-ppx-contact",
      }),
    );
    const payload = screen.getByLabelText<HTMLTextAreaElement>(
      "Public contact payload",
    );
    await waitFor(() =>
      expect(payload.value).toBe(encodePublicContactQr(second)),
    );
    resolveFirst?.(encodePublicContact(first));
    await Promise.resolve();
    expect(payload.value).toBe(encodePublicContactQr(second));
    expect(screen.getByText("Selected file: second.ppxcontact")).not.toBeNull();
  });
});
