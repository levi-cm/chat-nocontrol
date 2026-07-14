import { sha512Digest } from "../crypto/noble-provider";
import {
  decodeBase64UrlNoPad,
  encodeBase64UrlNoPad,
  wrapBase64Url,
} from "./base64url";
import { equalBytes } from "./checksum";
import { encodeEncryptedText, parseEncryptedText } from "./ppxt";
import { PPXError, type EncryptedTextObject } from "./types";
import { PPXT_MAXIMUM_OBJECT_SIZE } from "./ppxt-outer";

const BEGIN = "-----BEGIN PPX ENCRYPTED TEXT-----";
const END = "-----END PPX ENCRYPTED TEXT-----";
export const PPXT_ARMOR_MAXIMUM_CHARS = 406_000;

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array {
  if (!/^[0-9a-f]{128}$/u.test(value)) {
    throw new PPXError("noncanonical-text");
  }
  return Uint8Array.from(value.match(/../gu) as string[], (pair) =>
    Number.parseInt(pair, 16),
  );
}

export function encodeTextArmor(object: EncryptedTextObject): string {
  const bytes = encodeEncryptedText(object);
  const body = wrapBase64Url(encodeBase64UrlNoPad(bytes), 72);
  return [
    BEGIN,
    `Version: ${object.formatVersion}`,
    "Suite: PPX-HYBRID-1",
    `Bytes: ${bytes.byteLength}`,
    `Digest: ${hex(sha512Digest(bytes))}`,
    "",
    body,
    END,
  ].join("\n");
}

export function decodeTextArmor(armor: string): EncryptedTextObject {
  if (armor.length > PPXT_ARMOR_MAXIMUM_CHARS) {
    throw new PPXError("oversize-before-allocation");
  }
  const lines = armor.split("\n");
  if (
    lines.length < 8 ||
    lines[0] !== BEGIN ||
    !/^Version: [12]$/u.test(lines[1] ?? "") ||
    lines[2] !== "Suite: PPX-HYBRID-1" ||
    lines[5] !== "" ||
    lines.at(-1) !== END
  ) {
    throw new PPXError("noncanonical-text");
  }
  const bytesHeader = lines[3]?.match(/^Bytes: ([0-9]+)$/u);
  const digestHeader = lines[4]?.match(/^Digest: ([0-9a-f]{128})$/u);
  if (!bytesHeader || !digestHeader) throw new PPXError("noncanonical-text");
  const declaredBytes = Number(bytesHeader[1]);
  if (
    !Number.isSafeInteger(declaredBytes) ||
    declaredBytes > PPXT_MAXIMUM_OBJECT_SIZE
  ) {
    throw new PPXError("oversize-before-allocation");
  }
  const bodyLines = lines.slice(6, -1);
  if (
    bodyLines.length === 0 ||
    bodyLines.some(
      (line, index) =>
        line.length === 0 ||
        line.length > 72 ||
        (index < bodyLines.length - 1 && line.length !== 72),
    )
  ) {
    throw new PPXError("noncanonical-text");
  }
  const bytes = decodeBase64UrlNoPad(bodyLines.join(""));
  if (bytes.byteLength !== declaredBytes) {
    throw new PPXError("impossible-length");
  }
  if (!equalBytes(sha512Digest(bytes), fromHex(digestHeader[1] as string))) {
    throw new PPXError("checksum-mismatch");
  }
  const object = parseEncryptedText(bytes);
  if (lines[1] !== `Version: ${object.formatVersion}`) {
    throw new PPXError("noncanonical-text");
  }
  if (encodeTextArmor(object) !== armor)
    throw new PPXError("noncanonical-text");
  return object;
}
