import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { encryptFile } from "../src/crypto/file";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../src/crypto/identity";
import { encryptQrText } from "../src/crypto/qr-text";
import { createRecoveryWordCodec } from "../src/crypto/recovery-words";
import { encryptText } from "../src/crypto/text";
import { zeroize } from "../src/crypto/zeroize";
import { encodeBase45Upper } from "../src/protocol/base45";
import { encodeMessageLink } from "../src/protocol/message-link";
import {
  createPublicContact,
  encodePublicContact,
  encodePublicContactQr,
} from "../src/protocol/ppxc";
import { encodeEncryptedFileObject } from "../src/protocol/ppxf";
import { encodeQrMessageLink, encodeQrMessageText } from "../src/protocol/ppxq";
import { encodeRecoveryObject } from "../src/protocol/ppxr";
import { encodeTextArmor } from "../src/protocol/ppxt-armor";
import type { PhysicalDeviceEvidenceBindings } from "./physical-device-evidence";
import { getPhysicalDeviceEvidenceBindings } from "./physical-device-evidence";

const KIT_SCHEMA = "chat-nocontrol-physical-device-test-kit/v1";
const CANONICAL_APP_BASE = "https://levi-cm.github.io/chat-nocontrol/";
const DEFAULT_OUTPUT = "output/release/physical-device-test-kit";
const SENDER_PSEUDONYM = "CAT5 Synthetic Sender";
const RECIPIENT_PSEUDONYM = "CAT5 Synthetic Recipient";
const SENDER_CREATION_TIME = 1_700_000_001n;
const RECIPIENT_CREATION_TIME = 1_700_000_002n;
const SENDER_ENTROPY = new Uint8Array(32).fill(0x51);
const RECIPIENT_ENTROPY = new Uint8Array(32).fill(0xa2);
const FORMAT_1_PLAINTEXT = "CAT5 synthetic V1 format-1 message 🔐";
const FORMAT_2_PLAINTEXT = "CAT5 synthetic V1 compressed message. ".repeat(96);
const PPXQ_PLAINTEXT = "CAT5 synthetic V1 PPXQ message";
const FILE_PLAINTEXT = "CAT5 synthetic V1 file fixture.\n";

const KIT_FILES = [
  "README.md",
  "bindings.json",
  "manifest.json",
  "v1-ppxf.ppxf",
  "v1-ppxq-legacy-link.txt",
  "v1-ppxq-link.txt",
  "v1-ppxq.txt",
  "v1-ppxt-format-1.txt",
  "v1-ppxt-format-2.txt",
  "v1-ppxt-link.txt",
  "v1-recipient-recovery-words.txt",
  "v1-recipient-recovery.ppxr",
  "v1-recipient-recovery.txt",
  "v1-sender-contact.txt",
  "v1-sender.ppxc",
] as const;

export interface GeneratePhysicalDeviceTestKitOptions {
  outputDirectory: string;
  bindings: PhysicalDeviceEvidenceBindings;
}

function sha256(input: Uint8Array | string): string {
  return createHash("sha256").update(input).digest("hex");
}

function deterministicCrypto(seed: string, platformCrypto: Crypto): Crypto {
  let counter = 0;
  const replacement = Object.create(platformCrypto) as Crypto;
  Object.defineProperty(replacement, "subtle", {
    configurable: false,
    enumerable: true,
    value: platformCrypto.subtle,
    writable: false,
  });
  const getRandomValues = (<T extends ArrayBufferView | null>(array: T): T => {
    if (!(array instanceof Uint8Array)) {
      throw new TypeError("synthetic fixture RNG accepts only Uint8Array");
    }
    let offset = 0;
    while (offset < array.byteLength) {
      const digest = createHash("sha512")
        .update(seed, "utf8")
        .update("\0", "utf8")
        .update(String(counter), "utf8")
        .digest();
      counter += 1;
      const length = Math.min(digest.byteLength, array.byteLength - offset);
      array.set(digest.subarray(0, length), offset);
      offset += length;
    }
    return array;
  }) as Crypto["getRandomValues"];
  Object.defineProperty(replacement, "getRandomValues", {
    configurable: false,
    enumerable: true,
    value: getRandomValues,
    writable: false,
  });
  return replacement;
}

