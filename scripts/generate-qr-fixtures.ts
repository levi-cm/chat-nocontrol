import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import QRCode from "qrcode";
import { deriveIdentityFromEntropy } from "../src/crypto/identity";
import {
  createPublicContact,
  encodePublicContactQr,
} from "../src/protocol/ppxc";

const directory = resolve("fixtures/qr");
const options = {
  errorCorrectionLevel: "H" as const,
  margin: 2,
  width: 700,
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const identity = await deriveIdentityFromEntropy(
  new Uint8Array(32).fill(7),
  "QR Bob",
);
const canonical = encodePublicContactQr(
  createPublicContact(identity, "QR Bob", 7n),
);
const mutationIndex = "PPX1:CONTACT:".length + 100;
const replacement = canonical[mutationIndex] === "0" ? "1" : "0";
const damaged = `${canonical.slice(0, mutationIndex)}${replacement}${canonical.slice(mutationIndex + 1)}`;
const validPng = await QRCode.toBuffer(canonical, options);
const damagedPng = await QRCode.toBuffer(damaged, options);
const manifest = `${JSON.stringify(
  {
    source: "deterministic PPXC fixture; 32-byte entropy filled with 7",
    valid: {
      file: "contact-valid.png",
      payloadSha256: sha256(new TextEncoder().encode(canonical)),
      pngSha256: sha256(validPng),
    },
    damaged: {
      file: "contact-checksum-damaged.png",
      mutationIndex,
      payloadSha256: sha256(new TextEncoder().encode(damaged)),
      pngSha256: sha256(damagedPng),
      expected: "ZXing decodes; strict PPXC classification rejects",
    },
  },
  null,
  2,
)}\n`;

const files = new Map<string, Uint8Array>([
  ["contact-valid.png", validPng],
  ["contact-checksum-damaged.png", damagedPng],
  ["manifest.json", new TextEncoder().encode(manifest)],
]);

if (process.argv.includes("--write")) {
  await mkdir(directory, { recursive: true });
  for (const [name, bytes] of files) {
    await writeFile(resolve(directory, name), bytes);
  }
  console.log(`Wrote ${files.size} deterministic QR fixtures.`);
} else {
  for (const [name, expected] of files) {
    const actual = await readFile(resolve(directory, name));
    if (!actual.equals(expected)) throw new Error(`QR fixture drift: ${name}`);
  }
  console.log(`QR image fixtures OK: ${files.size} files.`);
}
