import { decodeBase64UrlNoPad } from "../../protocol/base64url";
import { decodeTextArmor } from "../../protocol/ppxt-armor";
import { decodeTextArmorV2 } from "../../protocol/ppxt-armor-v2";
import {
  MESSAGE_LINK_V2_MAX_ENCODED_CHARS,
  parseMessageLinkHashV2,
} from "../../protocol/message-link-v2";
import { extractQrMessageBytes } from "../../protocol/ppxq";
import {
  parseEncryptedQrText,
  PPXQ_MAXIMUM_OBJECT_SIZE,
} from "../../protocol/ppxq-outer";
import {
  parseEncryptedTextOuter,
  PPXT_MAXIMUM_OBJECT_SIZE,
} from "../../protocol/ppxt-outer";
import { PPXError, type EncryptedTextObject } from "../../protocol/types";
import type { EncryptedTextObjectV2 } from "../../protocol/types-v2";

export type ClassifiedEncryptedText =
  | { kind: "legacy-v1-full"; object: EncryptedTextObject }
  | { kind: "legacy-v1-compact"; ppxqBytes: Uint8Array }
  | { kind: "cat5-v2"; object: EncryptedTextObjectV2 };

export type ClassifiedEncryptedFile = "legacy-v1" | "cat5-v2";

const LEGACY_COMPACT_PREFIX = "PPX1:MESSAGE:";
const LEGACY_MESSAGE_LINK_PREFIX = "#/decrypt/qr/";
const MESSAGE_LINK_PREFIX = "#/m/";
const MESSAGE_LINK_MAX_ENCODED_CHARS = Math.max(
  MESSAGE_LINK_V2_MAX_ENCODED_CHARS,
  Math.ceil(
    (Math.max(PPXT_MAXIMUM_OBJECT_SIZE, PPXQ_MAXIMUM_OBJECT_SIZE) * 4) / 3,
  ),
);

function requireSafeEncryptedUrl(url: URL): void {
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== ""
  ) {
    throw new PPXError("noncanonical-text");
  }
}

function classifyMessageLink(url: URL): ClassifiedEncryptedText {
  requireSafeEncryptedUrl(url);
  const encoded = url.hash.slice(MESSAGE_LINK_PREFIX.length);
  if (
    encoded.length === 0 ||
    encoded.length > MESSAGE_LINK_MAX_ENCODED_CHARS ||
    !/^[A-Za-z0-9_-]+$/u.test(encoded)
  ) {
    throw new PPXError("noncanonical-text");
  }
  const bytes = decodeBase64UrlNoPad(encoded);
  const magic = new TextDecoder().decode(bytes.slice(0, 4));
  if (bytes[5] === 0x01) {
    if (magic === "PPXT" && (bytes[4] === 0x01 || bytes[4] === 0x02)) {
      return { kind: "legacy-v1-full", object: parseEncryptedTextOuter(bytes) };
    }
    if (magic === "PPXQ" && bytes[4] === 0x01) {
      parseEncryptedQrText(bytes);
      return { kind: "legacy-v1-compact", ppxqBytes: bytes };
    }
  }
  const parsed = parseMessageLinkHashV2(url.hash);
  return { kind: "cat5-v2", object: parsed.object };
}

export function classifyEncryptedText(text: string): ClassifiedEncryptedText {
  const trimmed = text.trim();
  if (trimmed.startsWith(LEGACY_COMPACT_PREFIX)) {
    return {
      kind: "legacy-v1-compact",
      ppxqBytes: extractQrMessageBytes(trimmed),
    };
  }

  try {
    const url = new URL(trimmed);
    if (url.hash.startsWith(LEGACY_MESSAGE_LINK_PREFIX)) {
      requireSafeEncryptedUrl(url);
      return {
        kind: "legacy-v1-compact",
        ppxqBytes: extractQrMessageBytes(trimmed),
      };
    }
    if (url.hash.startsWith(MESSAGE_LINK_PREFIX))
      return classifyMessageLink(url);
  } catch {
    if (
      trimmed.includes(LEGACY_MESSAGE_LINK_PREFIX) ||
      trimmed.includes(MESSAGE_LINK_PREFIX)
    ) {
      throw new PPXError("noncanonical-text");
    }
  }

  if (trimmed.split("\n", 3)[2] === "Suite: PPX-HYBRID-1") {
    return { kind: "legacy-v1-full", object: decodeTextArmor(trimmed) };
  }
  return { kind: "cat5-v2", object: decodeTextArmorV2(trimmed) };
}

export async function classifyEncryptedFile(
  file: Blob,
): Promise<ClassifiedEncryptedFile> {
  const header = new Uint8Array(await file.slice(0, 6).arrayBuffer());
  if (
    header.byteLength !== 6 ||
    header[0] !== 0x50 ||
    header[1] !== 0x50 ||
    header[2] !== 0x58 ||
    header[3] !== 0x46
  ) {
    throw new PPXError("noncanonical-text");
  }
  if (header[4] === 0x01 && header[5] === 0x01) return "legacy-v1";
  if (header[4] === 0x02 && header[5] === 0x02) return "cat5-v2";
  throw new PPXError("unknown-suite");
}
