// @vitest-environment node

import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { decryptFile } from "../../crypto/file";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import { decryptQrText } from "../../crypto/qr-text";
import { createRecoveryWordCodec } from "../../crypto/recovery-words";
import { decryptText } from "../../crypto/text";
import { parseMessageLinkHash } from "../../protocol/message-link";
import { parsePublicContact } from "../../protocol/ppxc";
import { parseEncryptedFileObject } from "../../protocol/ppxf";
import { extractQrMessageBytes, parseQrMessageText } from "../../protocol/ppxq";
import { parseEncryptedQrText } from "../../protocol/ppxq-outer";
import { parseRecoveryObject } from "../../protocol/ppxr";
import { decodeTextArmor } from "../../protocol/ppxt-armor";
import { generatePhysicalDeviceTestKit } from "../../../scripts/generate-physical-device-test-kit";

const temporaryRoots: string[] = [];
const bindings = {
  reviewedCandidateSha: "a".repeat(40),
  releaseTag: "v0.2.0-beta.1",
  version: "0.2.0-beta.1",
  distSha256: "b".repeat(64),
  archive: {
    file: "chat-nocontrol-v0.2.0-beta.1.tgz",
    sha256: "c".repeat(64),
  },
} as const;

interface KitManifest {
  schema: string;
  canonicalAppBase: string;
  identities: {
    recipient: { pseudonym: string; creationTime: string };
  };
  expected: {
    ppxtFormat1: string;
    ppxtFormat2: string;
    ppxq: string;
    file: string;
  };
  files: string[];
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function temporaryDirectory(label: string): string {
  const root = mkdtempSync(join(tmpdir(), label));
  temporaryRoots.push(root);
  return root;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function filesUnder(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) visit(path);
      else files.push(relative(root, path).split("\\").join("/"));
    }
  };
  visit(root);
  return files.sort();
}

describe("physical-device synthetic test kit", () => {
  it("generates deterministic release-bound V1 fixtures that all decrypt", async () => {
    const first = temporaryDirectory("cat5-physical-kit-a-");
    const second = temporaryDirectory("cat5-physical-kit-b-");

    await generatePhysicalDeviceTestKit({ outputDirectory: first, bindings });
    await generatePhysicalDeviceTestKit({ outputDirectory: second, bindings });

    const firstFiles = filesUnder(first);
    expect(firstFiles).toEqual(filesUnder(second));
    expect(firstFiles).toContain("README.md");
    expect(firstFiles).toContain("SHA256SUMS.txt");
    expect(firstFiles).toContain("manifest.json");
    for (const file of firstFiles) {
      expect(sha256(join(first, file))).toBe(sha256(join(second, file)));
    }

    const manifest = JSON.parse(
      readFileSync(join(first, "manifest.json"), "utf8"),
    ) as KitManifest;
    expect(manifest).toMatchObject({
      schema: "chat-nocontrol-physical-device-test-kit/v1",
      canonicalAppBase: "https://levi-cm.github.io/chat-nocontrol/",
    });
    expect(manifest.files).toEqual(
      firstFiles.filter((file) => file !== "SHA256SUMS.txt"),
    );
    expect(
      JSON.parse(readFileSync(join(first, "bindings.json"), "utf8")),
    ).toEqual(bindings);

    const recoveryBytes = new Uint8Array(
      readFileSync(join(first, "v1-recipient-recovery.ppxr")),
    );
    const recovery = parseRecoveryObject(recoveryBytes);
    const words = readFileSync(
      join(first, "v1-recipient-recovery-words.txt"),
      "utf8",
    )
      .trim()
      .split(/\s+/u);
    const entropy = createRecoveryWordCodec().recoveryWordsToEntropy(words);
    expect(entropy).toEqual(recovery.masterEntropy);
    const recipient = await deriveIdentityFromEntropy(
      entropy,
      manifest.identities.recipient.pseudonym,
      BigInt(manifest.identities.recipient.creationTime),
    );

    const sender = parsePublicContact(
      new Uint8Array(readFileSync(join(first, "v1-sender.ppxc"))),
    );
    const format1 = decodeTextArmor(
      readFileSync(join(first, "v1-ppxt-format-1.txt"), "utf8"),
    );
    const format2 = decodeTextArmor(
      readFileSync(join(first, "v1-ppxt-format-2.txt"), "utf8"),
    );
    expect(format1.formatVersion).toBe(1);
    expect(format2.formatVersion).toBe(2);
    await expect(
      decryptText({ object: format1, activeIdentity: recipient }),
    ).resolves.toMatchObject({ plaintext: manifest.expected.ppxtFormat1 });
    await expect(
      decryptText({ object: format2, activeIdentity: recipient }),
    ).resolves.toMatchObject({ plaintext: manifest.expected.ppxtFormat2 });

    const fileObject = parseEncryptedFileObject(
      new Uint8Array(readFileSync(join(first, "v1-ppxf.ppxf"))),
    );
    const decryptedFile = await decryptFile({
      object: fileObject,
      activeIdentity: recipient,
    });
    expect(await decryptedFile.blob.text()).toBe(manifest.expected.file);
    expect(decryptedFile.filename).toBe("cat5-v1-synthetic.txt");

    const compactText = readFileSync(join(first, "v1-ppxq.txt"), "utf8");
    const compactObject = parseQrMessageText(compactText);
    await expect(
      decryptQrText({
        object: compactObject,
        activeIdentity: recipient,
        knownSenders: [sender],
      }),
    ).resolves.toMatchObject({ plaintext: manifest.expected.ppxq });

    for (const linkFile of ["v1-ppxt-link.txt", "v1-ppxq-link.txt"]) {
      const link = new URL(readFileSync(join(first, linkFile), "utf8").trim());
      expect(link.origin + link.pathname).toBe(
        "https://levi-cm.github.io/chat-nocontrol/",
      );
      expect(parseMessageLinkHash(link.hash).kind).toBe(
        linkFile.includes("ppxt") ? "ppxt" : "ppxq",
      );
    }
    const legacyLink = readFileSync(
      join(first, "v1-ppxq-legacy-link.txt"),
      "utf8",
    ).trim();
    expect(parseEncryptedQrText(extractQrMessageBytes(legacyLink))).toEqual(
      compactObject,
    );

    const ledger = readFileSync(join(first, "SHA256SUMS.txt"), "utf8")
      .trim()
      .split("\n");
    expect(ledger).toHaveLength(firstFiles.length - 1);
    for (const line of ledger) {
      const match = /^([0-9a-f]{64})  (.+)$/u.exec(line);
      expect(match).not.toBeNull();
      expect(sha256(join(first, match?.[2] ?? ""))).toBe(match?.[1]);
    }

    const ignored = spawnSync("git", ["check-ignore", "-q", "output/release"], {
      cwd: process.cwd(),
    });
    expect(ignored.status).toBe(0);
    expect(readFileSync("scripts/package-release.ts", "utf8")).not.toContain(
      "physical-device-test-kit",
    );
  }, 30_000);
});
