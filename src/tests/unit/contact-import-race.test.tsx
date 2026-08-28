import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ContactsManage } from "../../flows/contacts/manage";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { deriveIdentityV2FromEntropy } from "../../crypto/identity-v2";
import type { MessageKey } from "../../i18n";
import { encodeBase45Upper } from "../../protocol/base45";
import {
  createPublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";
import {
  createPublicContactV2,
  encodePublicContactV2,
  encodePublicContactV2Text,
} from "../../protocol/ppxc-v2";
import type { PublicContactV2 } from "../../protocol/types-v2";

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
  mergeNote: "Existing contact updated",
};

afterEach(cleanup);

describe("contact import source ownership", () => {
  let first: PublicContactV2;
  let second: PublicContactV2;

  beforeAll(async () => {
    const firstIdentity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(1),
      "First",
      1n,
    );
    const secondIdentity = await deriveIdentityV2FromEntropy(
      new Uint8Array(32).fill(2),
      "Second",
      2n,
    );
    first = createPublicContactV2(
      firstIdentity,
      "First",
      1n,
      new Uint8Array(32).fill(0x31),
    );
    second = createPublicContactV2(
      secondIdentity,
      "Second",
      2n,
      new Uint8Array(32).fill(0x32),
    );
  });

  it("preserves an existing compact-link preference when re-importing the same fingerprint", async () => {
    const contact = first;
    const onChange = vi.fn(() => true);

    render(
      <ContactsManage
        t={(key) => labels[key] ?? key}
        contacts={[
          {
            contact,
            nickname: "Old nickname",
            includeSenderContactInLinks: false,
          },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.input(screen.getByLabelText("Public contact payload"), {
      target: { value: encodePublicContactV2Text(contact) },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Save public contact" }),
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith({
      kind: "update",
      fingerprint: contact.fingerprint,
      patch: {},
    });
  });

  it("preserves the signed contact on zero-time re-import while applying an explicit nickname", async () => {
    const existing = first;
    const reimported = first;
    const onChange = vi.fn(() => true);

    render(
      <ContactsManage
        t={(key) => labels[key] ?? key}
        contacts={[
          {
            contact: existing,
            nickname: "Old nickname",
            includeSenderContactInLinks: false,
          },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.input(screen.getByLabelText("Public contact payload"), {
      target: { value: encodePublicContactV2Text(reimported) },
    });
    await userEvent.type(screen.getByLabelText("Nickname"), "New nickname");
    await userEvent.click(
      screen.getByRole("button", { name: "Save public contact" }),
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenCalledWith({
      kind: "update",
      fingerprint: reimported.fingerprint,
      patch: { nickname: "New nickname" },
    });
  });

  it("defaults a newly imported contact to including sender contact in links", async () => {
    const contact = second;
    const onChange = vi.fn(() => true);

    render(
      <ContactsManage
        t={(key) => labels[key] ?? key}
        contacts={[]}
        onChange={onChange}
      />,
    );

    fireEvent.input(screen.getByLabelText("Public contact payload"), {
      target: { value: encodePublicContactV2Text(contact) },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Save public contact" }),
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith({
      kind: "add",
      item: {
        contact,
        nickname: "",
        includeSenderContactInLinks: true,
      },
    });
  });

  it("ignores a slow file after a newer contact file wins", async () => {
    let resolveFirst: ((text: string) => void) | undefined;
    const readBytes = vi.fn((file: File) => {
      if (file.name === "first.ppxcontact") {
        return new Promise<string>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(encodePublicContactV2Text(second));
    });
    render(
      <ContactsManage
        t={(key) => labels[key] ?? key}
        contacts={[]}
        onChange={() => true}
        readContactFileText={readBytes}
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
      expect(payload.value).toBe(encodePublicContactV2Text(second)),
    );
    resolveFirst?.(encodePublicContactV2Text(first));
    await Promise.resolve();
    expect(payload.value).toBe(encodePublicContactV2Text(second));
    expect(screen.getByText("Selected file: second.ppxcontact")).not.toBeNull();
  });

  it("accepts a dropped PPX2 contact text payload without QR controls", async () => {
    const onChange = vi.fn(() => true);
    render(
      <ContactsManage
        t={(key) => labels[key] ?? key}
        contacts={[]}
        onChange={onChange}
      />,
    );

    expect(screen.queryByText("Scan a QR code")).toBeNull();
    fireEvent.drop(screen.getByTestId("contact-import-drop-zone"), {
      dataTransfer: {
        files: { item: () => null },
        getData: (type: string) =>
          type === "text/plain" ? encodePublicContactV2Text(first) : "",
      },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Save public contact" }),
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenCalledWith({
      kind: "add",
      item: {
        contact: first,
        nickname: "",
        includeSenderContactInLinks: true,
      },
    });
  });

  it("hard rejects V1 and unknown-suite contact text", async () => {
    const legacyIdentity = await deriveIdentityFromEntropy(
      new Uint8Array(32).fill(9),
      "Legacy",
    );
    const legacy = createPublicContact(legacyIdentity, "Legacy", 9n);
    const unknownSuite = encodePublicContactV2(first);
    unknownSuite[5] = 0x7f;
    const onChange = vi.fn(() => true);
    render(
      <ContactsManage
        t={(key) => labels[key] ?? key}
        contacts={[]}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText("Public contact payload");
    const save = screen.getByRole("button", { name: "Save public contact" });

    fireEvent.input(input, {
      target: { value: encodePublicContactQr(legacy) },
    });
    await userEvent.click(save);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "legacyContactUnsupported",
    );
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.clear(input);
    fireEvent.input(input, {
      target: { value: `PPX2:CONTACT:${encodeBase45Upper(unknownSuite)}` },
    });
    await userEvent.click(save);
    expect(onChange).not.toHaveBeenCalled();
  });
});