async function withDeterministicFixtureCrypto<T>(
  seed: string,
  operation: () => Promise<T>,
): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const platformCrypto = globalThis.crypto;
  if (!descriptor?.configurable || !platformCrypto?.subtle) {
    throw new Error("Web Crypto cannot be isolated for deterministic fixtures");
  }
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    enumerable: descriptor.enumerable,
    value: deterministicCrypto(seed, platformCrypto),
  });
  try {
    return await operation();
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
  }
}

function prepareOutputDirectory(outputDirectory: string): string {
  const absolute = resolve(outputDirectory);
  if (existsSync(absolute)) {
    if (readdirSync(absolute).length > 0) {
      throw new Error(
        `physical-device test-kit directory is not empty: ${absolute}`,
      );
    }
  } else {
    mkdirSync(absolute, { recursive: true, mode: 0o700 });
  }
  chmodSync(absolute, 0o700);
  return absolute;
}

function writeKitFile(
  outputDirectory: string,
  name: (typeof KIT_FILES)[number],
  content: string | Uint8Array,
): void {
  writeFileSync(join(outputDirectory, name), content, { mode: 0o600 });
}

function operatorGuide(bindings: PhysicalDeviceEvidenceBindings): string {
  const checks = [
    "cat5-identity",
    "cat5-recovery",
    "cat5-text",
    "cat5-files",
    "cat5-contacts",
    "cat5-links",
    "recovery-qr-camera",
    "recovery-qr-image-import",
    "legacy-ppxt",
    "legacy-ppxf",
    "legacy-ppxq",
    "legacy-archived-camera-link",
    "offline-reopen",
    "silent-upgrade",
    "web-share",
  ];
  return `# CAT5 physical-device synthetic test kit

Release: ${bindings.releaseTag}
Reviewed candidate: ${bindings.reviewedCandidateSha}
Dist SHA-256: ${bindings.distSha256}
Archive: ${bindings.archive.file} (${bindings.archive.sha256})

This directory contains deterministic **synthetic** V1 recovery material,
contacts, ciphertext, expected plaintext, and links. It is operator input—not
release evidence. Keep it private, never commit it, never upload it to a release,
and never copy its secret-bearing contents into evidence, screenshots, or logs.

## Two-build procedure

1. Verify every entry in \`SHA256SUMS.txt\`.
2. Run \`npm run release:physical-server -- --candidate dist\`. The server
   verifies and loads pinned V1 itself, binds only to loopback, and prints the
   operator-run Tailscale Serve command. Use Serve only; never use Funnel.
3. Open the printed private HTTPS origin on each real device. In initial
   \`legacy\` mode, install the PWA where applicable, create a fresh V1 identity,
   export its recovery material, import the supplied synthetic V1 recovery,
   sender contact, PPXT, PPXF, PPXQ, and archived link, then close/reopen it.
4. Enter \`candidate\` at the local server console. Keep the exact same private
   HTTPS origin, reload/reopen, and allow the existing service worker to update.
5. Prove the migration is silent and persistent: the legacy identity/contact
   state remains usable, supplied V1 inputs remain readable, and every newly
   exported identity, contact, text, file, QR, and recovery artifact is V2-only.
6. With the candidate loaded, verify recovery by camera, image import, words,
   and private file; verify text/file/contact/link sharing; then disable network,
   close and reopen the browser/PWA, and complete \`offline-reopen\` locally.
7. Re-enable the private network only after recording offline results. Execute
   the normative matrix in \`docs/qr-message-device-matrix.md\` on all
   four real profiles; emulation does not qualify.
8. Record metadata/results only in the closed evidence schema. Web Share may be
   NOT SUPPORTED only when \`supported:false\`; every other check must PASS.

## Required evidence check IDs

${checks.map((check) => `- [ ] \`${check}\``).join("\n")}

## Supplied V1 inputs

