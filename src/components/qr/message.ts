import QRCode from "qrcode";

import { encodeBase37Upper } from "../../protocol/base37";
import {
  PPXQ_LINK_HASH_PREFIX,
  PPXQ_MESSAGE_PREFIX,
} from "../../protocol/ppxq";
import { PPXError } from "../../protocol/types";

export type MessageQrTransport = "app" | "link";
export type MessageQrCapacity =
  | {
      fits: true;
      version: number;
      text: string;
      segments: QRCode.QRCodeSegment[];
    }
  | { fits: false; encodedBytesOver: number };

function segmentsFor(
  bytes: Uint8Array,
  transport: MessageQrTransport,
  appBase: string,
): { text: string; segments: QRCode.QRCodeSegment[] } {
  const encoded = encodeBase37Upper(bytes);
  if (transport === "app") {
    const text = PPXQ_MESSAGE_PREFIX + encoded;
    return { text, segments: [{ data: text, mode: "alphanumeric" }] };
  }
  const base = new URL(appBase);
  if (base.protocol !== "https:") throw new PPXError("noncanonical-text");
  base.hash = "";
  const prefix = `${base.toString().replace(/#$/, "")}${PPXQ_LINK_HASH_PREFIX}`;
  return {
    text: prefix + encoded,
    segments: [
      { data: new TextEncoder().encode(prefix), mode: "byte" },
      { data: encoded, mode: "alphanumeric" },
    ],
  };
}

function tryCapacity(
  bytes: Uint8Array,
  transport: MessageQrTransport,
  appBase: string,
): Extract<MessageQrCapacity, { fits: true }> | null {
  const candidate = segmentsFor(bytes, transport, appBase);
  try {
    const qr = QRCode.create(candidate.segments, { errorCorrectionLevel: "H" });
    if (qr.version < 1 || qr.version > 40) return null;
    return { fits: true, version: qr.version, ...candidate };
  } catch {
    return null;
  }
}

export function prepareMessageQr(
  bytes: Uint8Array,
  transport: MessageQrTransport,
  appBase: string,
): MessageQrCapacity {
  const fitting = tryCapacity(bytes, transport, appBase);
  if (fitting) return fitting;
  let low = 0;
  let high = bytes.byteLength;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (tryCapacity(bytes.slice(0, middle), transport, appBase)) low = middle;
    else high = middle - 1;
  }
  return { fits: false, encodedBytesOver: bytes.byteLength - low };
}

export async function generateMessageQrPng(
  capacity: Extract<MessageQrCapacity, { fits: true }>,
): Promise<Blob> {
  const dataUrl = await QRCode.toDataURL(capacity.segments, {
    errorCorrectionLevel: "H",
    version: capacity.version,
    margin: 4,
    width: 2_048,
    color: { dark: "#000000", light: "#ffffff" },
  });
  const response = await fetch(dataUrl);
  return response.blob();
}
