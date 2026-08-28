import { sha512Digest } from "../crypto/noble-provider";
import {
  decodeBase64UrlNoPad,
  encodeBase64UrlNoPad,
  wrapBase64Url,
} from "./base64url";
import { equalBytes } from "./checksum";
import {
  encodeEncryptedTextOuterV2,
  parseEncryptedTextOuterV2,
  PPX_TEXT_V2_MAXIMUM_OBJECT_SIZE,
} from "./text-v2-outer";
import { PPXError } from "./types";
import type { EncryptedTextObjectV2 } from "./types-v2";

const BEGIN = "-----BEGIN PPX ENCRYPTED TEXT-----";
const END = "-----END PPX ENCRYPTED TEXT-----";
export const PPXT_V2_ARMOR_MAXIMUM_CHARS = 406_000;

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

export function encodeTextArmorV2(object: EncryptedTextObjectV2): string {
  if (object.magic !== "PPXT") throw new PPXError("noncanonical-text");
  const bytes = encodeEncryptedTextOuterV2(object);
  const body = wrapBase64Url(encodeBase64UrlNoPad(bytes), 72);
  return [
    BEGIN,
    "Version: 2",
    "Suite: PPX-PQ-5",
    `Bytes: ${bytes.byteLength}`,
    `Digest: ${hex(sha512Digest(bytes))}`,
    "",
    body,
    END,
  ].join("\n");
}

export function decodeTextArmorV2(armor: string): EncryptedTextObjectV2 {
  if (armor.length > PPXT_V2_ARMOR_MAXIMUM_CHARS) {
    throw new PPXError("oversize-before-allocation");
  }
  const lines = armor.split("\n");
  if (
    lines.length < 8 ||
    lines[0] !== BEGIN ||
    lines[1] !== "Version: 2" ||
    lines[2] !== "Suite: PPX-PQ-5" ||
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
    declaredBytes > PPX_TEXT_V2_MAXIMUM_OBJECT_SIZE
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
  if (bytes.byteLength !== declaredBytes)
    throw new PPXError("impossible-length");
  if (!equalBytes(sha512Digest(bytes), fromHex(digestHeader[1] as string))) {
    throw new PPXError("checksum-mismatch");
  }
  const object = parseEncryptedTextOuterV2(bytes, "PPXT");
  if (encodeTextArmorV2(object) !== armor) {
    throw new PPXError("noncanonical-text");
  }
  return object;
}