- \`v1-recipient-recovery.ppxr\`, recovery QR text, and 24 words restore the
  same synthetic recipient.
- \`v1-sender.ppxc\` and \`v1-sender-contact.txt\` are the exact synthetic sender.
- PPXT format 1 and compressed format 2 armors decrypt to manifest expectations.
- PPXF decrypts as a download named \`cat5-v1-synthetic.txt\`; no inline preview.
- PPXQ text, canonical \`#/m/\` link, and archived \`#/decrypt/qr/\` link require
  the supplied sender contact.

After execution, destroy working copies of this kit. Retain only redacted,
signed evidence that contains none of its recovery, contact, ciphertext, or
plaintext material.
`;
}

export async function generatePhysicalDeviceTestKit(
  options: GeneratePhysicalDeviceTestKitOptions,
): Promise<void> {
  const outputDirectory = prepareOutputDirectory(options.outputDirectory);
  const senderEntropy = Uint8Array.from(SENDER_ENTROPY);
  const recipientEntropy = Uint8Array.from(RECIPIENT_ENTROPY);
  const seed = `${KIT_SCHEMA}\0${options.bindings.reviewedCandidateSha}\0${options.bindings.distSha256}\0${options.bindings.archive.sha256}`;
  const sender = await deriveIdentityFromEntropy(
    senderEntropy,
    SENDER_PSEUDONYM,
    SENDER_CREATION_TIME,
  );
  const recipient = await deriveIdentityFromEntropy(
    recipientEntropy,
    RECIPIENT_PSEUDONYM,
    RECIPIENT_CREATION_TIME,
  );
  try {
    await withDeterministicFixtureCrypto(seed, async () => {
      const senderContact = createPublicContact(
        sender,
        SENDER_PSEUDONYM,
        SENDER_CREATION_TIME,
      );
      const recipientContact = createPublicContact(
        recipient,
        RECIPIENT_PSEUDONYM,
        RECIPIENT_CREATION_TIME,
      );
      const format1 = await encryptText({
        sender: senderContact,
        senderSigningCapability: createSenderSigningCapability(sender),
        recipient: recipientContact,
        plaintext: FORMAT_1_PLAINTEXT,
        messageId: new Uint8Array(16).fill(0x11),
        sentAt: 1_700_000_011n,
        createdAt: 1_700_000_010n,
      });
      const format2 = await encryptText({
        sender: senderContact,
        senderSigningCapability: createSenderSigningCapability(sender),
        recipient: recipientContact,
        plaintext: FORMAT_2_PLAINTEXT,
        messageId: new Uint8Array(16).fill(0x22),
        sentAt: 1_700_000_022n,
        createdAt: 1_700_000_021n,
      });
      if (format1.formatVersion !== 1 || format2.formatVersion !== 2) {
        throw new Error(
          "synthetic PPXT fixtures did not select both V1 formats",
        );
      }
      const compact = await encryptQrText({
        sender: senderContact,
        senderSigningCapability: createSenderSigningCapability(sender),
        recipient: recipientContact,
        plaintext: PPXQ_PLAINTEXT,
        messageId: new Uint8Array(16).fill(0x33),
        sentAt: 1_700_000_033n,
        createdAt: 1_700_000_032n,
      });
      const file = await encryptFile({
        sender: senderContact,
        senderSigningCapability: createSenderSigningCapability(sender),
        recipient: recipientContact,
        file: new Blob([FILE_PLAINTEXT], { type: "text/plain" }),
        filename: "cat5-v1-synthetic.txt",
        mimeHint: "text/plain",
        caption: "Synthetic V1 download-only fixture",
        fileLength: BigInt(new TextEncoder().encode(FILE_PLAINTEXT).byteLength),
      });
      const recoveryBytes = encodeRecoveryObject({
        magic: "PPXR",
        formatVersion: 1,
        suite: 1,
        flags: 0,
        masterEntropy: recipientEntropy,
        creationTime: RECIPIENT_CREATION_TIME,
        pseudonym: RECIPIENT_PSEUDONYM,
        checksum: new Uint8Array(16),
      });
      const recoveryWords =
        createRecoveryWordCodec().entropyToRecoveryWords(recipientEntropy);
      const ppxqText = encodeQrMessageText(compact);

      writeKitFile(
        outputDirectory,
        "bindings.json",
        `${JSON.stringify(options.bindings, null, 2)}\n`,
      );
      writeKitFile(
        outputDirectory,
        "README.md",
        operatorGuide(options.bindings),
      );
      writeKitFile(
        outputDirectory,
        "v1-recipient-recovery.ppxr",
        recoveryBytes,
      );
      writeKitFile(
        outputDirectory,
        "v1-recipient-recovery.txt",
        `PPX1:RECOVERY:${encodeBase45Upper(recoveryBytes)}\n`,
      );
      writeKitFile(
        outputDirectory,
        "v1-recipient-recovery-words.txt",
        `${recoveryWords.join(" ")}\n`,
      );
      writeKitFile(
        outputDirectory,
        "v1-sender.ppxc",
        encodePublicContact(senderContact),
      );
      writeKitFile(
        outputDirectory,
        "v1-sender-contact.txt",
        `${encodePublicContactQr(senderContact)}\n`,
      );
      writeKitFile(
        outputDirectory,
        "v1-ppxt-format-1.txt",
        encodeTextArmor(format1),
      );
      writeKitFile(
        outputDirectory,
        "v1-ppxt-format-2.txt",
        encodeTextArmor(format2),
      );
      writeKitFile(
        outputDirectory,
        "v1-ppxt-link.txt",
        `${encodeMessageLink({ kind: "ppxt", object: format1 }, CANONICAL_APP_BASE)}\n`,
      );
      writeKitFile(
        outputDirectory,
        "v1-ppxf.ppxf",
        encodeEncryptedFileObject(file),
      );
      writeKitFile(outputDirectory, "v1-ppxq.txt", ppxqText);
      writeKitFile(
        outputDirectory,
        "v1-ppxq-link.txt",
        `${encodeMessageLink({ kind: "ppxq", object: compact }, CANONICAL_APP_BASE)}\n`,
      );
      writeKitFile(
        outputDirectory,
        "v1-ppxq-legacy-link.txt",
        `${encodeQrMessageLink(compact, CANONICAL_APP_BASE)}\n`,
      );

      const manifest = {
        schema: KIT_SCHEMA,
        canonicalAppBase: CANONICAL_APP_BASE,
        bindings: options.bindings,
        identities: {
          sender: {
            pseudonym: SENDER_PSEUDONYM,
            creationTime: SENDER_CREATION_TIME.toString(),
          },
          recipient: {
            pseudonym: RECIPIENT_PSEUDONYM,
            creationTime: RECIPIENT_CREATION_TIME.toString(),
          },
        },
        expected: {
          ppxtFormat1: FORMAT_1_PLAINTEXT,
          ppxtFormat2: FORMAT_2_PLAINTEXT,
          ppxq: PPXQ_PLAINTEXT,
          file: FILE_PLAINTEXT,
        },
        files: [...KIT_FILES].sort(),
      };
      writeKitFile(
        outputDirectory,
        "manifest.json",
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
    });

    const ledger = [...KIT_FILES]
      .sort()
      .map(
        (name) =>
          `${sha256(readFileSync(join(outputDirectory, name)))}  ${name}`,
      )
      .join("\n");
    writeFileSync(join(outputDirectory, "SHA256SUMS.txt"), `${ledger}\n`, {
      mode: 0o600,
    });
  } finally {
    zeroize(
      senderEntropy,
      recipientEntropy,
      sender.masterEntropy,
      sender.kemSecretKey,
      sender.x25519SecretKey,
      sender.signingSecretKey,
      recipient.masterEntropy,
      recipient.kemSecretKey,
      recipient.x25519SecretKey,
      recipient.signingSecretKey,
    );
  }
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`missing value for ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
    version?: string;
  };
  const review = JSON.parse(
    readFileSync("docs/independent-security-review.json", "utf8"),
  ) as { reviewedCommit?: string };
  const version = manifest.version ?? "";
  const bindings = getPhysicalDeviceEvidenceBindings({
    reviewedCandidateSha: review.reviewedCommit ?? "",
    version,
  });
  const outputDirectory = argumentValue("--output") ?? DEFAULT_OUTPUT;
  await generatePhysicalDeviceTestKit({ outputDirectory, bindings });
  process.stdout.write(
    `Physical-device test kit generated: ${resolve(outputDirectory)} (${KIT_FILES.length + 1} files)\n`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
