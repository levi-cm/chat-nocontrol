import { expect, test } from "@playwright/test";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { encryptFile } from "../../crypto/file";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";
import { encryptText } from "../../crypto/text";
import { createPublicContact } from "../../protocol/ppxc";
import { encodeEncryptedFileObject } from "../../protocol/ppxf";
import {
  encodeTextArmor,
  PPXT_ARMOR_MAXIMUM_CHARS,
} from "../../protocol/ppxt-armor";
import { importSessionIdentity } from "./helpers";
import { displayIdentityId } from "../../components/cards/contact-management-card";
import { formatFingerprintBytes } from "../../components/cards/public-contact-card";

test("validates then decrypts armored text with unknown-sender warning", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let value = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: () => Promise.resolve(value),
        writeText: (next: string) => {
          value = next;
          return Promise.resolve();
        },
      },
    });
  });
  const alice = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(1),
    "Alice",
  );
  const bobEntropy = new Uint8Array(32).fill(2);
  const bob = await deriveIdentityFromEntropy(bobEntropy, "Bob");
  const aliceContact = createPublicContact(alice, "Alice", 1n);
  const bobContact = createPublicContact(bob, "Bob", 2n);
  const armor = encodeTextArmor(
    await encryptText({
      sender: aliceContact,
      senderSigningCapability: createSenderSigningCapability(alice),
      recipient: bobContact,
      plaintext: "Verified secret",
      messageId: new Uint8Array(16).fill(4),
      sentAt: 3n,
      createdAt: 3n,
    }),
  );
  const bobWords = createRecoveryWordCodec()
    .entropyToRecoveryWords(bobEntropy)
    .join(" ");
  const renamedFile = encodeEncryptedFileObject(
    await encryptFile({
      sender: aliceContact,
      senderSigningCapability: createSenderSigningCapability(alice),
      recipient: bobContact,
      file: new Blob(["renamed file content"]),
      filename: "renamed.txt",
      mimeHint: "text/plain",
      caption: "",
      fileLength: 20n,
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Import identity" }).click();
  await page.getByLabel("Pseudonym").fill("Bob");
  await page.getByLabel("24 recovery words").fill(bobWords);
  await page.getByRole("button", { name: "Import recovery words" }).click();
  await page.getByRole("button", { name: "No, use session only" }).click();
  await page.getByRole("link", { name: "Decrypt" }).click();
  const smartArea = page.getByTestId("smart-decrypt-input");
  await expect(smartArea.getByLabel("Encrypted item")).toBeVisible();
  await expect(smartArea.getByLabel("Encrypted file")).toBeVisible();
  await page.getByLabel("Encrypted item").fill(armor);
  await page.getByRole("button", { name: "Decrypt locally" }).click();
  const decrypted = page.getByLabel("Decrypted text");
  await expect(decrypted).toHaveValue("Verified secret");
  await expect(decrypted).toHaveAttribute("readonly", "");
  await page.getByRole("button", { name: "Copy decrypted text" }).click();
  await expect(
    page.getByText(
      "Copied. Clipboard clearing after 60 seconds is best effort.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Unknown sender" }),
  ).toBeVisible();
  const senderCard = page.getByLabel("Authenticated sender");
  await expect(senderCard.getByText("Alice", { exact: true })).toBeVisible();
  await expect(senderCard).toContainText(
    displayIdentityId(aliceContact.identityId),
  );
  await expect(senderCard).toContainText("Unknown sender");
  await senderCard.getByText("Fingerprint", { exact: true }).click();
  await expect(senderCard).toContainText(
    formatFingerprintBytes(aliceContact.fingerprint, 32),
  );
  await expect(
    page.getByText(
      "This message is cryptographically valid, but you have not saved this sender yet.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save contact" }).click();
  await expect(senderCard).toContainText("Known contact");

  await page.evaluate((droppedArmor) => {
    const area = document.querySelector<HTMLElement>(
      '[data-testid="smart-decrypt-input"]',
    );
    const transfer = new DataTransfer();
    transfer.setData("text/plain", droppedArmor);
    area?.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  }, armor);
  await expect(page.getByLabel("Encrypted item")).toHaveValue(armor);

  await page.getByLabel("Encrypted file").setInputFiles({
    name: "saved.ppxmessage",
    mimeType: "application/x-ppx-message",
    buffer: Buffer.from(armor),
  });
  await expect(page.getByLabel("Encrypted item")).toHaveValue(armor);
  await expect(page.getByText("saved.ppxmessage", { exact: true })).toHaveCount(
    0,
  );

  await page.getByLabel("Encrypted file").setInputFiles({
    name: "renamed.ppxmessage",
    mimeType: "application/x-ppx-message",
    buffer: Buffer.from(renamedFile),
  });
  await expect(
    page.getByText(/Selected file: renamed\.ppxmessage/u),
  ).toBeVisible();
  await expect(page.getByLabel("Encrypted item")).toHaveValue("");
  await page.getByRole("button", { name: "Decrypt locally" }).click();
  await expect(page.getByText("renamed.txt", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Authenticated sender")).toContainText(
    "Known contact",
  );
});

test("rejects oversized dropped text before retaining it in component state", async ({
  page,
}) => {
  await page.goto("/");
  await importSessionIdentity(page, {
    entropy: new Uint8Array(32).fill(9),
    pseudonym: "Bounded Bob",
  });
  await page.getByRole("link", { name: "Decrypt" }).click();

  await page.evaluate((maximum) => {
    const area = document.querySelector<HTMLElement>(
      '[data-testid="smart-decrypt-input"]',
    );
    const transfer = new DataTransfer();
    transfer.setData("text/plain", "X".repeat(maximum + 1));
    area?.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  }, PPXT_ARMOR_MAXIMUM_CHARS);

  await expect(page.getByLabel("Encrypted item")).toHaveValue("");
  await expect(page.getByRole("alert")).toHaveText(
    "The encrypted text is too large to import.",
  );
});
