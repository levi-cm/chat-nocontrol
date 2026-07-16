import {
  MESSAGE_LINK_HASH_PREFIX,
  parseMessageLinkHash,
  type MessageLinkObject,
} from "../protocol/message-link";
import { parseQrMessageText, PPXQ_LINK_HASH_PREFIX } from "../protocol/ppxq";
import { PPXError } from "../protocol/types";

export function parseIncomingMessageText(
  text: string,
): MessageLinkObject | null {
  const trimmed = text.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const reserved =
    url.hash.startsWith(MESSAGE_LINK_HASH_PREFIX) ||
    url.hash.startsWith(PPXQ_LINK_HASH_PREFIX);
  if (!reserved) return null;
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== ""
  ) {
    throw new PPXError("noncanonical-text");
  }
  if (url.hash.startsWith(MESSAGE_LINK_HASH_PREFIX)) {
    return parseMessageLinkHash(url.hash);
  }
  return { kind: "ppxq", object: parseQrMessageText(url.toString()) };
}
